/**
 * Duplicate content detection module.
 *
 * Uses Jaccard similarity on shingled text to detect
 * internal duplicates and near-duplicates efficiently.
 */

import { stripHtml } from "./utils";

const SHINGLE_SIZE = 3;
const DUPLICATE_THRESHOLD = parseFloat(
  process.env.SEO_ANALYSER_DUPLICATE_SIMILARITY_THRESHOLD || "0.80"
);
const NEAR_DUPLICATE_THRESHOLD = parseFloat(
  process.env.SEO_ANALYSER_NEAR_DUPLICATE_THRESHOLD || "0.60"
);
const MAX_ITEMS = 500;

/**
 * Create shingles (n-grams) from text.
 * @param {string} text
 * @param {number} k
 * @returns {Set<string>}
 */
function shingle(text, k = SHINGLE_SIZE) {
  const words = stripHtml(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < k) return new Set(words);
  const shingles = new Set();
  for (let i = 0; i <= words.length - k; i++) {
    shingles.add(words.slice(i, i + k).join(" "));
  }
  return shingles;
}

/**
 * Compute Jaccard similarity between two sets.
 * @param {Set} a
 * @param {Set} b
 * @returns {number}
 */
function jaccardSimilarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

/**
 * Detect duplicate and near-duplicate content.
 * @param {Array<{id: string, title: string, slug: string, content: string, type: string}>} items
 * @returns {{ duplicates: Array, nearDuplicates: Array, duplicateMetaTitles: Array, duplicateMetaDescs: Array }}
 */
export function detectDuplicates(items) {
  const capped = items.slice(0, MAX_ITEMS);

  // Shingle all items
  const shingled = capped.map((item) => ({
    ...item,
    shingles: shingle(item.content || ""),
  }));

  const duplicates = [];
  const nearDuplicates = [];

  // Compare all pairs
  for (let i = 0; i < shingled.length; i++) {
    for (let j = i + 1; j < shingled.length; j++) {
      const sim = jaccardSimilarity(shingled[i].shingles, shingled[j].shingles);
      if (sim >= DUPLICATE_THRESHOLD) {
        duplicates.push({
          itemA: { id: shingled[i].id, title: shingled[i].title, type: shingled[i].type },
          itemB: { id: shingled[j].id, title: shingled[j].title, type: shingled[j].type },
          similarity: Math.round(sim * 100) / 100,
        });
      } else if (sim >= NEAR_DUPLICATE_THRESHOLD) {
        nearDuplicates.push({
          itemA: { id: shingled[i].id, title: shingled[i].title, type: shingled[i].type },
          itemB: { id: shingled[j].id, title: shingled[j].title, type: shingled[j].type },
          similarity: Math.round(sim * 100) / 100,
        });
      }
    }
  }

  // Check duplicate meta titles
  const metaTitleMap = new Map();
  const duplicateMetaTitles = [];
  for (const item of capped) {
    if (!item.metaTitle) continue;
    const key = item.metaTitle.toLowerCase().trim();
    if (!metaTitleMap.has(key)) {
      metaTitleMap.set(key, []);
    }
    metaTitleMap.get(key).push({ id: item.id, title: item.title, type: item.type });
  }
  for (const [metaTitle, group] of metaTitleMap) {
    if (group.length > 1) {
      duplicateMetaTitles.push({ metaTitle, items: group });
    }
  }

  // Check duplicate meta descriptions
  const metaDescMap = new Map();
  const duplicateMetaDescs = [];
  for (const item of capped) {
    if (!item.metaDescription) continue;
    const key = item.metaDescription.toLowerCase().trim();
    if (!metaDescMap.has(key)) {
      metaDescMap.set(key, []);
    }
    metaDescMap.get(key).push({ id: item.id, title: item.title, type: item.type });
  }
  for (const [metaDesc, group] of metaDescMap) {
    if (group.length > 1) {
      duplicateMetaDescs.push({ metaDescription: metaDesc, items: group });
    }
  }

  return { duplicates, nearDuplicates, duplicateMetaTitles, duplicateMetaDescs };
}

/**
 * Generate issues from duplicate detection.
 * @param {Object} results
 * @returns {Array}
 */
export function duplicateIssues(results) {
  const issues = [];

  for (const dup of results.duplicates) {
    issues.push({
      category: "duplicate_content",
      issueType: "internal_duplicate",
      severity: "high",
      title: `Duplicate content: "${dup.itemA.title}" and "${dup.itemB.title}"`,
      description: `These two items have ${dup.similarity * 100}% similar content. Consider merging or differentiating them.`,
      currentValue: `${dup.similarity * 100}% similar`,
      recommendedValue: "Rewrite one item to make it unique, or merge the two items",
    });
  }

  for (const near of results.nearDuplicates) {
    issues.push({
      category: "duplicate_content",
      issueType: "near_duplicate",
      severity: "medium",
      title: `Near-duplicate content: "${near.itemA.title}" and "${near.itemB.title}"`,
      description: `These items have ${near.similarity * 100}% similar content. Consider differentiating them further.`,
      currentValue: `${near.similarity * 100}% similar`,
      recommendedValue: "Add unique sections, different examples, or expand each item's coverage",
    });
  }

  for (const dup of results.duplicateMetaTitles) {
    issues.push({
      category: "duplicate_content",
      issueType: "duplicate_meta_title",
      severity: "high",
      title: `Duplicate meta title: "${dup.metaTitle}"`,
      description: `${dup.items.length} items share the same meta title. Each page should have a unique title.`,
      currentValue: dup.metaTitle,
      recommendedValue: "Write unique meta titles for each page",
    });
  }

  for (const dup of results.duplicateMetaDescs) {
    issues.push({
      category: "duplicate_content",
      issueType: "duplicate_meta_desc",
      severity: "medium",
      title: `Duplicate meta description`,
      description: `${dup.items.length} items share the same meta description. Each page should have a unique description.`,
      currentValue: dup.metaDescription,
      recommendedValue: "Write unique meta descriptions for each page",
    });
  }

  return issues;
}
