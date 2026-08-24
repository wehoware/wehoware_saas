/**
 * Next.js instrumentation hook — runs on server startup.
 * Registers the local dev scheduler for social media cron jobs.
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NODE_ENV === "development") {
    const { register: registerScheduler } = await import("./lib/dev-scheduler.js");
    await registerScheduler();
  }
}
