/**
 * Rule-based SEO scanner.
 *
 * Performs all non-LLM checks on a content item and returns
 * a list of issues grouped by category.  Delegates to the
 * specialised analysis modules for advanced checks.
 */

import {
  stripHtml,
  extractHeadings,
  extractImages,
  extractLinks,
  countWords,
  countParagraphs,
  keywordDensity,
  hasFaqPattern,
} from "./utils";
import { analyzeReadability, readabilityIssues } from "./readability";
import { analyzeFreshness, freshnessIssues } from "./freshness";
import { analyzeTechnicalSeo, technicalSeoIssues } from "./technical-seo";
import { analyzeWebVitals, webVitalsIssues } from "./web-vitals";
import { analyzeRichSnippets, richSnippetIssues } from "./rich-snippets";
import { analyzeSerpFeatures, serpFeatureIssues } from "./serp-features";
import { analyzeMultimediaSeo, multimediaIssues } from "./multimedia-seo";

/**
 * Run all rule-based checks on a content item.
 *
 * @param {Object} item - Normalised content from content-fetcher
 * @param {Object} [settings] - WehowareSeoAnalyserSetting row (enables/disables checks)
 * @returns {{ issues: Array, metrics: Object }}
 */
export function runScanner(item, settings = {}) {
  const allIssues = [];
  const metrics = {};

  const html = item.content || "";
  const text = stripHtml(html);
  const wordCount = countWords(html);
  const headings = extractHeadings(html);
  const images = extractImages(html);
  const links = extractLinks(html);

  // ── Meta tags ──────────────────────────────────────────────
  if (settings.checkMetaTags !== false) {
    allIssues.push(...checkMetaTags(item, wordCount));
  }

  // ── Open Graph / Twitter ───────────────────────────────────
  if (settings.checkOpenGraph !== false) {
    allIssues.push(...checkOpenGraph(item));
  }
  if (settings.checkTwitterCards !== false) {
    allIssues.push(...checkTwitterCards(item));
  }

  // ── Canonical / robots ─────────────────────────────────────
  if (settings.checkCanonical !== false) {
    allIssues.push(...checkCanonical(item));
  }
  if (settings.checkRobotsMeta !== false) {
    allIssues.push(...checkRobotsMeta(item));
  }

  // ── Heading structure ──────────────────────────────────────
  if (settings.checkHeadingStructure !== false) {
    allIssues.push(...checkHeadings(headings));
  }

  // ── Image alt ──────────────────────────────────────────────
  if (settings.checkImageAlt !== false) {
    allIssues.push(...checkImageAlt(images));
  }

  // ── Content structure ──────────────────────────────────────
  if (settings.checkContentStructure !== false) {
    allIssues.push(...checkContentStructure(html, wordCount, countParagraphs(html)));
  }

  // ── Keyword usage ──────────────────────────────────────────
  if (settings.checkKeywordUsage !== false) {
    allIssues.push(...checkKeywordUsage(item, text));
  }

  // ── E-E-A-T signals ────────────────────────────────────────
  if (settings.checkEeat !== false) {
    const eeat = checkEeat(item, text);
    metrics.eeat = eeat.metrics;
    allIssues.push(...eeat.issues);
  }

  // ── Readability ────────────────────────────────────────────
  if (settings.checkReadability !== false) {
    const read = analyzeReadability(html);
    metrics.readability = read;
    allIssues.push(...readabilityIssues(read));
  }

  // ── Freshness ──────────────────────────────────────────────
  if (settings.checkContentFreshness !== false) {
    const fresh = analyzeFreshness(item);
    metrics.freshness = fresh;
    allIssues.push(...freshnessIssues(fresh, item));
  }

  // ── Technical SEO ──────────────────────────────────────────
  if (settings.checkUrlOptimization !== false || settings.checkIndexability !== false || settings.checkHttps !== false) {
    const tech = analyzeTechnicalSeo(item);
    metrics.technicalSeo = tech;
    allIssues.push(...technicalSeoIssues(tech, item));
  }

  // ── Web vitals ─────────────────────────────────────────────
  if (settings.checkWebVitals !== false) {
    const wv = analyzeWebVitals(html);
    metrics.webVitals = wv;
    allIssues.push(...webVitalsIssues(wv));
  }

  // ── Rich snippets ──────────────────────────────────────────
  if (settings.checkRichSnippets !== false) {
    const rs = analyzeRichSnippets(item);
    metrics.richSnippets = rs;
    allIssues.push(...richSnippetIssues(rs, item));
  }

  // ── SERP features ──────────────────────────────────────────
  if (settings.checkSerpFeatures !== false) {
    const serp = analyzeSerpFeatures(html);
    metrics.serpFeatures = serp;
    allIssues.push(...serpFeatureIssues(serp));
  }

  // ── Multimedia ─────────────────────────────────────────────
  if (settings.checkMultimediaSeo !== false) {
    const mm = analyzeMultimediaSeo(html);
    metrics.multimedia = mm;
    allIssues.push(...multimediaIssues(mm));
  }

  // ── Internal links (basic — full graph in analyser.js) ─────
  if (settings.checkInternalLinks !== false) {
    allIssues.push(...checkInternalLinks(links));
  }

  // ── Schema type ────────────────────────────────────────────
  if (settings.checkSchema !== false) {
    allIssues.push(...checkSchema(item));
  }

  // ── AEO (Answer Engine Optimization) ───────────────────────
  if (settings.checkAeo !== false) {
    allIssues.push(...checkAeo(item, text));
  }

  // ── GEO (Generative Engine Optimization) ───────────────────
  if (settings.checkGeo !== false) {
    allIssues.push(...checkGeo(item, text));
  }

  // ── SXO (Search Experience Optimization) ───────────────────
  if (settings.checkSxo !== false) {
    allIssues.push(...checkSxo(item, text, headings));
  }

  return { issues: allIssues, metrics };
}

