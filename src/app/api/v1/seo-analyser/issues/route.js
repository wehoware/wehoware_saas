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
 * GET /api/v1/seo-analyser/issues
 *   List SEO issues for the current client.
 *   Query params: ?itemType=blog&itemId=uuid&status=open&category=meta_title&severity=critical&page=1&limit=20
 */
export const GET = withAuth(async (request) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const url = new URL(request.url);
  const itemType = url.searchParams.get("itemType");
  const itemId = url.searchParams.get("itemId");
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const severity = url.searchParams.get("severity");
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page"), 10) || 1);
  const limit = Math.min(50, Number.parseInt(url.searchParams.get("limit"), 10) || 20);
  const skip = (page - 1) * limit;

  const where = { clientId };
  if (itemType) where.itemType = itemType;
  if (itemId) where.itemId = itemId;
  if (status) where.status = status;
  if (category) where.category = category;
  if (severity) where.severity = severity;

  const [issues, total] = await Promise.all([
    prisma.wehowareSeoAnalyserIssue.findMany({
      where,
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      skip,
      take: limit,
      include: { suggestions: true },
    }),
    prisma.wehowareSeoAnalyserIssue.count({ where }),
  ]);

  return NextResponse.json({
    data: issues,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * PATCH /api/v1/seo-analyser/issues
 *   Bulk update issue status (e.g., dismiss multiple issues).
 *   Body: { issueIds: ["uuid", ...], status: "dismissed" }
 */
export const PATCH = withAuth(async (request) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const body = await request.json();
  const { issueIds, status } = body;

  if (!Array.isArray(issueIds) || !status) {
    return NextResponse.json(
      { error: "issueIds (array) and status are required" },
      { status: 400 }
    );
  }

  const validStatuses = ["open", "dismissed", "resolved", "ignored"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
  }

  const result = await prisma.wehowareSeoAnalyserIssue.updateMany({
    where: { id: { in: issueIds }, clientId },
    data: { status },
  });

  return NextResponse.json({ data: { updated: result.count } });
});
