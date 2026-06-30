/**
 * Shared constants for the social media module.
 * Safe to import from both client and server code (no server-only APIs).
 */

export const PLATFORM_CHAR_LIMITS = {
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  tiktok: 2200,
};

export const PLATFORMS_REQUIRING_MEDIA = new Set(["instagram", "tiktok"]);

export const POST_TYPES = ["Text", "Image", "Video", "Carousel", "Story", "Reel"];

export const POST_STATUSES = [
  "Draft",
  "Scheduled",
  "Publishing",
  "Published",
  "PartiallyPublished",
  "Failed",
  "Cancelled",
];

export const PUBLISHABLE_STATUSES = new Set(["Draft", "Scheduled", "Failed"]);

export const EDITABLE_STATUSES = new Set(["Draft", "Scheduled"]);

export const DELETABLE_STATUSES = new Set(["Draft", "Scheduled", "Failed", "Cancelled"]);

export const MAX_CONTENT_LENGTH = 63206;
export const MAX_RETRY_ATTEMPTS = 3;
export const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 60 * 1000; // 2 hours
export const TOKEN_REFRESH_MAX_FAILURES = 3;
export const STUCK_PUBLISHING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_INBOX_LIMIT = 25;
export const MAX_INBOX_LIMIT = 100;
export const MESSAGE_LIMIT = 100;

export const MAX_REPLY_LENGTH = 2000;

export const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export const STATUS_COLORS = {
  Draft: "bg-gray-100 text-gray-700 border-gray-200",
  Scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  Publishing: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Published: "bg-green-100 text-green-700 border-green-200",
  PartiallyPublished: "bg-orange-100 text-orange-700 border-orange-200",
  Failed: "bg-red-100 text-red-700 border-red-200",
  Cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

export const AP_STATUS_COLORS = {
  Pending: "bg-gray-100 text-gray-700",
  Publishing: "bg-yellow-100 text-yellow-700",
  Published: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-700",
  Retrying: "bg-orange-100 text-orange-700",
};

export const STATUS_DOT_COLORS = {
  Scheduled: "bg-blue-500",
  Publishing: "bg-yellow-500",
  Published: "bg-green-500",
  PartiallyPublished: "bg-orange-500",
  Failed: "bg-red-500",
  Cancelled: "bg-gray-400",
};

/**
 * Build the public URL for a post on a given platform.
 * Returns null if the URL cannot be constructed for the platform.
 *
 * @param {string} platformCode - facebook | instagram | twitter | tiktok
 * @param {string} platformPostId - the ID returned by the platform API
 * @param {object} profileData - the account's profileData JSON
 * @returns {string|null}
 */
export function buildPlatformUrl(platformCode, platformPostId, profileData = {}) {
  if (!platformPostId) return null;
  switch (platformCode) {
    case "facebook": {
      const pageId = profileData.pageId;
      if (!pageId) return null;
      return `https://www.facebook.com/${pageId}/posts/${platformPostId}`;
    }
    case "twitter":
      return `https://twitter.com/i/web/status/${platformPostId}`;
    case "instagram":
      // Instagram Graph API post IDs are numeric; permalink requires a separate API call.
      // Return null rather than constructing an invalid URL.
      return null;
    case "tiktok":
      // TikTok publish API returns a publish_id, not a share URL.
      // Share URL requires a separate video query API call.
      return null;
    default:
      return null;
  }
}

/**
 * Append hashtags to post content.
 * @param {string} content
 * @param {string[]} hashtags
 * @returns {string}
 */
export function buildContent(content, hashtags = []) {
  if (!hashtags || hashtags.length === 0) return content;
  const tagString = hashtags.map((t) => `#${t}`).join(" ");
  return `${content}\n\n${tagString}`;
}

/**
 * Convert a Date to a local datetime-local input value (YYYY-MM-DDTHH:MM in local tz).
 * Used by datetime-local <input> elements so the displayed value matches the user's timezone.
 * @param {Date} date
 * @returns {string}
 */
export function toLocalDatetimeInputValue(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