// ──────────────────────────────────────────────────────────────
// Individual check functions
// ──────────────────────────────────────────────────────────────

function checkMetaTags(item, wordCount) {
  const issues = [];
  const title = item.metaTitle || "";
  const desc = item.metaDescription || "";
  const keywords = item.metaKeywords || "";

  if (!title) {
    issues.push({
      category: "meta_title",
      issueType: "missing_meta_title",
      severity: "critical",
      title: "Missing meta title",
      description: "No meta title set. This is the most important on-page SEO element.",
      currentValue: "(not set)",
      recommendedValue: `Write a compelling title (50-60 chars) including primary keyword for "${item.title || "this page"}"`,
    });
  } else {
    if (title.length < 30) {
      issues.push({
        category: "meta_title",
        issueType: "meta_title_too_short",
        severity: "warning",
        title: "Meta title too short",
        description: `Meta title is ${title.length} characters. Aim for 50-60 characters.`,
        currentValue: title,
        recommendedValue: "Expand to 50-60 characters with keywords",
      });
    }
    if (title.length > 60) {
      issues.push({
        category: "meta_title",
        issueType: "meta_title_too_long",
        severity: "warning",
        title: "Meta title too long",
        description: `Meta title is ${title.length} characters. Search engines truncate at ~60 characters.`,
        currentValue: title,
        recommendedValue: title.substring(0, 60),
      });
    }
  }

  if (!desc) {
    issues.push({
      category: "meta_description",
      issueType: "missing_meta_description",
      severity: "critical",
      title: "Missing meta description",
      description: "No meta description set. This appears in search results and affects click-through rate.",
      currentValue: "(not set)",
      recommendedValue: "Write a compelling description (150-160 chars) with target keywords",
    });
  } else {
    if (desc.length < 70) {
      issues.push({
        category: "meta_description",
        issueType: "meta_desc_too_short",
        severity: "warning",
        title: "Meta description too short",
        description: `Meta description is ${desc.length} characters. Aim for 150-160 characters.`,
        currentValue: desc,
        recommendedValue: "Expand to 150-160 characters",
      });
    }
    if (desc.length > 160) {
      issues.push({
        category: "meta_description",
        issueType: "meta_desc_too_long",
        severity: "warning",
        title: "Meta description too long",
        description: `Meta description is ${desc.length} characters. Search engines truncate at ~160 characters.`,
        currentValue: desc,
        recommendedValue: desc.substring(0, 160),
      });
    }
  }

  if (!keywords && wordCount > 100) {
    issues.push({
      category: "meta_keywords",
      issueType: "missing_meta_keywords",
      severity: "info",
      title: "No meta keywords set",
      description: "While meta keywords have minimal SEO value, some search engines still reference them.",
      currentValue: "(not set)",
      recommendedValue: "Add 3-5 relevant keywords",
    });
  }

  return issues;
}

