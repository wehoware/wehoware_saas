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
 * GET /api/v1/seo-analyser/dashboard
 *   Returns aggregated SEO health dashboard data for the current client.
 *   Query params: ?itemType=blog (optional filter)
 */
export const GET = withAuth(async (request) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const url = new URL(request.url);
  const itemType = url.searchParams.get("itemType");

  const issueWhere = { clientId };
  if (itemType) issueWhere.itemType = itemType;

  // Aggregate counts by status
  const [openCount, dismissedCount, resolvedCount] = await Promise.all([
    prisma.wehowareSeoAnalyserIssue.count({ where: { ...issueWhere, status: "open" } }),
    prisma.wehowareSeoAnalyserIssue.count({ where: { ...issueWhere, status: "dismissed" } }),
    prisma.wehowareSeoAnalyserIssue.count({ where: { ...issueWhere, status: "resolved" } }),
  ]);

  // Aggregate by severity
  const severityBreakdown = await prisma.wehowareSeoAnalyserIssue.groupBy({
    by: ["severity"],
    where: issueWhere,
    _count: true,
  });

  // Aggregate by category
  const categoryBreakdown = await prisma.wehowareSeoAnalyserIssue.groupBy({
    by: ["category"],
    where: { ...issueWhere, status: "open" },
    _count: true,
    orderBy: { _count: { category: "desc" } },
    take: 10,
  });

  // Suggestion stats
  const [pendingSuggestions, approvedSuggestions, appliedSuggestions, rejectedSuggestions] = await Promise.all([
    prisma.wehowareSeoAnalyserSuggestion.count({ where: { clientId, status: "pending" } }),
    prisma.wehowareSeoAnalyserSuggestion.count({ where: { clientId, status: "approved" } }),
    prisma.wehowareSeoAnalyserSuggestion.count({ where: { clientId, status: "applied" } }),
    prisma.wehowareSeoAnalyserSuggestion.count({ where: { clientId, status: "rejected" } }),
  ]);

  // Recent runs
  const recentRuns = await prisma.wehowareSeoAnalyserRun.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      contentType: true,
      contentTitle: true,
      contentSlug: true,
      status: true,
      scoreBefore: true,
      scoreAfter: true,
      issuesCount: true,
      suggestionsCount: true,
      createdAt: true,
      completedAt: true,
    },
  });

  // Score trend (last 30 runs)
  const scoreTrend = await prisma.wehowareSeoAnalyserRun.findMany({
    where: { clientId, status: "completed" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      scoreBefore: true,
      scoreAfter: true,
      createdAt: true,
      contentType: true,
    },
  });

  // Per-item-type summary
  const itemTypes = itemType ? [itemType] : ["blog", "service"];
  const perTypeSummary = [];
  for (const type of itemTypes) {
    const typeIssues = await prisma.wehowareSeoAnalyserIssue.count({
      where: { clientId, itemType: type, status: "open" },
    });
    const typeCritical = await prisma.wehowareSeoAnalyserIssue.count({
      where: { clientId, itemType: type, status: "open", severity: "critical" },
    });
    const typeRuns = await prisma.wehowareSeoAnalyserRun.count({
      where: { clientId, contentType: type },
    });
    perTypeSummary.push({ itemType: type, openIssues: typeIssues, criticalIssues: typeCritical, totalRuns: typeRuns });
  }

  return NextResponse.json({
    data: {
      issues: {
        open: openCount,
        dismissed: dismissedCount,
        resolved: resolvedCount,
        total: openCount + dismissedCount + resolvedCount,
      },
      severityBreakdown: severityBreakdown.reduce((acc, s) => {
        acc[s.severity] = s._count;
        return acc;
      }, {}),
      topCategories: categoryBreakdown.map((c) => ({ category: c.category, count: c._count })),
      suggestions: {
        pending: pendingSuggestions,
        approved: approvedSuggestions,
        applied: appliedSuggestions,
        rejected: rejectedSuggestions,
      },
      recentRuns,
      scoreTrend: scoreTrend.reverse(),
      perTypeSummary,
    },
  });
});
