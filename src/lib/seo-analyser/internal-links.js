/**
 * Internal linking graph builder.
 *
 * Builds a graph of all content → identify orphaned content,
 * missing cross-links, and broken internal links.
 */

import { extractLinks, filterInternalLinks } from "./utils";

/**
 * Build internal linking graph from all content items.
 * @param {Array<{id: string, slug: string, type: string, title: string, content: string}>} items
 * @returns {{ graph: Map, orphaned: Array, brokenLinks: Array, linkCounts: Map }}
 */
export function buildLinkGraph(items) {
  // Build slug → item lookup
  const slugToItem = new Map();
  for (const item of items) {
    if (item.slug) {
      slugToItem.set(item.slug, item);
      slugToItem.set(`/${item.slug}`, item);
    }
  }

  // Build link graph: item.id → [linked item.ids]
  const graph = new Map();
  const linkCounts = new Map();
  const brokenLinks = [];

  // Reverse graph: item.id → [items linking to it]
  const reverseGraph = new Map();

  for (const item of items) {
    const links = extractLinks(item.content || "");
    const internalLinks = filterInternalLinks(links);
    const linkedIds = new Set();

    for (const link of internalLinks) {
      const href = link.href.startsWith("/") ? link.href : `/${link.href}`;
      const targetItem = slugToItem.get(href) || slugToItem.get(href.replace(/^\//, ""));

      if (targetItem) {
        linkedIds.add(targetItem.id);
        // Update reverse graph
        if (!reverseGraph.has(targetItem.id)) {
          reverseGraph.set(targetItem.id, new Set());
        }
        reverseGraph.get(targetItem.id).add(item.id);
      } else {
        // Broken internal link
        brokenLinks.push({
          fromItem: { id: item.id, title: item.title, type: item.type },
          brokenHref: link.href,
        });
      }
    }

    graph.set(item.id, [...linkedIds]);
    linkCounts.set(item.id, linkedIds.size);
  }

  // Find orphaned content (no other item links to it)
  const orphaned = items.filter(
    (item) => !reverseGraph.has(item.id) || reverseGraph.get(item.id).size === 0
  ).map((item) => ({ id: item.id, title: item.title, type: item.type, slug: item.slug }));

  return { graph, orphaned, brokenLinks, linkCounts, reverseGraph };
}

/**
 * Generate issues from link graph analysis.
 * @param {Object} linkData
 * @param {Object} item - Specific item to generate issues for
 * @returns {Array}
 */
export function internalLinkIssues(linkData, item) {
  const issues = [];
  const linkCount = linkData.linkCounts.get(item.id) || 0;

  if (linkCount === 0) {
    issues.push({
      category: "internal_links",
      issueType: "no_internal_links",
      severity: "high",
      title: "No internal links",
      description: "Content has zero links to other pages. Internal links help search engines discover and rank content.",
      currentValue: "0 internal links",
      recommendedValue: "Add 3+ internal links to related content",
    });
  } else if (linkCount < 3) {
    issues.push({
      category: "internal_links",
      issueType: "few_internal_links",
      severity: "medium",
      title: "Few internal links",
      description: `Content has only ${linkCount} internal link(s). Aim for at least 3-5 relevant internal links.`,
      currentValue: `${linkCount} internal links`,
      recommendedValue: "Add more internal links to related content (aim for 3-5+)",
    });
  }

  // Check if this item is orphaned
  const isOrphaned = linkData.orphaned.some((o) => o.id === item.id);
  if (isOrphaned) {
    issues.push({
      category: "internal_links",
      issueType: "orphaned_content",
      severity: "medium",
      title: "Orphaned content",
      description: "No other content links to this item. Orphaned pages are harder for search engines to discover.",
      currentValue: "0 inbound links",
      recommendedValue: "Add links from related blog posts or service pages to this content",
    });
  }

  // Check for broken links from this item
  const brokenFromItem = linkData.brokenLinks.filter((b) => b.fromItem.id === item.id);
  if (brokenFromItem.length > 0) {
    issues.push({
      category: "internal_links",
      issueType: "broken_internal_links",
      severity: "high",
      title: "Broken internal links",
      description: `${brokenFromItem.length} internal link(s) point to non-existent pages: ${brokenFromItem.map((b) => b.brokenHref).join(", ")}`,
      currentValue: brokenFromItem.map((b) => b.brokenHref).join(", "),
      recommendedValue: "Fix or remove broken internal links",
    });
  }

  return issues;
}