function checkOpenGraph(item) {
  const issues = [];

  if (!item.openGraphTitle) {
    issues.push({
      category: "social",
      issueType: "missing_og_title",
      severity: "warning",
      title: "Missing Open Graph title",
      description: "No og:title set. This controls how the page appears when shared on Facebook/LinkedIn.",
      currentValue: "(not set)",
      recommendedValue: item.metaTitle || "Set an engaging title for social sharing",
    });
  }

  if (!item.openGraphDescription) {
    issues.push({
      category: "social",
      issueType: "missing_og_description",
      severity: "warning",
      title: "Missing Open Graph description",
      description: "No og:description set. This appears in social media link previews.",
      currentValue: "(not set)",
      recommendedValue: item.metaDescription || "Set a description for social sharing",
    });
  }

  if (!item.openGraphImage) {
    issues.push({
      category: "social",
      issueType: "missing_og_image",
      severity: "warning",
      title: "Missing Open Graph image",
      description: "No og:image set. Social shares will lack a preview image.",
      currentValue: "(not set)",
      recommendedValue: "Add a 1200x630px image URL for social sharing",
    });
  }

  return issues;
}

function checkTwitterCards(item) {
  const issues = [];

  if (!item.twitterTitle && !item.openGraphTitle) {
    issues.push({
      category: "social",
      issueType: "missing_twitter_title",
      severity: "info",
      title: "Missing Twitter card title",
      description: "No twitter:title or og:title set. Twitter shares will lack a proper title.",
      currentValue: "(not set)",
      recommendedValue: "Set twitter:title or ensure og:title is set",
    });
  }

  if (!item.twitterDescription && !item.openGraphDescription) {
    issues.push({
      category: "social",
      issueType: "missing_twitter_description",
      severity: "info",
      title: "Missing Twitter card description",
      description: "No twitter:description or og:description set.",
      currentValue: "(not set)",
      recommendedValue: "Set twitter:description or ensure og:description is set",
    });
  }

  return issues;
}

function checkCanonical(item) {
  const issues = [];

  if (!item.canonicalUrl) {
    issues.push({
      category: "technical",
      issueType: "missing_canonical",
      severity: "warning",
      title: "Missing canonical URL",
      description: "No canonical URL set. This can cause duplicate content issues.",
      currentValue: "(not set)",
      recommendedValue: `https://yoursite.com/${item.slug || ""}`,
    });
  }

  return issues;
}

function checkRobotsMeta(item) {
  const issues = [];
  const robots = item.robotsMeta || "";

  if (/noindex/i.test(robots)) {
    issues.push({
      category: "technical",
      issueType: "noindex_set",
      severity: "critical",
      title: "noindex directive detected",
      description: "robotsMeta contains 'noindex', preventing indexing.",
      currentValue: robots,
      recommendedValue: "index, follow",
    });
  }

  if (/nofollow/i.test(robots)) {
    issues.push({
      category: "technical",
      issueType: "nofollow_set",
      severity: "warning",
      title: "nofollow directive detected",
      description: "robotsMeta contains 'nofollow', preventing link following.",
      currentValue: robots,
      recommendedValue: "index, follow",
    });
  }

  return issues;
}

