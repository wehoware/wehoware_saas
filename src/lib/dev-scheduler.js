/**
 * Local development scheduler — runs social media cron jobs in the background
 * during development. In production, these are triggered by EventBridge/Vercel Cron.
 *
 * This is loaded by the dev server via instrumentation.ts and only runs when
 * NODE_ENV === "development".
 */
import { publishScheduledPosts, recoverStuckPublishing, retryFailedPosts } from "@/lib/cron-jobs/social-media.js";

const JOBS = [
  { name: "publish-scheduled-posts", fn: publishScheduledPosts, intervalMs: 60 * 1000 }, // 1 min
  { name: "recover-stuck-publishing", fn: recoverStuckPublishing, intervalMs: 5 * 60 * 1000 }, // 5 min
  { name: "retry-failed-posts", fn: retryFailedPosts, intervalMs: 15 * 60 * 1000 }, // 15 min
];

let started = false;
const timers = [];

export async function register() {
  if (started) return;
  if (process.env.NODE_ENV !== "development") return;
  started = true;

  // Run once immediately on startup, then set intervals
  for (const job of JOBS) {
    // Delay first run by 10s to let server fully boot
    setTimeout(async () => {
      try {
        await job.fn();
        console.log(`[dev-scheduler] ${job.name} ran on startup`);
      } catch (err) {
        console.error(`[dev-scheduler] ${job.name} failed on startup:`, err.message);
      }
      const timer = setInterval(async () => {
        try {
          await job.fn();
        } catch (err) {
          console.error(`[dev-scheduler] ${job.name} failed:`, err.message);
        }
      }, job.intervalMs);
      timers.push(timer);
    }, 10000);
  }

  console.log(`[dev-scheduler] Registered ${JOBS.length} jobs (publish, recover-stuck, retry-failed)`);
}

export function unregister() {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
  started = false;
}
