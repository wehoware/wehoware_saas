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
 * Updates the actual blog/service/inventory record with the suggested value.
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
 * Recompute SEO score for a content item after a suggestion is applied.
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
  if (itemType === "blog") {
    await prisma.wehowareBlog.update({ where: { id: itemId }, data: { seoScore: newScore } });
  } else if (itemType === "service") {
    await prisma.wehowareService.update({ where: { id: itemId }, data: { seoScore: newScore } });
  } else if (itemType === "inventory") {
    await prisma.wehowareInventoryItem.update({ where: { id: itemId }, data: { seoScore: newScore } });
  }

  return newScore;
}

/**
 * POST /api/v1/seo-analyser/suggestions/[id]/apply
 *   Apply a suggestion to the content item, mark it as applied,
 *   resolve the related issue, and recompute the SEO score.
 */
export const POST = withAuth(async (request, { params }) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const { id } = await params;

  const suggestion = await prisma.wehowareSeoAnalyserSuggestion.findFirst({
    where: { id, clientId },
    include: { issue: true },
  });

  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  try {
    // Apply the suggestion to the actual content
    await applySuggestionToContent(suggestion);

    // Mark suggestion as applied
    const updated = await prisma.wehowareSeoAnalyserSuggestion.update({
      where: { id },
      data: {
        status: "applied",
        appliedAt: new Date(),
        appliedBy: request.user.id,
      },
    });

    // Mark the issue as resolved
    await prisma.wehowareSeoAnalyserIssue.update({
      where: { id: suggestion.issueId },
      data: { status: "resolved" },
    });

    // Recompute SEO score
    const newScore = await recomputeSeoScore(suggestion.itemType, suggestion.itemId);

    return NextResponse.json({ data: updated, seoScore: newScore });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to apply suggestion", detail: err.message },
      { status: 500 }
    );
  }
});