function checkHeadings(headings) {
  const issues = [];

  if (headings.length === 0) {
    issues.push({
      category: "headings",
      issueType: "no_headings",
      severity: "warning",
      title: "No headings found",
      description: "Content has no H1-H6 headings. Headings improve readability and SEO.",
      currentValue: "0 headings",
      recommendedValue: "Add at least one H1 and several H2/H3 headings",
    });
    return issues;
  }

  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length === 0) {
    issues.push({
      category: "headings",
      issueType: "missing_h1",
      severity: "critical",
      title: "Missing H1 heading",
      description: "No H1 heading found. Every page should have exactly one H1.",
      currentValue: "0 H1 tags",
      recommendedValue: "Add exactly one H1 heading with the primary keyword",
    });
  }
  if (h1s.length > 1) {
    issues.push({
      category: "headings",
      issueType: "multiple_h1",
      severity: "warning",
      title: "Multiple H1 headings",
      description: `${h1s.length} H1 headings found. Use only one H1 per page.`,
      currentValue: `${h1s.length} H1 tags`,
      recommendedValue: "Use only one H1 heading",
    });
  }

  // Check heading hierarchy
  let prevLevel = 0;
  for (const h of headings) {
    if (prevLevel > 0 && h.level > prevLevel + 1) {
      issues.push({
        category: "headings",
        issueType: "heading_hierarchy_skip",
        severity: "info",
        title: `Heading hierarchy skip: H${prevLevel} → H${h.level}`,
        description: `Heading level jumps from H${prevLevel} to H${h.level}. Maintain sequential heading order.`,
        currentValue: `H${prevLevel} → H${h.level}`,
        recommendedValue: `Use H${prevLevel + 1} instead of H${h.level}`,
      });
    }
    prevLevel = h.level;
  }

  // Check for empty headings
  const emptyHeadings = headings.filter((h) => !h.text || h.text.trim().length === 0);
  if (emptyHeadings.length > 0) {
    issues.push({
      category: "headings",
      issueType: "empty_headings",
      severity: "warning",
      title: "Empty heading tags",
      description: `${emptyHeadings.length} heading(s) have no text content.`,
      currentValue: `${emptyHeadings.length} empty headings`,
      recommendedValue: "Add text to all heading tags",
    });
  }

  return issues;
}

function checkImageAlt(images) {
  const issues = [];

  if (images.length === 0) return issues;

  const missingAlt = images.filter((img) => !img.alt);
  if (missingAlt.length > 0) {
    issues.push({
      category: "images",
      issueType: "missing_alt_text",
      severity: "critical",
      title: "Missing image alt text",
      description: `${missingAlt.length} of ${images.length} image(s) lack alt text. Alt text is essential for accessibility and SEO.`,
      currentValue: `${missingAlt.length} images without alt`,
      recommendedValue: "Add descriptive alt text to all images",
    });
  }

  return issues;
}

function checkContentStructure(html, wordCount, paragraphCount) {
  const issues = [];

  if (wordCount < 300) {
    issues.push({
      category: "content",
      issueType: "thin_content",
      severity: "warning",
      title: "Thin content",
      description: `Content has only ${wordCount} words. Aim for at least 300 words for comprehensive coverage.`,
      currentValue: `${wordCount} words`,
      recommendedValue: "300+ words",
    });
  }

  if (wordCount < 100) {
    issues.push({
      category: "content",
      issueType: "very_thin_content",
      severity: "critical",
      title: "Very thin content",
      description: `Content has only ${wordCount} words. This is too little for search engines to understand the page.`,
      currentValue: `${wordCount} words`,
      recommendedValue: "At least 300 words, ideally 600+",
    });
  }

  if (paragraphCount < 2 && wordCount > 100) {
    issues.push({
      category: "content",
      issueType: "poor_paragraph_structure",
      severity: "info",
      title: "Poor paragraph structure",
      description: "Content has very few paragraphs. Break content into readable paragraphs.",
      currentValue: `${paragraphCount} paragraphs`,
      recommendedValue: "Multiple short paragraphs (2-4 sentences each)",
    });
  }

  return issues;
}

