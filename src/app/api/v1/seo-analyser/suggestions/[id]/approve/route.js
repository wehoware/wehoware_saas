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
 * POST /api/v1/seo-analyser/suggestions/[id]/approve
 *   Approve a suggestion.
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
      status: "approved",
      approvedAt: new Date(),
      approvedBy: request.user.id,
    },
  });

  return NextResponse.json({ data: updated });
});
