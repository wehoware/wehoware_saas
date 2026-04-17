/**
 * src/lib/uploadClient.js
 *
 * Client-side (browser) helper that replaces the old Supabase-based
 * `uploadThumbnail` / `deleteThumbnailByUrl` functions. Uses the secured
 * /api/v1/uploads route which persists to local filesystem (dev) or S3 (prod
 * when AWS env vars are set).
 *
 * Drop-in replacement API — same function names as the old storageUtils,
 * so admin pages only need to swap the import path.
 */

/**
 * Upload a File/Blob to server storage.
 * @param {File} file        the browser File object from an <input type="file">
 * @param {string} entityType  'blogs' | 'services' | 'avatars' | 'general'
 * @returns {Promise<string>}  the publicly-accessible URL
 */
export async function uploadThumbnail(file, entityType = "general") {
  if (!file) throw new Error("No file provided for upload");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("entityType", entityType);

  const res = await fetch("/api/v1/uploads", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let msg = `Upload failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore; use default message
    }
    throw new Error(msg);
  }

  const { url } = await res.json();
  return url;
}

/**
 * Delete a previously-uploaded file by its public URL.
 * Silently succeeds if the URL is unknown (e.g. a legacy Supabase URL).
 */
export async function deleteThumbnailByUrl(url) {
  if (!url) return;
  try {
    await fetch("/api/v1/uploads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch (err) {
    // Non-fatal: log but don't throw — we don't want a storage cleanup
    // failure to block an otherwise-successful DB update.
    console.warn("[uploadClient] delete failed:", err);
  }
}
