/**
 * SEO Analyser — data retention cleanup and suggestion expiry jobs.
 *
 * - `runDataRetentionCleanup`: deletes old runs (and cascaded issues/suggestions/logs)
 *   beyond a configurable retention period.
 * - `runSuggestionExpiry`: marks pending suggestions older than the expiry
 *   threshold as "expired" so they no longer appear in review queues.
 */

import { prisma } from "@/lib/prisma";

const DEFAULT_RUN_RETENTION_DAYS = 90;
const DEFAULT_SUGGESTION_EXPIRY_DAYS = 30;

/**
 * Delete analysis runs (and cascaded relations) older than the retention period.
 *
 * @param {Object} [opts]
 * @param {number} [opts.retentionDays=90] - Runs older than this many days are deleted.
 * @returns {Promise<Object>} - { deletedRuns, deletedIssues, deletedSuggestions, deletedLogs }
 */
export async function runDataRetentionCleanup(opts = {}) {
  const retentionDays = opts.retentionDays ?? DEFAULT_RUN_RETENTION_DAYS;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Fetch run IDs to delete (needed for cascaded counts)
  const oldRuns = await prisma.wehowareSeoAnalyserRun.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true },
  });

  if (oldRuns.length === 0) {
    return { deletedRuns: 0, deletedIssues: 0, deletedSuggestions: 0, deletedLogs: 0 };
  }

  const runIds = oldRuns.map((r) => r.id);

  // Count cascaded records before deletion (for reporting)
  const [issueCount, suggestionCount, logCount] = await Promise.all([
    prisma.wehowareSeoAnalyserIssue.count({ where: { runId: { in: runIds } } }),
    prisma.wehowareSeoAnalyserSuggestion.count({
      where: { issue: { runId: { in: runIds } } },
    }),
    prisma.wehowareSeoAnalyserLog.count({ where: { runId: { in: runIds } } }),
  ]);

  // Delete runs — cascades to issues, suggestions (via issue), and logs
  const result = await prisma.wehowareSeoAnalyserRun.deleteMany({
    where: { id: { in: runIds } },
  });

  return {
    deletedRuns: result.count,
    deletedIssues: issueCount,
    deletedSuggestions: suggestionCount,
    deletedLogs: logCount,
  };
}

/**
 * Mark pending suggestions older than the expiry threshold as "expired".
 *
 * @param {Object} [opts]
 * @param {number} [opts.expiryDays=30] - Pending suggestions older than this are expired.
 * @returns {Promise<number>} - Number of suggestions expired.
 */
export async function runSuggestionExpiry(opts = {}) {
  const expiryDays = opts.expiryDays ?? DEFAULT_SUGGESTION_EXPIRY_DAYS;
  const cutoff = new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000);

  const result = await prisma.wehowareSeoAnalyserSuggestion.updateMany({
    where: {
      status: "pending",
      createdAt: { lt: cutoff },
    },
    data: {
      status: "expired",
    },
  });

  return result.count;
}

/**
 * Combined cleanup dispatcher — runs both data retention and suggestion expiry.
 * Intended to be called as a daily cron job.
 *
 * @returns {Promise<Object>}
 */
export async function runSeoCleanupDispatcher() {
  const [retentionResult, expiryResult] = await Promise.all([
    runDataRetentionCleanup(),
    runSuggestionExpiry(),
  ]);

  return {
    retention: retentionResult,
    suggestionsExpired: expiryResult,
  };
}
