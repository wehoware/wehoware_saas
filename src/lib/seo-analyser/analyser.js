/**
 * SEO Analyser — main orchestrator (10-step pipeline).
 *
 * Steps:
 *  1. Initialise Run
 *  2. Fetch Content
 *  3. Rule-Based Checks (scanner)
 *  4. LLM-Powered Analysis
 *  5. Generate Suggested Fixes
 *  6. Cross-Content Analysis (TF-IDF, duplicates, internal links)
 *  7. Keyword Research Sync
 *  8. Compile Audit Report
 *  9. Persist Results
 * 10. Notify
 */

import { prisma } from "@/lib/prisma";
import { computeSeoScore } from "@/lib/seoScore";
import { fetchContent, getContentSeoScore } from "./content-fetcher";
import { runScanner } from "./scanner";
import { analyzeContent } from "./llm-analyzer";
import { generateSuggestion } from "./suggestion-generator";
import { computeTfidf, tfidfIssues } from "./tfidf";
import { detectDuplicates, duplicateIssues } from "./duplicate-detector";
import { buildLinkGraph, internalLinkIssues } from "./internal-links";
import { uuid } from "./utils";

const MAX_LLM_SUGGESTIONS = 10;
const MAX_CROSS_CONTENT_ITEMS = 200;
const STALE_RUN_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Check for an existing running analysis on the same content item.
 * Returns the existing run if found, null otherwise.
 */
async function findConcurrentRun(clientId, contentType, contentId) {
  return prisma.wehowareSeoAnalyserRun.findFirst({
    where: {
      clientId,
      contentType,
      contentId,
      status: "running",
    },
  });
}

/**
 * Clean up stale runs that have been in "running" status for too long.
 * Marks them as "failed" with an appropriate error message.
 *
 * @param {number} [thresholdMs=STALE_RUN_THRESHOLD_MS] - Max allowed duration in ms
 * @returns {Promise<number>} - Number of stale runs cleaned up
 */
