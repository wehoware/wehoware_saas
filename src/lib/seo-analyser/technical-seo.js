/**
 * Technical SEO analysis module.
 *
 * URL optimization, indexability, page depth, HTTPS, mixed content.
 */

import { validateSlug, hasMixedContent, isHttps, filterExternalLinks, extractLinks } from "./utils";

/**
 * Analyze technical SEO aspects of a content item.
 * @param {Object} item - Normalized content item
 * @returns {Object}
 */
export function analyzeTechnicalSeo(item) {
  const slugIssues = validateSlug(item.slug);
  const links = extractLinks(item.content || "");
  const externalLinks = filterExternalLinks(links);
  const hasMixed = hasMixedContent(item.content || "");
  const canonicalHttps = item.canonicalUrl ? isHttps(item.canonicalUrl) : null;
  const robotsMeta = item.robotsMeta || "";

  return {
    slugIssues: slugIssues.issues,
    hasNoindex: /noindex/i.test(robotsMeta),
    hasCanonical: !!item.canonicalUrl,
    canonicalHttps,
    hasMixedContent: hasMixed,
    externalLinksCount: externalLinks.length,
    nonHttpsLinks: externalLinks.filter((l) => l.href.startsWith("http://")).length,
  };
}

/**
 * Generate issues from technical SEO analysis.
 * @param {Object} metrics
 * @param {Object} item
 * @returns {Array}
 */
export function technicalSeoIssues(metrics, item) {
  const issues = [];

  // URL optimization
  for (const slugIssue of metrics.slugIssues) {
    const severityMap = {
      url_too_long: "low",
      url_underscores: "low",
      url_uppercase: "low",
      url_special_chars: "medium",
      missing_slug: "critical",
    };
    const descMap = {
      url_too_long: `URL slug is ${item.slug?.length || 0} characters. Keep URLs under 75 characters.`,
      url_underscores: "URL uses underscores. Use hyphens instead for better SEO.",
      url_uppercase: "URL contains uppercase letters. Use lowercase only.",
      url_special_chars: "URL contains special characters. Use only lowercase letters, numbers, and hyphens.",
      missing_slug: "No URL slug set. A slug is required for SEO.",
    };
    issues.push({
      category: "url_optimization",
      issueType: slugIssue,
      severity: severityMap[slugIssue] || "low",
      title: slugIssue.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: descMap[slugIssue] || "URL optimization issue.",
      currentValue: item.slug || "(not set)",
      recommendedValue: item.slug ? item.slug.toLowerCase().replace(/_/g, "-").replace(/[^a-z0-9-]/g, "") : "",
    });
  }

  // Indexability
  if (metrics.hasNoindex) {
    issues.push({
      category: "indexability",
      issueType: "noindex_set",
      severity: "high",
      title: "noindex directive detected",
      description: "robotsMeta contains 'noindex', which prevents this page from being indexed by search engines.",
      currentValue: item.robotsMeta,
      recommendedValue: "index, follow",
    });
  }

  if (!metrics.hasCanonical) {
    issues.push({
      category: "indexability",
      issueType: "missing_canonical",
      severity: "high",
      title: "Missing canonical URL",
      description: "No canonical URL set. This can lead to duplicate content issues.",
      currentValue: "(not set)",
      recommendedValue: `https://yoursite.com/${item.slug || ""}`,
    });
  }

  // HTTPS / Mixed content
  if (metrics.hasMixedContent) {
    issues.push({
      category: "https",
      issueType: "mixed_content",
      severity: "high",
      title: "Mixed content detected",
      description: "Content references HTTP resources on an HTTPS page. This causes browser warnings and hurts SEO.",
      currentValue: "HTTP resources found in content",
      recommendedValue: "Update all resource URLs to use HTTPS",
    });
  }

  if (metrics.nonHttpsLinks > 0) {
    issues.push({
      category: "https",
      issueType: "non_https_links",
      severity: "medium",
      title: "Non-HTTPS external links",
      description: `${metrics.nonHttpsLinks} external links use HTTP instead of HTTPS. Update them to HTTPS where possible.`,
      currentValue: `${metrics.nonHttpsLinks} HTTP links`,
      recommendedValue: "Use HTTPS for all external links",
    });
  }

  return issues;
}
