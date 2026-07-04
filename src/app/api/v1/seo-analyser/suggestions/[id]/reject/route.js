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
 * POST /api/v1/seo-analyser/suggestions/[id]/reject
 *   Reject a suggestion and dismiss the related issue.
 */
export const POST = withAuth(async (request, { params }) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const { id } = await params;

  const suggestion = await prisma.wehowareSeoAnalyserSuggestion.findFirst({
    where: { id, clientId },
  });

  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  const updated = await prisma.wehowareSeoAnalyserSuggestion.update({
    where: { id },
    data: {
      status: "rejected",
      rejectedAt: new Date(),
      rejectedBy: request.user.id,
    },
  });

  // Also mark the issue as dismissed
  await prisma.wehowareSeoAnalyserIssue.update({
    where: { id: suggestion.issueId },
    data: { status: "dismissed" },
  });

  return NextResponse.json({ data: updated });
});