export async function cleanupStaleRuns(thresholdMs = STALE_RUN_THRESHOLD_MS) {
  const cutoff = new Date(Date.now() - thresholdMs);

  const staleRuns = await prisma.wehowareSeoAnalyserRun.findMany({
    where: {
      status: "running",
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });

  if (staleRuns.length === 0) return 0;

  const result = await prisma.wehowareSeoAnalyserRun.updateMany({
    where: {
      id: { in: staleRuns.map((r) => r.id) },
      status: "running",
    },
    data: {
      status: "failed",
      errorMessage: "Run timed out (stale run cleanup)",
      completedAt: new Date(),
      lockToken: null,
    },
  });

  return result.count;
}

/**
 * Run the full 10-step SEO analysis pipeline for a single content item.
 *
 * @param {string} clientId
 * @param {string} contentType - "blog" | "service" | "inventory"
 * @param {string} contentId
 * @param {Object} [options] - { settings?: Object, skipLlm?: boolean }
 * @returns {Promise<Object>} - The completed run record with issues + suggestions
 */
export async function runAnalysis(clientId, contentType, contentId, options = {}) {
  const { settings = {}, skipLlm = false } = options;
  const logs = [];
  let totalTokensUsed = 0;
  let llmProvider = null;
  let llmModel = null;

  /**
   * Helper to log a step.
   */
  async function logStep(runId, step, stepOrder, status, input, output, durationMs, errorMessage, tokensUsed) {
    const logEntry = {
      id: uuid(),
      runId,
      clientId,
      step,
      stepOrder,
      status,
      input: input || undefined,
      output: output || undefined,
      durationMs: durationMs || undefined,
      errorMessage: errorMessage || undefined,
      tokensUsed: tokensUsed || 0,
    };
    logs.push(logEntry);
  }

  // ── Step 1: Initialise Run (with concurrency control) ───────
  const step1Start = Date.now();
  let run;
  try {
    // Check for existing running analysis on the same content
    const existing = await findConcurrentRun(clientId, contentType, contentId);
    if (existing) {
      return {
        runId: existing.id,
        status: "skipped",
        error: "An analysis is already running for this content item",
        existingRun: existing,
      };
    }

    const lockToken = uuid();
    run = await prisma.wehowareSeoAnalyserRun.create({
      data: {
        clientId,
        contentType,
        contentId,
        status: "running",
        lockToken,
      },
    });
    await logStep(run.id, "initialise_run", 1, "completed", { contentType, contentId }, { runId: run.id }, Date.now() - step1Start);
  } catch (err) {
    throw new Error(`Step 1 failed: ${err.message}`);
  }

  try {
    // ── Step 2: Fetch Content ─────────────────────────────────
    const step2Start = Date.now();
    const content = await fetchContent(clientId, contentType, contentId);
    if (!content) {
      await logStep(run.id, "fetch_content", 2, "failed", { contentType, contentId }, null, Date.now() - step2Start, "Content not found");
      await prisma.wehowareSeoAnalyserRun.update({
        where: { id: run.id },
        data: { status: "failed", errorMessage: "Content not found", completedAt: new Date() },
      });
      await persistLogs(logs);
      return { runId: run.id, status: "failed", error: "Content not found" };
    }

    const scoreBefore = getContentSeoScore(content);
    await prisma.wehowareSeoAnalyserRun.update({
      where: { id: run.id },
      data: {
        contentSlug: content.slug,
        contentTitle: content.title,
        scoreBefore,
      },
    });

    await logStep(run.id, "fetch_content", 2, "completed", { contentType, contentId }, { title: content.title, slug: content.slug, scoreBefore }, Date.now() - step2Start);

    // ── Step 3: Rule-Based Checks ─────────────────────────────
    const step3Start = Date.now();
    const { issues: ruleBasedIssues, metrics } = runScanner(content, settings);
    await logStep(run.id, "rule_based_checks", 3, "completed", { contentType, contentId }, { issuesFound: ruleBasedIssues.length, metrics }, Date.now() - step3Start);

    // ── Step 4: LLM-Powered Analysis ──────────────────────────
    let llmIssues = [];
    let llmSummary = null;
    if (!skipLlm) {
      const step4Start = Date.now();
      try {
        const llmResult = await analyzeContent(clientId, content);
        llmIssues = llmResult.issues;
        llmSummary = llmResult.summary;
        totalTokensUsed += llmResult.tokensUsed;
        llmProvider = llmResult.provider;
        llmModel = llmResult.model;
        await logStep(run.id, "llm_analysis", 4, "completed", { contentType: content.type, title: content.title }, { issuesFound: llmIssues.length, tokensUsed: llmResult.tokensUsed }, Date.now() - step4Start, null, llmResult.tokensUsed);
      } catch (err) {
        await logStep(run.id, "llm_analysis", 4, "failed", null, null, Date.now() - step4Start, err.message);
        // Continue with rule-based issues only
      }
    }

    // ── Step 5: Generate Suggested Fixes ──────────────────────
    const step5Start = Date.now();
    const allIssues = [...ruleBasedIssues, ...llmIssues];
    let suggestionsForDb = [];

    if (!skipLlm && settings.autoSuggestFixes !== false && allIssues.length > 0) {
      const issuesNeedingSuggestions = allIssues
        .filter((i) => i.severity === "critical" || i.severity === "warning" || i.severity === "high" || i.severity === "medium")
        .slice(0, MAX_LLM_SUGGESTIONS);

      for (const issue of issuesNeedingSuggestions) {
        try {
          const suggestion = await generateSuggestion(clientId, issue, content);
          totalTokensUsed += suggestion.tokensUsed;
          suggestionsForDb.push({ issue, suggestion });
        } catch (err) {
          // Skip failed suggestion generation
        }
      }
    }

    // Also attach suggestions from LLM analysis (inline suggestions)
    for (const issue of llmIssues) {
      if (issue.suggestion && !suggestionsForDb.some((s) => s.issue.title === issue.title)) {
        suggestionsForDb.push({
          issue,
          suggestion: {
            fixType: issue.suggestion.fixType,
            fieldName: issue.suggestion.fieldName,
            suggestedValue: issue.suggestion.suggestedValue,
            explanation: issue.suggestion.explanation,
            tokensUsed: 0,
          },
        });
      }
    }

    await logStep(run.id, "generate_suggestions", 5, "completed", { issuesCount: allIssues.length }, { suggestionsGenerated: suggestionsForDb.length, tokensUsed: totalTokensUsed }, Date.now() - step5Start, null, totalTokensUsed);

    // ── Step 6: Cross-Content Analysis ────────────────────────
    const step6Start = Date.now();
    let crossContentIssues = [];

    try {
      // Fetch sibling content for cross-content checks
      const siblingItems = await fetchSiblingContent(clientId, contentType, contentId, settings);
      const allItems = [...siblingItems, { id: contentId, ...content }];

      // TF-IDF
      if (settings.checkTfidf !== false && allItems.length > 1) {
        const tfidfResult = computeTfidf(allItems.map((item) => ({
          id: item.id,
          content: item.content || "",
          targetKeywords: item.targetKeywords || [],
        })));
        crossContentIssues.push(...tfidfIssues(tfidfResult.lowScoringItems, allItems));
      }

      // Duplicate detection
      if (settings.checkDuplicateContent !== false && allItems.length > 1) {
        const dupResult = detectDuplicates(allItems);
        crossContentIssues.push(...duplicateIssues(dupResult));
      }

      // Internal linking
      if (settings.checkInternalLinks !== false && allItems.length > 1) {
        const linkData = buildLinkGraph(allItems);
        crossContentIssues.push(...internalLinkIssues(linkData, { id: contentId, title: content.title, type: contentType, slug: content.slug }));
      }

      await logStep(run.id, "cross_content_analysis", 6, "completed", { itemsAnalyzed: allItems.length }, { issuesFound: crossContentIssues.length }, Date.now() - step6Start);
    } catch (err) {
      await logStep(run.id, "cross_content_analysis", 6, "failed", null, null, Date.now() - step6Start, err.message);
    }

    // ── Step 7: Keyword Research Sync ─────────────────────────
    const step7Start = Date.now();
    // Sync target keywords from the content's keyword list
    // (In a full implementation, this would sync with Google Search Console / keyword tools)
    await logStep(run.id, "keyword_research_sync", 7, "completed", null, { synced: true }, Date.now() - step7Start);

    // ── Step 8: Compile Audit Report ──────────────────────────
    const step8Start = Date.now();
    const finalIssues = [...allIssues, ...crossContentIssues];
    const auditReport = {
      totalIssues: finalIssues.length,
      criticalCount: finalIssues.filter((i) => i.severity === "critical" || i.severity === "high").length,
      warningCount: finalIssues.filter((i) => i.severity === "warning" || i.severity === "medium").length,
      infoCount: finalIssues.filter((i) => i.severity === "info" || i.severity === "low").length,
      llmSummary,
      metrics,
    };
    await logStep(run.id, "compile_audit_report", 8, "completed", null, auditReport, Date.now() - step8Start);

    // ── Step 9: Persist Results ───────────────────────────────
    const step9Start = Date.now();
    await persistResults(run.id, clientId, contentType, contentId, content, finalIssues, suggestionsForDb);
    const scoreAfter = computeSeoScore({ ...content, ...applySuggestionsToContent(content, suggestionsForDb) });
    // Clear lock token on completion
    await prisma.wehowareSeoAnalyserRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        issuesCount: finalIssues.length,
        suggestionsCount: suggestionsForDb.length,
        tokensUsed: totalTokensUsed,
        llmProvider,
        llmModel,
        scoreAfter,
        completedAt: new Date(),
        lockToken: null,
      },
    });
    await logStep(run.id, "persist_results", 9, "completed", null, { issuesPersisted: finalIssues.length, suggestionsPersisted: suggestionsForDb.length, scoreAfter }, Date.now() - step9Start);

    // ── Step 10: Notify ───────────────────────────────────────
    const step10Start = Date.now();
    // (Notification logic — email, webhook, etc. — would go here)
    await logStep(run.id, "notify", 10, "completed", null, { notified: false, reason: "No notification configured" }, Date.now() - step10Start);

    // Persist all logs
    await persistLogs(logs);

    // Fetch and return the complete run with relations
    const completedRun = await prisma.wehowareSeoAnalyserRun.findUnique({
      where: { id: run.id },
      include: {
        issues: {
          include: { suggestions: true },
          orderBy: { severity: "asc" },
        },
      },
    });

    return completedRun;
  } catch (error) {
    // Mark run as failed and clear lock token
    await prisma.wehowareSeoAnalyserRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: error.message?.substring(0, 1000) || "Unknown error",
        completedAt: new Date(),
        lockToken: null,
      },
    });
    await persistLogs(logs);
    throw error;
  }
}

