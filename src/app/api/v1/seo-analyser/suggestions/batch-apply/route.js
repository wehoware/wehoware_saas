import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";
import { prisma } from "@/lib/prisma";
import { computeSeoScore } from "@/lib/seoScore";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

/**
 * Apply a suggestion to the content item.
 */
async function applySuggestionToContent(suggestion) {
  const { itemType, itemId, fieldName, suggestedValue } = suggestion;

  if (!fieldName || !suggestedValue) return;

  if (itemType === "blog") {
    await prisma.wehowareBlog.update({
      where: { id: itemId },
      data: { [fieldName]: suggestedValue },
    });
  } else if (itemType === "service") {
    await prisma.wehowareService.update({
      where: { id: itemId },
      data: { [fieldName]: suggestedValue },
    });
  } else if (itemType === "inventory") {
    await prisma.wehowareInventoryItem.update({
      where: { id: itemId },
      data: { [fieldName]: suggestedValue },
    });
  }
}

/**
 * Recompute SEO score for a content item.
 */
async function recomputeSeoScore(itemType, itemId) {
  let content = null;
  if (itemType === "blog") {
    content = await prisma.wehowareBlog.findUnique({ where: { id: itemId } });
  } else if (itemType === "service") {
    content = await prisma.wehowareService.findUnique({ where: { id: itemId } });
  } else if (itemType === "inventory") {
    content = await prisma.wehowareInventoryItem.findUnique({ where: { id: itemId } });
  }

  if (!content) return null;

  const newScore = computeSeoScore(content);
  const updateData = { seoScore: newScore };
  if (itemType === "blog") {
    await prisma.wehowareBlog.update({ where: { id: itemId }, data: updateData });
  } else if (itemType === "service") {
    await prisma.wehowareService.update({ where: { id: itemId }, data: updateData });
  } else if (itemType === "inventory") {
    await prisma.wehowareInventoryItem.update({ where: { id: itemId }, data: updateData });
  }

  return newScore;
}

/**
 * POST /api/v1/seo-analyser/suggestions/batch-apply
 *   Apply multiple suggestions at once.
 *   Body: { suggestionIds: ["uuid", "uuid", ...] }
 */
export const POST = withAuth(async (request) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const body = await request.json();
  const { suggestionIds } = body;

  if (!Array.isArray(suggestionIds) || suggestionIds.length === 0) {
    return NextResponse.json(
      { error: "suggestionIds array is required" },
      { status: 400 }
    );
  }

  // Fetch all suggestions that belong to this client
  const suggestions = await prisma.wehowareSeoAnalyserSuggestion.findMany({
    where: { id: { in: suggestionIds }, clientId, status: "pending" },
    include: { issue: true },
  });

  if (suggestions.length === 0) {
    return NextResponse.json({ error: "No applicable suggestions found" }, { status: 404 });
  }

  const results = [];
  const itemsToRescore = new Map();

  for (const suggestion of suggestions) {
    try {
      await applySuggestionToContent(suggestion);

      await prisma.wehowareSeoAnalyserSuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: "applied",
          appliedAt: new Date(),
          appliedBy: request.user.id,
        },
      });

      await prisma.wehowareSeoAnalyserIssue.update({
        where: { id: suggestion.issueId },
        data: { status: "resolved" },
      });

      // Track items that need SEO score recompute
      const key = `${suggestion.itemType}:${suggestion.itemId}`;
      if (!itemsToRescore.has(key)) {
        itemsToRescore.set(key, { itemType: suggestion.itemType, itemId: suggestion.itemId });
      }

      results.push({ id: suggestion.id, status: "applied" });
    } catch (err) {
      results.push({ id: suggestion.id, status: "failed", error: err.message });
    }
  }

  // Recompute SEO scores for all affected items
  const scoreUpdates = [];
  for (const { itemType, itemId } of itemsToRescore.values()) {
    try {
      const newScore = await recomputeSeoScore(itemType, itemId);
      scoreUpdates.push({ itemType, itemId, seoScore: newScore });
    } catch {
      // Non-critical — score recompute failure shouldn't fail the batch
    }
  }

  return NextResponse.json({
    data: results,
    applied: results.filter((r) => r.status === "applied").length,
    failed: results.filter((r) => r.status === "failed").length,
    scoreUpdates,
  });
});
