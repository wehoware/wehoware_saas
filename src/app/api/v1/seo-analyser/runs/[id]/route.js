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
 * GET /api/v1/seo-analyser/runs/[id]
 *   Get a single analyser run with issues and suggestions.
 */
export const GET = withAuth(async (request, { params }) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Run ID is required" }, { status: 400 });
  }

  const run = await prisma.wehowareSeoAnalyserRun.findFirst({
    where: { id, clientId },
    include: {
      issues: {
        orderBy: { severity: "asc" },
        include: {
          suggestions: true,
        },
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({ data: run });
});
