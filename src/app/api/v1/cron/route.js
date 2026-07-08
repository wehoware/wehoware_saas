/**
 * POST /api/v1/cron
 *
 * Internal cron job dispatcher. Secured via CRON_SECRET header.
 * Called by an external scheduler (cron job, Vercel Cron, etc.)
 *
 * Supported job types (via ?type= query param):
 *   - publish_scheduled_posts  (every 1 minute)
 *   - refresh_tokens           (every hour)
 *   - retry_failed_posts       (every 15 minutes)
 *   - collect_post_metrics     (every 6 hours)
 *   - recover_stuck_publishing (every 5 minutes)
 *
 * Note: The HMAC-verified /api/cron/[job] endpoint is the preferred
 * entrypoint. This legacy route is kept for backward compatibility.
 */
import { NextResponse } from "next/server";
import {
  publishScheduledPosts,
  refreshExpiringTokens,
  retryFailedPosts,
  collectPostMetrics,
  recoverStuckPublishing,
  socialInboxSyncJob,
} from "@/lib/cron-jobs/social-media";

const CRON_SECRET = process.env.CRON_SECRET;

const JOB_HANDLERS = {
  publish_scheduled_posts: publishScheduledPosts,
  refresh_tokens: refreshExpiringTokens,
  retry_failed_posts: retryFailedPosts,
  collect_post_metrics: collectPostMetrics,
  recover_stuck_publishing: recoverStuckPublishing,
  social_inbox_sync: socialInboxSyncJob,
};

export async function POST(request) {
  // Verify cron secret if configured
  if (CRON_SECRET) {
    const authHeader = request.headers.get("x-cron-secret");
    if (authHeader !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const jobType = searchParams.get("type");

  if (!jobType) {
    return NextResponse.json(
      { error: "Missing required query param: type", availableJobs: Object.keys(JOB_HANDLERS) },
      { status: 400 }
    );
  }

  const handler = JOB_HANDLERS[jobType];
  if (!handler) {
    return NextResponse.json(
      { error: `Unknown job type: ${jobType}`, availableJobs: Object.keys(JOB_HANDLERS) },
      { status: 400 }
    );
  }

  const startedAt = Date.now();
  try {
    await handler();
    const durationMs = Date.now() - startedAt;
    console.info(`[cron] ${jobType} completed in ${durationMs}ms`);
    return NextResponse.json({ success: true, job: jobType, durationMs });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    console.error(`[cron] ${jobType} failed after ${durationMs}ms:`, err);
    return NextResponse.json({ error: err.message, job: jobType, durationMs }, { status: 500 });
  }
}