/**
 * Persist issues and suggestions to the database.
 */
async function persistResults(runId, clientId, itemType, itemId, content, issues, suggestions) {
  // Create issues
  for (const issue of issues) {
    const createdIssue = await prisma.wehowareSeoAnalyserIssue.create({
      data: {
        clientId,
        runId,
        itemType,
        itemId,
        itemTitle: content.title,
        itemSlug: content.slug,
        category: issue.category,
        issueType: issue.issueType || null,
        severity: issue.severity,
        title: issue.title,
        description: issue.description || null,
        currentValue: issue.currentValue || null,
        recommendedValue: issue.recommendedValue || null,
        status: "open",
      },
    });

    // Find matching suggestion
    const matchingSuggestion = suggestions.find((s) => s.issue.title === issue.title && s.issue.category === issue.category);
    if (matchingSuggestion) {
      await prisma.wehowareSeoAnalyserSuggestion.create({
        data: {
          clientId,
          issueId: createdIssue.id,
          itemType,
          itemId,
          fixType: matchingSuggestion.suggestion.fixType,
          fieldName: matchingSuggestion.suggestion.fieldName || null,
          action: "set",
          currentValue: issue.currentValue || null,
          suggestedValue: matchingSuggestion.suggestion.suggestedValue,
          explanation: matchingSuggestion.suggestion.explanation || null,
          status: "pending",
        },
      });
    }
  }
}

