import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";
import { fetchContent, getContentSeoScore, isValidContentType, listContentItems } from "@/lib/seo-analyser/content-fetcher";
import { analyzeContent } from "@/lib/seo-analyser/llm-analyzer";
import { computeSeoScore } from "@/lib/seoScore";
import { prisma } from "@/lib/prisma";
import { resetProvider } from "@/lib/llm-providers/health.js";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
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
 *   Trigger a new SEO analysis run.
 *   Body: { contentType: "blog"|"service", contentId: "uuid" }
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

  try {
    // Reset in-memory health state for all providers on explicit user-triggered run
    resetProvider("openrouter");

    // Run the LLM analysis
    const analysis = await analyzeContent(clientId, content);

    // Save issues and suggestions
    let suggestionsCount = 0;

    for (const issue of analysis.issues) {
      const issueData = {
        clientId,
        runId: run.id,
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

    // Recalculate score after suggested fixes (simulated application)
    const simulatedContent = { ...content };
    for (const issue of analysis.issues) {
      if (issue.suggestion?.fieldName && issue.suggestion.suggestedValue) {
        simulatedContent[issue.suggestion.fieldName] = issue.suggestion.suggestedValue;
      }
    }
    const scoreAfter = computeSeoScore(simulatedContent);

    // Update run record
    const updatedRun = await prisma.wehowareSeoAnalyserRun.update({
      where: { id: run.id },
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
      include: {
        issues: {
          include: {
            suggestions: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: updatedRun,
      summary: analysis.summary,
    });
  } catch (error) {
    // Mark run as failed
    await prisma.wehowareSeoAnalyserRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: error.message?.substring(0, 1000) || "Unknown error",
        completedAt: new Date(),
      },
    });

    return NextResponse.json(
      { error: "Analysis failed", detail: error.message },
      { status: 500 }
    );
  }
});
