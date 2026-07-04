/**
 * Shared utilities for the SEO analyser.
 *
 * HTML parsing helpers, slug validation, text extraction, and common
 * functions used across scanner, readability, technical-seo, etc.
 */

/**
 * Extract text content from HTML (strip tags).
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract all headings from HTML content.
 * @param {string} html
 * @returns {Array<{level: number, text: string}>}
 */
export function extractHeadings(html) {
  if (!html) return [];
  const headings = [];
  const regex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1], 10),
      text: stripHtml(match[2]),
    });
  }
  return headings;
}

/**
 * Extract all images from HTML content.
 * @param {string} html
 * @returns {Array<{src: string, alt: string|null, width: string|null, height: string|null, title: string|null}>}
 */
export function extractImages(html) {
  if (!html) return [];
  const images = [];
  const regex = /<img[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const img = match[0];
    const src = getAttr(img, "src");
    const alt = getAttr(img, "alt");
    const width = getAttr(img, "width");
    const height = getAttr(img, "height");
    const title = getAttr(img, "title");
    const loading = getAttr(img, "loading");
    images.push({ src, alt, width, height, title, loading });
  }
  return images;
}

/**
 * Extract all links from HTML content.
 * @param {string} html
 * @returns {Array<{href: string, text: string, rel: string|null, target: string|null}>}
 */
export function extractLinks(html) {
  if (!html) return [];
  const links = [];
  const regex = /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];
    links.push({
      href: match[1],
      text: stripHtml(match[2]),
      rel: getAttr(tag, "rel"),
      target: getAttr(tag, "target"),
    });
  }
  return links;
}

/**
 * Get an attribute value from an HTML tag string.
 * @param {string} tag
 * @param {string} attr
 * @returns {string|null}
 */
function getAttr(tag, attr) {
  const regex = new RegExp(`\\s${attr}=["']([^"']*)["']`, "i");
  const match = tag.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract all <ul> and <ol> lists from HTML.
 * @param {string} html
 * @returns {number}
 */
export function countLists(html) {
  if (!html) return 0;
  const ulCount = (html.match(/<ul[^>]*>/gi) || []).length;
  const olCount = (html.match(/<ol[^>]*>/gi) || []).length;
  return ulCount + olCount;
}

/**
 * Extract all <table> elements from HTML.
 * @param {string} html
 * @returns {number}
 */
export function countTables(html) {
  if (!html) return 0;
  return (html.match(/<table[^>]*>/gi) || []).length;
}

/**
 * Count words in HTML content.
 * @param {string} html
 * @returns {number}
 */
export function countWords(html) {
  const text = stripHtml(html);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Validate a slug format.
 * @param {string} slug
 * @returns {{valid: boolean, issues: string[]}}
 */
export function validateSlug(slug) {
  const issues = [];
  if (!slug) {
    return { valid: false, issues: ["missing_slug"] };
  }
  if (slug.length > 75) {
    issues.push("url_too_long");
  }
  if (slug.includes("_")) {
    issues.push("url_underscores");
  }
  if (slug !== slug.toLowerCase()) {
    issues.push("url_uppercase");
  }
  if (!slug.match(/^[a-z0-9-]+$/)) {
    issues.push("url_special_chars");
  }
  return { valid: issues.length === 0, issues };
}

/**
 * Extract internal links (hrefs that look like relative paths or same-domain).
 * @param {Array} links - Output of extractLinks()
 * @param {string} [domain] - Optional domain to match
 * @returns {Array}
 */
export function filterInternalLinks(links, domain) {
  return links.filter((link) => {
    const href = link.href || "";
    if (href.startsWith("/")) return true;
    if (href.startsWith("#")) return false;
    if (href.startsWith("http") && domain) {
      try {
        const url = new URL(href);
        return url.hostname === domain;
      } catch {
        return false;
      }
    }
    return false;
  });
}

/**
 * Extract external links.
 * @param {Array} links
 * @returns {Array}
 */
export function filterExternalLinks(links) {
  return links.filter((link) => {
    const href = link.href || "";
    return href.startsWith("http") || href.startsWith("https");
  });
}

/**
 * Check if content has FAQ-like patterns.
 * @param {string} html
 * @returns {boolean}
 */
export function hasFaqPattern(html) {
  if (!html) return false;
  const text = stripHtml(html).toLowerCase();
  return /\b(faq|frequently asked questions|q:|a:)\b/.test(text) ||
    /<h[2-4][^>]*>.*\?.*<\/h[2-4]>/i.test(html);
}

/**
 * Check if content has step-by-step patterns.
 * @param {string} html
 * @returns {boolean}
 */
export function hasStepByStepPattern(html) {
  if (!html) return false;
  const olCount = (html.match(/<ol[^>]*>/gi) || []).length;
  const text = stripHtml(html).toLowerCase();
  return olCount > 0 || /\b(step \d|how to|guide|tutorial)\b/.test(text);
}

/**
 * Truncate text to a max length.
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
export function truncate(text, max = 8000) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.substring(0, max) + "...";
}

/**
 * Generate a UUID v4 (fallback if crypto.randomUUID is not available).
 * @returns {string}
 */
export function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Calculate keyword density in content.
 * @param {string} text - Plain text (not HTML)
 * @param {string} keyword
 * @returns {number} - Percentage (0-100)
 */
export function keywordDensity(text, keyword) {
  if (!text || !keyword) return 0;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const keywordLower = keyword.toLowerCase();
  const matches = words.filter((w) => w.toLowerCase().includes(keywordLower)).length;
  return (matches / words.length) * 100;
}

/**
 * Check if a URL uses HTTPS.
 * @param {string} url
 * @returns {boolean}
 */
export function isHttps(url) {
  if (!url) return false;
  return url.startsWith("https://");
}

/**
 * Detect mixed content (HTTP resources in HTTPS page).
 * @param {string} html
 * @returns {boolean}
 */
export function hasMixedContent(html) {
  if (!html) return false;
  return /src=["']http:\/\//i.test(html) || /href=["']http:\/\//i.test(html);
}

/**
 * Count paragraphs in HTML.
 * @param {string} html
 * @returns {number}
 */
export function countParagraphs(html) {
  if (!html) return 0;
  return (html.match(/<p[^>]*>/gi) || []).length;
}

/**
 * Extract all FAQ question-answer pairs from HTML.
 * Looks for heading + paragraph patterns or structured FAQ blocks.
 * @param {string} html
 * @returns {Array<{question: string, answer: string}>}
 */
export function extractFaqs(html) {
  if (!html) return [];
  const faqs = [];
  const regex = /<h([2-4])[^>]*>([^<]*\?[^<]*)<\/h\1>\s*(?:<p[^>]*>([\s\S]*?)<\/p>|<div[^>]*>([\s\S]*?)<\/div>)/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    faqs.push({
      question: stripHtml(match[2]),
      answer: stripHtml(match[3] || match[4] || ""),
    });
  }
  return faqs;
}

/**
 * Check if HTML contains JSON-LD script tags.
 * @param {string} html
 * @returns {Array<Object>}
 */
export function extractJsonLd(html) {
  if (!html) return [];
  const blocks = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // Invalid JSON-LD, skip
    }
  }
  return blocks;
}

/**
 * Count sentences in plain text.
 * @param {string} text
 * @returns {number}
 */
export function countSentences(text) {
  if (!text) return 0;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return sentences.length;
}

/**
 * Count syllables in a word (approximation).
 * @param {string} word
 * @returns {number}
 */
export function countSyllables(word) {
  if (!word) return 0;
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  const matches = trimmed.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}
