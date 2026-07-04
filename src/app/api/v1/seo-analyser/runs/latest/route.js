/**
 * /api/v1/seo-analyser/runs/latest
 *
 * GET — Fetch the latest analysis run for a specific content item.
 *       Query params: ?contentType=blog&contentId={uuid}
 *       Returns the most recent run with issues and suggestions included.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";
import { prisma } from "@/lib/prisma";
import { isValidContentType } from "@/lib/seo-analyser/content-fetcher";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

export const GET = withAuth(async (request) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json(
      { error: "No active client context" },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const contentType = url.searchParams.get("contentType");
  const contentId = url.searchParams.get("contentId");

  if (!contentType || !contentId) {
    return NextResponse.json(
      { error: "contentType and contentId are required" },
      { status: 400 }
    );
  }

  if (!isValidContentType(contentType)) {
    return NextResponse.json(
      { error: `Invalid contentType. Must be one of: blog, service` },
      { status: 400 }
    );
  }

  try {
    const run = await prisma.wehowareSeoAnalyserRun.findFirst({
      where: {
        clientId,
        contentType,
        contentId,
      },
      orderBy: { createdAt: "desc" },
      take: 1,
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
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: run });
  } catch (err) {
    console.error("[runs/latest] Failed to fetch run:", err);
    return NextResponse.json(
      { error: "Failed to fetch latest analysis run" },
      { status: 500 }
    );
  }
});
