/**
 * seoScore.js
 *
 * Shared utility for computing a 0–100 SEO score based on content completeness.
 * Used by both service and blog API routes to auto-calculate score on create/update.
 *
 * Scoring breakdown:
 *   - Meta title length (50–60 chars):  20 pts
 *   - Meta desc length (150–160 chars): 20 pts
 *   - Meta keywords present:            10 pts
 *   - Thumbnail present:                 8 pts
 *   - Thumbnail alt present:             7 pts
 *   - OG title + desc + image:          15 pts
 *   - Slug present:                     10 pts
 *   - Content length > 300 chars:       10 pts
 *
 * @param {Object} data
 * @returns {number} 0–100
 */

const META_TITLE_OPTIMAL_MIN = 50;
const META_TITLE_OPTIMAL_MAX = 60;
const META_TITLE_PARTIAL_MAX = 49;
const META_DESC_OPTIMAL_MIN = 150;
const META_DESC_OPTIMAL_MAX = 160;
const META_DESC_PARTIAL_MAX = 149;
const CONTENT_LENGTH_THRESHOLD = 300;
const MAX_SCORE = 100;

function scoreMetaTitle(title) {
  const len = title?.length ?? 0;
  if (len >= META_TITLE_OPTIMAL_MIN && len <= META_TITLE_OPTIMAL_MAX) return 20;
  if (len > 0) return 10;
  return 0;
}

function scoreMetaDescription(desc) {
  const len = desc?.length ?? 0;
  if (len >= META_DESC_OPTIMAL_MIN && len <= META_DESC_OPTIMAL_MAX) return 20;
  if (len > 0) return 10;
  return 0;
}

function hasKeywords(data) {
  if (typeof data.metaKeywords === "string" && data.metaKeywords.trim().length > 0) return true;
  return Array.isArray(data.targetKeywords) && data.targetKeywords.length > 0;
}

function hasCompleteOg(data) {
  return (
    data.openGraphTitle?.trim()?.length > 0 &&
    data.openGraphDescription?.trim()?.length > 0 &&
    data.openGraphImage?.trim()?.length > 0
  );
}

export function computeSeoScore(data) {
  if (!data || typeof data !== "object") return 0;

  let score = 0;
  score += scoreMetaTitle(data.metaTitle);
  score += scoreMetaDescription(data.metaDescription);
  if (hasKeywords(data)) score += 10;
  if (data.thumbnail) score += 8;
  if (data.thumbnailAlt) score += 7;
  if (hasCompleteOg(data)) score += 15;
  if (data.slug?.trim()?.length > 0) score += 10;

  const content = data.content ?? data.description ?? "";
  if (content.length > CONTENT_LENGTH_THRESHOLD) score += 10;

  return Math.min(MAX_SCORE, score);
}

/**
 * Normalizes target keywords from various input formats into a JSON array.
 * @param {string|Array|null|undefined} raw
 * @returns {string[]}
 */
export function normalizeTargetKeywords(raw) {
  if (Array.isArray(raw)) return raw.filter((k) => typeof k === "string" && k.trim().length > 0);
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }
  return [];
}
