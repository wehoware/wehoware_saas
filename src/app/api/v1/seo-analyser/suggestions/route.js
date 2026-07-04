import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";
import { prisma } from "@/lib/prisma";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

/**
 * Apply a suggestion to the content item.
 * Updates the actual blog/service record with the suggested value.
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
  }
}

/**
 * GET /api/v1/seo-analyser/suggestions
 *   List suggestions for the current client.
 *   Query params: ?status=pending&itemType=blog&itemId=uuid&page=1&limit=20
 */
export const GET = withAuth(async (request) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";
  const itemType = url.searchParams.get("itemType");
  const itemId = url.searchParams.get("itemId");
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page"), 10) || 1);
  const limit = Math.min(50, Number.parseInt(url.searchParams.get("limit"), 10) || 20);
  const skip = (page - 1) * limit;

  const where = { clientId };
  if (status) where.status = status;
  if (itemType) where.itemType = itemType;
  if (itemId) where.itemId = itemId;

  const [suggestions, total] = await Promise.all([
    prisma.wehowareSeoAnalyserSuggestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { issue: true },
    }),
    prisma.wehowareSeoAnalyserSuggestion.count({ where }),
  ]);

  return NextResponse.json({
    data: suggestions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * PATCH /api/v1/seo-analyser/suggestions
 *   Approve, reject, or apply a suggestion.
 *   Body: { suggestionId: "uuid", action: "approve" | "reject" | "apply" }
 */
export const PATCH = withAuth(async (request) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const body = await request.json();
  const { suggestionId, action } = body;

  if (!suggestionId || !action) {
    return NextResponse.json(
      { error: "suggestionId and action are required" },
      { status: 400 }
    );
  }

  const validActions = ["approve", "reject", "apply"];
  if (!validActions.includes(action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
      { status: 400 }
    );
  }

  const suggestion = await prisma.wehowareSeoAnalyserSuggestion.findFirst({
    where: { id: suggestionId, clientId },
    include: { issue: true },
  });

  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  if (action === "approve") {
    const updated = await prisma.wehowareSeoAnalyserSuggestion.update({
      where: { id: suggestionId },
      data: { status: "approved", approvedAt: new Date(), approvedBy: request.user.id },
    });
    return NextResponse.json({ data: updated });
  }

  if (action === "reject") {
    const updated = await prisma.wehowareSeoAnalyserSuggestion.update({
      where: { id: suggestionId },
      data: { status: "rejected", rejectedAt: new Date(), rejectedBy: request.user.id },
    });
    // Also mark the issue as dismissed
    await prisma.wehowareSeoAnalyserIssue.update({
      where: { id: suggestion.issueId },
      data: { status: "dismissed" },
    });
    return NextResponse.json({ data: updated });
  }

  if (action === "apply") {
    try {
      // Apply the suggestion to the actual content
      await applySuggestionToContent(suggestion);

      // Mark suggestion as applied
      const updated = await prisma.wehowareSeoAnalyserSuggestion.update({
        where: { id: suggestionId },
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

      return NextResponse.json({ data: updated });
    } catch (err) {
      return NextResponse.json(
        { error: "Failed to apply suggestion", detail: err.message },
        { status: 500 }
      );
    }
  }
});