function checkKeywordUsage(item, text) {
  const issues = [];
  const keywords = item.targetKeywords || [];

  if (keywords.length === 0) return issues;

  for (const keyword of keywords) {
    const density = keywordDensity(text, keyword);
    if (density < 0.5) {
      issues.push({
        category: "keyword_usage",
        issueType: "low_keyword_density",
        severity: "warning",
        title: `Low keyword density: "${keyword}"`,
        description: `Keyword "${keyword}" appears with ${density.toFixed(1)}% density. Aim for 1-3%.`,
        currentValue: `${density.toFixed(1)}%`,
        recommendedValue: "1-3% density",
      });
    }
    if (density > 5) {
      issues.push({
        category: "keyword_usage",
        issueType: "keyword_stuffing",
        severity: "warning",
        title: `Keyword stuffing: "${keyword}"`,
        description: `Keyword "${keyword}" appears with ${density.toFixed(1)}% density. This may be flagged as keyword stuffing.`,
        currentValue: `${density.toFixed(1)}%`,
        recommendedValue: "Reduce to 1-3% density",
      });
    }
  }

  // Check if primary keyword is in title
  const titleLower = (item.title || "").toLowerCase();
  const primaryKw = keywords[0]?.toLowerCase();
  if (primaryKw && !titleLower.includes(primaryKw)) {
    issues.push({
      category: "keyword_usage",
      issueType: "keyword_not_in_title",
      severity: "warning",
      title: "Primary keyword not in title",
      description: `Primary keyword "${keywords[0]}" is not in the content title.`,
      currentValue: item.title || "",
      recommendedValue: `Include "${keywords[0]}" in the title`,
    });
  }

  return issues;
}

function checkEeat(item, text) {
  const issues = [];
  const metrics = {};

  // Author / byline
  const hasAuthor = /\b(by|author|written by)\b/i.test(text) || !!item.author;
  metrics.hasAuthor = hasAuthor;
  if (!hasAuthor) {
    issues.push({
      category: "eeat",
      issueType: "missing_author",
      severity: "info",
      title: "No visible author attribution",
      description: "Content lacks author attribution. Adding author info improves E-E-A-T signals.",
      currentValue: "No author",
      recommendedValue: "Add author name and bio",
    });
  }

  // Citations / sources
  const hasCitations = /\b(source|according to|cite|reference|study|research)\b/i.test(text);
  metrics.hasCitations = hasCitations;
  if (!hasCitations && text.length > 500) {
    issues.push({
      category: "eeat",
      issueType: "no_citations",
      severity: "info",
      title: "No citations or sources",
      description: "Content doesn't cite sources. Adding citations improves trustworthiness (E-E-A-T).",
      currentValue: "No citations",
      recommendedValue: "Add citations or links to authoritative sources",
    });
  }

  // Expertise signals
  const hasExpertise = /\b(expert|professional|certified|licensed|experience|specialist)\b/i.test(text);
  metrics.hasExpertise = hasExpertise;
  if (!hasExpertise && text.length > 500) {
    issues.push({
      category: "eeat",
      issueType: "no_expertise_signals",
      severity: "info",
      title: "No expertise signals",
      description: "Content lacks expertise indicators. Mention qualifications or experience to boost E-E-A-T.",
      currentValue: "No expertise signals",
      recommendedValue: "Add author credentials or expertise indicators",
    });
  }

  // Trust signals (contact, privacy, disclaimer)
  const hasTrustSignals = /\b(contact|privacy|disclaimer|terms|policy)\b/i.test(text);
  metrics.hasTrustSignals = hasTrustSignals;

  return { issues, metrics };
}

