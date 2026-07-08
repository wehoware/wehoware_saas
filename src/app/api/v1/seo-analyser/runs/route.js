import { NextResponse, after } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";
import { fetchContent, getContentSeoScore, isValidContentType, listContentItems } from "@/lib/seo-analyser/content-fetcher";
import { analyzeContent } from "@/lib/seo-analyser/llm-analyzer";
import { computeSeoScore } from "@/lib/seoScore";
import { prisma } from "@/lib/prisma";
import { resetProvider } from "@/lib/llm-providers/health.js";

// Allow up to 300s for background LLM analysis (Vercel Pro plan max)
export const maxDuration = 300;

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

/**
 * Background worker — runs LLM analysis and persists results.
 * Executed via after() so the HTTP response returns immediately.
 */
async function runAnalysisInBackground(runId, clientId, contentType, contentId, content) {
  // Reset health state for all configured providers before each run
  resetProvider("openrouter");
  resetProvider("wehoware");

  // Safety timeout — mark run as failed if analysis exceeds 280s
  const safetyTimeout = setTimeout(async () => {
    await prisma.wehowareSeoAnalyserRun.update({
      where: { id: runId },
      data: {
        status: "failed",
        errorMessage: "Analysis timed out (280s safety limit)",
        completedAt: new Date(),
      },
    }).catch(() => {});
  }, 280000);

  try {
    resetProvider("openrouter");

    const analysis = await analyzeContent(clientId, content);

    let suggestionsCount = 0;

    for (const issue of analysis.issues) {
      const issueData = {
        clientId,
        runId,
        itemType: contentType,
        itemId: contentId,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        currentValue: issue.currentValue,
        recommendedValue: issue.recommendedValue,
      };

      if (issue.suggestion) {
        issueData.suggestions = {
          create: [{
            clientId,
            itemType: contentType,
            itemId: contentId,
            fixType: issue.suggestion.fixType,
            fieldName: issue.suggestion.fieldName,
            suggestedValue: issue.suggestion.suggestedValue,
            explanation: issue.suggestion.explanation,
          }],
        };
        suggestionsCount += 1;
      }

      await prisma.wehowareSeoAnalyserIssue.create({ data: issueData });
    }

    const simulatedContent = { ...content };
    for (const issue of analysis.issues) {
      if (issue.suggestion?.fieldName && issue.suggestion.suggestedValue) {
        simulatedContent[issue.suggestion.fieldName] = issue.suggestion.suggestedValue;
      }
    }
    const scoreAfter = computeSeoScore(simulatedContent);

    await prisma.wehowareSeoAnalyserRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        issuesCount: analysis.issues.length,
        suggestionsCount,
        tokensUsed: analysis.tokensUsed,
        llmProvider: analysis.provider,
        llmModel: analysis.model,
        scoreAfter,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(`[seo-analyser] Background analysis failed for run ${runId}:`, error.message);
    await prisma.wehowareSeoAnalyserRun.update({
      where: { id: runId },
      data: {
        status: "failed",
        errorMessage: error.message?.substring(0, 1000) || "Unknown error",
        completedAt: new Date(),
      },
    }).catch(() => {});
  } finally {
    clearTimeout(safetyTimeout);
  }
}

/**
 * GET /api/v1/seo-analyser/runs
 *   List past analyser runs for the client.
 *   Query params: ?contentType=blog&status=completed&limit=20
 *
 * GET /api/v1/seo-analyser/content?type=blog
 *   List content items available for analysis.
 */
export const GET = withAuth(async (request) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  // List content items for the analyser UI
  if (action === "content") {
    const type = url.searchParams.get("type") || "blog";
    if (!isValidContentType(type)) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }
    const items = await listContentItems(clientId, type);
    return NextResponse.json({ data: items });
  }

  // List runs
  const contentType = url.searchParams.get("contentType");
  const status = url.searchParams.get("status");
  const limit = Math.min(Number.parseInt(url.searchParams.get("limit"), 10) || 20, 50);

  // Cleanup stale runs — mark runs stuck in "running" for >5 min as failed
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
  await prisma.wehowareSeoAnalyserRun.updateMany({
    where: { clientId, status: "running", createdAt: { lt: staleThreshold } },
    data: { status: "failed", errorMessage: "Run timed out (stale — server may have restarted)", completedAt: new Date() },
  }).catch(() => {});

  const where = { clientId };
  if (contentType) where.contentType = contentType;
  if (status) where.status = status;

  const runs = await prisma.wehowareSeoAnalyserRun.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      _count: { select: { issues: true } },
    },
  });

  return NextResponse.json({ data: runs });
});

/**
 * POST /api/v1/seo-analyser/runs
 *   Trigger a new SEO analysis run (async — returns immediately, analysis runs in background).
 *   Body: { contentType: "blog"|"service", contentId: "uuid" }
 *   Returns: 202 Accepted with run record (status: "running")
 *            Frontend polls GET /api/v1/seo-analyser/runs/[id] for completion.
 */
export const POST = withAuth(async (request) => {
  const clientId = resolveClientId(request.user);
  if (!clientId) {
    return NextResponse.json({ error: "No client context" }, { status: 400 });
  }

  const body = await request.json();
  const { contentType, contentId } = body;

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

  // Check for existing running analysis on the same content
  const existing = await prisma.wehowareSeoAnalyserRun.findFirst({
    where: { clientId, contentType, contentId, status: "running" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An analysis is already running for this content item", runId: existing.id },
      { status: 409 }
    );
  }

  // Fetch content from DB
  const content = await fetchContent(clientId, contentType, contentId);
  if (!content) {
    return NextResponse.json(
      { error: "Content not found" },
      { status: 404 }
    );
  }

  const scoreBefore = getContentSeoScore(content);

  // Create run record
  const run = await prisma.wehowareSeoAnalyserRun.create({
    data: {
      clientId,
      contentType,
      contentId,
      contentSlug: content.slug,
      contentTitle: content.title,
      status: "running",
      scoreBefore,
    },
  });

  // Schedule background analysis — after() runs after the response is sent
  after(() => runAnalysisInBackground(run.id, clientId, contentType, contentId, content));

  // Return immediately with 202 Accepted
  return NextResponse.json(
    { data: run, message: "Analysis started — poll for status" },
    { status: 202 }
  );
});