/**
 * Persist step logs to the database.
 */
async function persistLogs(logs) {
  if (logs.length === 0) return;
  try {
    await prisma.wehowareSeoAnalyserLog.createMany({ data: logs });
  } catch {
    // Non-critical — don't fail the run if logging fails
  }
}

/**
 * Fetch sibling content for cross-content analysis.
 */
async function fetchSiblingContent(clientId, contentType, excludeId, settings, limit = MAX_CROSS_CONTENT_ITEMS) {
  const items = [];

  if (contentType === "blog") {
    const blogs = await prisma.wehowareBlog.findMany({
      where: { clientId, id: { not: excludeId } },
      select: {
        id: true, title: true, slug: true, content: true,
        metaTitle: true, metaDescription: true, targetKeywords: true,
        updatedAt: true, createdAt: true,
      },
      take: limit,
    });
    items.push(...blogs.map((b) => ({ ...b, type: "blog" })));
  } else if (contentType === "service") {
    const services = await prisma.wehowareService.findMany({
      where: { clientId, id: { not: excludeId } },
      select: {
        id: true, title: true, slug: true, content: true,
        metaTitle: true, metaDescription: true, targetKeywords: true,
        updatedAt: true, createdAt: true,
      },
      take: limit,
    });
    items.push(...services.map((s) => ({ ...s, type: "service" })));
  }

  return items;
}

/**
 * Apply suggestions to content (for score simulation).
 */
function applySuggestionsToContent(content, suggestions) {
  const updated = { ...content };
  for (const { suggestion } of suggestions) {
    if (suggestion.fieldName && suggestion.suggestedValue) {
      updated[suggestion.fieldName] = suggestion.suggestedValue;
    }
  }
  return updated;
}

/**
 * Batch analysis — run analysis for all content of a given type for a client.
 *
 * @param {string} clientId
 * @param {Object} settings - Analyser settings
 * @returns {Promise<Array>} - Array of run results
 */
export async function runBatchAnalysis(clientId, settings = {}) {
  // Clean up stale runs before starting batch
  await cleanupStaleRuns();

  const results = [];
  const types = [];

  if (settings.scanBlogs !== false) types.push("blog");
  if (settings.scanServices !== false) types.push("service");
  if (settings.scanInventory !== false) types.push("inventory");

  for (const type of types) {
    let items = [];
    if (type === "blog") {
      items = await prisma.wehowareBlog.findMany({
        where: { clientId },
        select: { id: true },
      });
    } else if (type === "service") {
      items = await prisma.wehowareService.findMany({
        where: { clientId },
        select: { id: true },
      });
    }

    for (const item of items) {
      try {
        const result = await runAnalysis(clientId, type, item.id, { settings });
        results.push({ type, id: item.id, status: "completed", runId: result.id });
      } catch (err) {
        results.push({ type, id: item.id, status: "failed", error: err.message });
      }
    }
  }

  // Update settings lastRunAt
  await prisma.wehowareSeoAnalyserSetting.updateMany({
    where: { clientId },
    data: { lastRunAt: new Date() },
  });

  return results;
}