function checkInternalLinks(links) {
  const issues = [];

  const internalLinks = links.filter((l) => l.href.startsWith("/") || (l.href.startsWith("#") === false && !l.href.startsWith("http")));
  if (internalLinks.length === 0 && links.length === 0) {
    issues.push({
      category: "links",
      issueType: "no_internal_links",
      severity: "warning",
      title: "No internal links",
      description: "Content has no internal links. Internal links help search engines discover content.",
      currentValue: "0 internal links",
      recommendedValue: "Add 3+ internal links to related content",
    });
  }

  return issues;
}

function checkSchema(item) {
  const issues = [];

  if (!item.schemaType) {
    issues.push({
      category: "schema",
      issueType: "missing_schema_type",
      severity: "warning",
      title: "Missing schema type",
      description: "No schemaType set. Structured data helps search engines understand content.",
      currentValue: "(not set)",
      recommendedValue: item.type === "blog" ? "BlogPosting" : item.type === "service" ? "Service" : "Article",
    });
  }

  return issues;
}

function checkAeo(item, text) {
  const issues = [];

  // AEO: direct answer format
  const hasDirectAnswer = text.length > 40 && text.length < 200 && /\./.test(text.substring(0, 200));
  const hasFaq = hasFaqPattern(item.content || "");

  if (!hasDirectAnswer && !hasFaq && text.length > 300) {
    issues.push({
      category: "aeo",
      issueType: "no_direct_answer",
      severity: "info",
      title: "No direct answer format",
      description: "Content lacks a concise direct answer paragraph (40-60 words) for answer engines.",
      currentValue: "No direct answer",
      recommendedValue: "Add a 40-60 word paragraph that directly answers the main question",
    });
  }

  return issues;
}

function checkGeo(item, text) {
  const issues = [];

  // GEO: citations, structured data, clear facts
  const hasStructuredFacts = /\b(\d+%|\$[\d,]+|\d{4}|\d+ (people|users|customers))\b/i.test(text);
  if (!hasStructuredFacts && text.length > 300) {
    issues.push({
      category: "geo",
      issueType: "no_structured_facts",
      severity: "info",
      title: "No structured facts for generative AI",
      description: "Content lacks specific facts/figures. Generative engines favor content with concrete data.",
      currentValue: "No structured facts",
      recommendedValue: "Add specific statistics, dates, or numerical facts",
    });
  }

  return issues;
}

function checkSxo(item, text, headings) {
  const issues = [];

  // SXO: search experience — clear structure, scannable content
  const hasTableOfContents = headings.length > 3 && /<h2/i.test(item.content || "");
  if (!hasTableOfContents && headings.length > 5) {
    issues.push({
      category: "sxo",
      issueType: "no_toc",
      severity: "info",
      title: "No table of contents",
      description: "Content has many headings but no table of contents. A TOC improves search experience.",
      currentValue: "No TOC",
      recommendedValue: "Add a table of contents at the top of the content",
    });
  }

  // Check for intro/summary
  const firstParagraph = text.substring(0, 300).toLowerCase();
  const hasIntro = /\b(introduction|overview|summary|in this|this (article|guide|post))\b/i.test(firstParagraph);
  if (!hasIntro && text.length > 500) {
    issues.push({
      category: "sxo",
      issueType: "no_intro",
      severity: "info",
      title: "No clear introduction",
      description: "Content lacks a clear introduction. An intro helps users and search engines understand the page.",
      currentValue: "No introduction",
      recommendedValue: "Add a brief introduction (2-3 sentences) at the top",
    });
  }

  return issues;
}
