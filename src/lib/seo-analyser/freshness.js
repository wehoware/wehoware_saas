/**
 * Content freshness analysis module.
 *
 * Detects stale content, outdated date references, and missing
 * "last updated" indicators.
 */

import { stripHtml } from "./utils";

const STALE_MONTHS = parseInt(process.env.SEO_ANALYSER_FRESHNESS_STALE_MONTHS || "12", 10);
const CURRENT_YEAR = new Date().getFullYear();

/**
 * Analyze content freshness.
 * @param {Object} item - Content item with updatedAt, createdAt, content fields
 * @returns {{ isStale: boolean, monthsOld: number, outdatedDates: string[], outdatedStatistics: boolean, hasUpdatedIndicator: boolean }}
 */
export function analyzeFreshness(item) {
  const now = new Date();
  const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;
  const createdAt = item.createdAt ? new Date(item.createdAt) : null;
  const referenceDate = updatedAt || createdAt;

  let monthsOld = 0;
  let isStale = false;

  if (referenceDate) {
    monthsOld = (now.getFullYear() - referenceDate.getFullYear()) * 12 +
      (now.getMonth() - referenceDate.getMonth());
    isStale = monthsOld >= STALE_MONTHS;
  }

  // Check for outdated date references in content
  const text = stripHtml(item.content || "");
  const outdatedDates = [];
  const yearRegex = /\b(20\d{2})\b/g;
  let match;
  while ((match = yearRegex.exec(text)) !== null) {
    const year = parseInt(match[1], 10);
    if (year < CURRENT_YEAR - 2 && year > 2000) {
      outdatedDates.push(match[1]);
    }
  }

  // Check for outdated statistics references
  const outdatedStatistics = /\b(according to|study|research|survey|report)\b.*\b(20[0-1]\d|202[0-3])\b/i.test(text);

  // Check for visible "last updated" indicator
  const hasUpdatedIndicator = /\b(updated|revised|modified|last (updated|revised))\b/i.test(text) ||
    /<time[^>]*datetime=["'][^"']*["'][^>]*>/i.test(item.content || "");

  return {
    isStale,
    monthsOld,
    outdatedDates: [...new Set(outdatedDates)],
    outdatedStatistics,
    hasUpdatedIndicator,
  };
}

/**
 * Generate issues from freshness analysis.
 * @param {Object} metrics - Output of analyzeFreshness
 * @param {Object} item
 * @returns {Array}
 */
export function freshnessIssues(metrics, item) {
  const issues = [];

  if (metrics.isStale) {
    issues.push({
      category: "freshness",
      issueType: "stale_content",
      severity: "medium",
      title: "Content is stale",
      description: `Content was last updated ${metrics.monthsOld} months ago. Search engines favor fresh content. Consider updating with new information.`,
      currentValue: `${metrics.monthsOld} months old`,
      recommendedValue: "Update content regularly, at least every 12 months",
    });
  }

  if (metrics.outdatedDates.length > 0) {
    issues.push({
      category: "freshness",
      issueType: "outdated_dates",
      severity: "medium",
      title: "Outdated date references",
      description: `Content references past years: ${metrics.outdatedDates.join(", ")}. Update date references to current year.`,
      currentValue: metrics.outdatedDates.join(", "),
      recommendedValue: String(CURRENT_YEAR),
    });
  }

  if (metrics.outdatedStatistics) {
    issues.push({
      category: "freshness",
      issueType: "outdated_statistics",
      severity: "low",
      title: "Outdated statistics",
      description: "Content cites statistics that may be outdated (>2 years old). Update with recent data.",
      currentValue: "References old statistics",
      recommendedValue: "Update with current statistics and cite sources",
    });
  }

  if (!metrics.hasUpdatedIndicator && item.content && item.content.length > 500) {
    issues.push({
      category: "freshness",
      issueType: "no_updated_indicator",
      severity: "low",
      title: "No 'last updated' indicator",
      description: "Content doesn't show a visible 'last updated' date. Adding one helps users and search engines assess freshness.",
      currentValue: "No updated indicator",
      recommendedValue: "Add a visible 'Last updated: [date]' near the top of the content",
    });
  }

  return issues;
}
