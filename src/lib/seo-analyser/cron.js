/**
 * SEO Analyser cron dispatcher.
 *
 * Iterates all clients with analyser enabled and runs batch analysis
 * according to their schedule settings.
 */

import { prisma } from "@/lib/prisma";
import { runBatchAnalysis } from "./analyser";

/**
 * Main cron entrypoint — called by /api/cron/seo-analyser
 *
 * Finds all clients with enabled analyser settings and runs
 * batch analysis for each.
 */
export async function runSeoAnalyserDispatcher() {
  const settings = await prisma.wehowareSeoAnalyserSetting.findMany({
    where: { enabled: true },
  });

  const output = {
    totalClients: settings.length,
    completed: 0,
    failed: 0,
    perClient: [],
  };

  for (const setting of settings) {
    const bucket = { clientId: setting.clientId, runs: 0, errors: 0 };

    try {
      // Check if it's time to run based on schedule
      if (!shouldRunNow(setting)) {
        bucket.skipped = true;
        output.perClient.push(bucket);
        continue;
      }

      const results = await runBatchAnalysis(setting.clientId, setting);
      bucket.runs = results.filter((r) => r.status === "completed").length;
      bucket.errors = results.filter((r) => r.status === "failed").length;
      output.completed += bucket.runs > 0 ? 1 : 0;
    } catch (err) {
      bucket.error = String(err?.message || err).slice(0, 500);
      output.failed += 1;
    }

    output.perClient.push(bucket);
  }

  return output;
}

/**
 * Determine if the analyser should run now based on schedule settings.
 * @param {Object} setting - WehowareSeoAnalyserSetting
 * @returns {boolean}
 */
function shouldRunNow(setting) {
  const now = new Date();

  // If nextRunAt is set and in the future, skip
  if (setting.nextRunAt && new Date(setting.nextRunAt) > now) {
    return false;
  }

  // If lastRunAt is set, check if enough time has passed
  if (setting.lastRunAt) {
    const lastRun = new Date(setting.lastRunAt);
    const diffMs = now - lastRun;
    const diffHours = diffMs / (1000 * 60 * 60);

    switch (setting.scheduleFrequency) {
      case "daily":
        return diffHours >= 24;
      case "weekly":
        return diffHours >= 168;
      case "monthly":
        return diffHours >= 720;
      case "hourly":
        return diffHours >= 1;
      default:
        return diffHours >= 168; // Default to weekly
    }
  }

  // No last run — run if it's the scheduled hour
  return now.getUTCHours() === setting.scheduleHour;
}
