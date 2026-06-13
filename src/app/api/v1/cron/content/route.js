/**
 * GET /api/v1/cron/content
 *
 * Trigger content scheduled-publish cron jobs.
 * Secured with CRON_SECRET env var (set in deployment config).
 *
 * Usage (Vercel Cron or external scheduler):
 *   GET /api/v1/cron/content
 *   Authorization: Bearer <CRON_SECRET>
 */
import { NextResponse } from "next/server";
import { publishScheduledBlogs, publishScheduledServices } from "@/lib/cron-jobs/content";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const [blogs, services] = await Promise.all([
      publishScheduledBlogs(),
      publishScheduledServices(),
    ]);
    return NextResponse.json({ ok: true, blogs, services });
  } catch (err) {
    console.error("[GET /api/v1/cron/content] error:", err);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
