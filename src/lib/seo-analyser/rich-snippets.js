/**
 * Rich snippets / Rich results schema validation.
 *
 * Checks for missing or incomplete structured data (JSON-LD)
 * for various schema.org types.
 */

import { extractJsonLd, hasFaqPattern, hasStepByStepPattern } from "./utils";

/**
 * Analyze rich snippet opportunities.
 * @param {Object} item - Content item with schemaType, content
 * @returns {Object}
 */
export function analyzeRichSnippets(item) {
  const jsonLdBlocks = extractJsonLd(item.content || "");
  const schemaTypes = jsonLdBlocks.map((b) => b["@type"] || "").flat();
  const hasFaq = hasFaqPattern(item.content || "");
  const hasHowTo = hasStepByStepPattern(item.content || "");
  const hasReview = /rating|review|stars/i.test(item.content || "");
  const isService = item.type === "service";
  const isInventory = item.type === "inventory";
  const isBlog = item.type === "blog";

  return {
    jsonLdCount: jsonLdBlocks.length,
    schemaTypes,
    hasFaq,
    hasHowTo,
    hasReview,
    isService,
    isInventory,
    isBlog,
    declaredSchema: item.schemaType || null,
  };
}

/**
 * Generate issues from rich snippet analysis.
 * @param {Object} metrics
 * @param {Object} item
 * @returns {Array}
 */
export function richSnippetIssues(metrics, item) {
  const issues = [];

  if (!metrics.declaredSchema) {
    issues.push({
      category: "rich_snippets",
      issueType: "missing_schema",
      severity: "high",
      title: "Missing schema type",
      description: "No schemaType set. Structured data helps search engines understand your content.",
      currentValue: "(not set)",
      recommendedValue: metrics.isBlog ? "BlogPosting" : metrics.isService ? "Service" : metrics.isInventory ? "Product" : "Article",
    });
  }

  if (metrics.isBlog && metrics.declaredSchema &&
      !["BlogPosting", "Article", "NewsArticle"].includes(metrics.declaredSchema)) {
    issues.push({
      category: "rich_snippets",
      issueType: "invalid_schema",
      severity: "medium",
      title: "Incorrect schema type for blog",
      description: `Schema type "${metrics.declaredSchema}" doesn't match blog content. Use BlogPosting or Article.`,
      currentValue: metrics.declaredSchema,
      recommendedValue: "BlogPosting",
    });
  }

  if (metrics.hasFaq && !metrics.schemaTypes.includes("FAQPage")) {
    issues.push({
      category: "rich_snippets",
      issueType: "missing_faqpage_schema",
      severity: "medium",
      title: "Missing FAQPage schema",
      description: "Content has FAQ patterns but no FAQPage JSON-LD schema. Adding it enables FAQ rich results.",
      currentValue: "No FAQPage schema",
      recommendedValue: 'Add <script type="application/ld+json"> with FAQPage schema',
    });
  }

  if (metrics.hasHowTo && !metrics.schemaTypes.includes("HowTo")) {
    issues.push({
      category: "rich_snippets",
      issueType: "missing_howto_schema",
      severity: "low",
      title: "Missing HowTo schema",
      description: "Content appears to be a step-by-step guide but lacks HowTo JSON-LD schema.",
      currentValue: "No HowTo schema",
      recommendedValue: 'Add <script type="application/ld+json"> with HowTo schema',
    });
  }

  if (metrics.isInventory && !metrics.schemaTypes.includes("Product")) {
    issues.push({
      category: "rich_snippets",
      issueType: "missing_product_schema",
      severity: "medium",
      title: "Missing Product schema",
      description: "Inventory item lacks Product schema. Adding it enables product rich results (price, availability).",
      currentValue: "No Product schema",
      recommendedValue: 'Add Product schema with price, availability, and name fields',
    });
  }

  if (metrics.isService && !metrics.schemaTypes.includes("Service")) {
    issues.push({
      category: "rich_snippets",
      issueType: "missing_service_schema",
      severity: "medium",
      title: "Missing Service schema",
      description: "Service lacks Service schema. Adding it enables service rich results.",
      currentValue: "No Service schema",
      recommendedValue: 'Add Service schema with provider, offers, and areaServed fields',
    });
  }

  if (metrics.hasReview && !metrics.schemaTypes.includes("Review")) {
    issues.push({
      category: "rich_snippets",
      issueType: "missing_review_schema",
      severity: "medium",
      title: "Missing Review schema",
      description: "Content mentions ratings/reviews but lacks Review JSON-LD schema.",
      currentValue: "No Review schema",
      recommendedValue: 'Add Review schema with ratingValue, author, and reviewBody',
    });
  }

  if (metrics.jsonLdCount === 0 && item.content && item.content.length > 500) {
    issues.push({
      category: "rich_snippets",
      issueType: "missing_breadcrumb_schema",
      severity: "low",
      title: "Missing BreadcrumbList schema",
      description: "No BreadcrumbList JSON-LD found. Breadcrumbs help search engines understand site structure.",
      currentValue: "No BreadcrumbList schema",
      recommendedValue: 'Add BreadcrumbList JSON-LD schema',
    });
  }

  return issues;
}
