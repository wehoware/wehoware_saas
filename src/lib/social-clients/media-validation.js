/**
 * src/lib/social-clients/media-validation.js
 *
 * Validation helpers for post media URLs. Social platforms fetch media
 * server-side at publish time, so a URL must be a publicly reachable,
 * direct link to an image/video file — a webpage URL (e.g. a Google Images
 * results page or a Pinterest pin) fails deep inside the platform API with
 * a cryptic error. These checks catch that early with a clear message.
 *
 * Server-only.
 */

const VIDEO_EXT_RE = /\.(mp4|mov|webm|m4v|avi)$/i;

const PRIVATE_HOST_RE =
  /^(localhost|127\.|0\.0\.0\.0|::1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|.*\.(local|internal|lan))$/i;

/**
 * Whether a media URL points at a video file (by extension on the URL path,
 * so query strings don't break detection).
 */
export function isVideoUrl(url) {
  try {
    return VIDEO_EXT_RE.test(new URL(url).pathname);
  } catch {
    return VIDEO_EXT_RE.test(String(url));
  }
}

/**
 * Resolve a stored media URL to an absolute URL. Files uploaded via
 * /api/v1/uploads on local storage are stored as "/uploads/..." — join them
 * against the app origin (request origin for user-triggered publishes, or
 * NEXT_PUBLIC_APP_URL/NEXTAUTH_URL for cron).
 */
export function resolveMediaUrl(url, origin) {
  if (typeof url === "string" && url.startsWith("/") && origin) {
    return `${String(origin).replace(/\/$/, "")}${url}`;
  }
  return url;
}

/**
 * Cheap synchronous check — is this a plausible publicly-fetchable media URL?
 * Returns an error string or null.
 */
export function validateMediaUrlShape(url, { allowRelative = false } = {}) {
  if (!url || typeof url !== "string") {
    return "Media URL must be a non-empty string";
  }
  // Relative paths are our own local-storage uploads — resolved to absolute
  // at publish time.
  if (allowRelative && url.startsWith("/")) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return `Media URL is not a valid URL: ${url}`;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return `Media URL must start with http:// or https://: ${url}`;
  }
  if (PRIVATE_HOST_RE.test(parsed.hostname)) {
    return `Media URL must be publicly reachable (not a local/private address): ${url}`;
  }
  return null;
}

/**
 * Fetch a tiny byte range of the URL to verify it actually serves media.
 * Social APIs (Meta especially) fail with opaque errors when image_url
 * returns an HTML error page — this converts that into a clear message.
 *
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export async function probeMediaUrl(url, { timeoutMs = 7000 } = {}) {
  const shapeError = validateMediaUrlShape(url);
  if (shapeError) return { ok: false, reason: shapeError };

  let res;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    return {
      ok: false,
      reason: `Media URL could not be fetched (${err?.message ?? "network error"}): ${url}`,
    };
  }

  // Body must be cancelled so the connection can be reused/closed cleanly.
  res.body?.cancel?.().catch(() => {});

  if (!res.ok) {
    return {
      ok: false,
      reason: `Media URL returned HTTP ${res.status} instead of a media file: ${url}`,
    };
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.startsWith("image/") || contentType.startsWith("video/")) {
    return { ok: true };
  }
  if (!contentType || contentType === "application/octet-stream") {
    // Some CDNs omit/lose the type — let the platform decide.
    return { ok: true };
  }
  return {
    ok: false,
    reason: `Media URL returned "${contentType}", not an image or video — it looks like a webpage, not a direct file link: ${url}`,
  };
}

/**
 * Probe every URL; throws an Error naming the first bad URL.
 */
export async function assertMediaUrlsFetchable(urls, opts) {
  for (const url of urls) {
    const { ok, reason } = await probeMediaUrl(url, opts);
    if (!ok) throw new Error(reason);
  }
}
