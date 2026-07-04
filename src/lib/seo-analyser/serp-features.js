/**
 * SERP feature optimization module.
 *
 * Checks for People Also Ask targeting, featured snippet format,
 * table-eligible content, and list-eligible content.
 */

import { stripHtml, countTables, countLists, hasFaqPattern, extractFaqs } from "./utils";

/**
 * Analyze SERP feature opportunities.
 * @param {string} html
 * @returns {Object}
 */
export function analyzeSerpFeatures(html) {
  if (!html) {
    return {
      hasFaq: false,
      faqCount: 0,
      hasTables: false,
      tableCount: 0,
      hasLists: false,
      listCount: 0,
      hasSnippetParagraph: false,
      wordCount: 0,
    };
  }

  const text = stripHtml(html);
  const faqs = extractFaqs(html);
  const tableCount = countTables(html);
  const listCount = countLists(html);

  // Check for 40-60 word paragraphs (featured snippet bait)
  const paragraphs = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  const hasSnippetParagraph = paragraphs.some((p) => {
    const wordCount = stripHtml(p).split(/\s+/).filter(Boolean).length;
    return wordCount >= 40 && wordCount <= 60;
  });

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    hasFaq: faqs.length > 0 || hasFaqPattern(html),
    faqCount: faqs.length,
    hasTables: tableCount > 0,
    tableCount,
    hasLists: listCount > 0,
    listCount,
    hasSnippetParagraph,
    wordCount,
  };
}

/**
 * Generate issues from SERP feature analysis.
 * @param {Object} metrics
 * @returns {Array}
 */
export function serpFeatureIssues(metrics) {
  const issues = [];

  if (!metrics.hasFaq && metrics.wordCount > 300) {
    issues.push({
      category: "serp_features",
      issueType: "no_paa_targeting",
      severity: "low",
      title: "No People Also Ask targeting",
      description: "Content doesn't include FAQ patterns. Adding Q&A sections can capture PAA featured snippets.",
      currentValue: "No FAQ content",
      recommendedValue: "Add a FAQ section with 3-5 common questions and concise answers",
    });
  }

  if (!metrics.hasSnippetParagraph && metrics.wordCount > 300) {
    issues.push({
      category: "serp_features",
      issueType: "no_snippet_format",
      severity: "medium",
      title: "No featured snippet format",
      description: "Content lacks 40-60 word paragraphs that could be featured snippets. Add concise answer paragraphs.",
      currentValue: "No snippet-optimized paragraphs",
      recommendedValue: "Add 40-60 word paragraphs that directly answer questions",
    });
  }

  if (!metrics.hasTables && metrics.wordCount > 500) {
    issues.push({
      category: "serp_features",
      issueType: "no_table_content",
      severity: "low",
      title: "No table-eligible content",
      description: "Content has no HTML tables. Comparison/data tables can capture table featured snippets.",
      currentValue: "No tables",
      recommendedValue: "Add HTML tables for comparison or data presentation",
    });
  }

  if (!metrics.hasLists && metrics.wordCount > 300) {
    issues.push({
      category: "serp_features",
      issueType: "no_list_content",
      severity: "low",
      title: "No list-eligible content",
      description: "Content has no lists. Numbered or bulleted lists can capture list featured snippets.",
      currentValue: "No lists",
      recommendedValue: "Add numbered or bulleted lists for step-by-step or item content",
    });
  }

  return issues;
}
