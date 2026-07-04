/**
 * Keyword Research Sync — syncs target keywords from content analysis
 * into the WehowareSeoKeywordResearch table for use by the blog agent.
 */

import { prisma } from "@/lib/prisma";

/**
 * Sync keywords from a content item's targetKeywords + analysis issues
 * into the keyword research table.
 *
 * @param {string} clientId
 * @param {string} itemType - "blog" | "service" | "inventory"
 * @param {string} itemId
 * @param {Object} content - The content item with targetKeywords, title, slug
 * @param {Array} issues - Issues from the analysis (may contain keyword-related issues)
 * @returns {Promise<number>} - Number of keywords synced
 */
export async function syncKeywords(clientId, itemType, itemId, content, issues) {
  const keywords = new Set();

  // Collect target keywords from content
  if (content.targetKeywords && Array.isArray(content.targetKeywords)) {
    content.targetKeywords.forEach((kw) => {
      if (typeof kw === "string" && kw.trim()) keywords.add(kw.trim().toLowerCase());
    });
  }

  // Collect keywords from issues (e.g., keyword cannibalization, missing keywords)
  for (const issue of issues) {
    if (issue.issueType === "missing_keyword" && issue.recommendedValue) {
      keywords.add(issue.recommendedValue.toLowerCase());
    }
    if (issue.issueType === "keyword_cannibalization" && issue.currentValue) {
      keywords.add(issue.currentValue.toLowerCase());
    }
  }

  if (keywords.size === 0) return 0;

  let synced = 0;

  for (const keyword of keywords) {
    // Check if keyword already exists for this client
    const existing = await prisma.wehowareSeoKeywordResearch.findFirst({
      where: { clientId, keyword },
    });

    if (!existing) {
      await prisma.wehowareSeoKeywordResearch.create({
        data: {
          clientId,
          keyword,
          source: "seo_analyser",
          sourceItemType: itemType,
          sourceItemId: itemId,
          status: "identified",
        },
      });
      synced++;
    } else {
      // Update lastSeen
      await prisma.wehowareSeoKeywordResearch.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      });
    }
  }

  return synced;
}

/**
 * Sync content gap keywords — keywords that competitors rank for but
 * the client doesn't. This would typically come from LLM analysis.
 *
 * @param {string} clientId
 * @param {Array} contentGapKeywords - Array of { keyword, difficulty, volume }
 * @returns {Promise<number>}
 */
export async function syncContentGapKeywords(clientId, contentGapKeywords) {
  if (!contentGapKeywords || contentGapKeywords.length === 0) return 0;

  let synced = 0;

  for (const kw of contentGapKeywords) {
    const existing = await prisma.wehowareSeoKeywordResearch.findFirst({
      where: { clientId, keyword: kw.keyword.toLowerCase() },
    });

    if (!existing) {
      await prisma.wehowareSeoKeywordResearch.create({
        data: {
          clientId,
          keyword: kw.keyword.toLowerCase(),
          source: "content_gap",
          status: "gap",
          difficulty: kw.difficulty || null,
          searchVolume: kw.volume || null,
        },
      });
      synced++;
    }
  }

  return synced;
}
