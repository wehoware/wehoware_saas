/**
 * HMAC-verified cron entrypoint. Configure in EventBridge Scheduler as:
 *
 *   method   : POST
 *   url      : https://<amplify-domain>/api/cron/<job>
 *   headers  : {
 *     x-cron-timestamp: <now-in-unix-seconds>,
 *     x-cron-signature: hex(hmacSha256(CRON_SECRET, `${ts}.${path}`)),
 *   }
 *
 * Replay window: 5 minutes. See src/lib/cron/auth.js for details.
 */
import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron/auth";
import { runJob, listJobs } from "@/lib/cron/jobs";

export async function POST(request, { params }) {
  const { job } = await params;
  const path = `/api/cron/${job}`;

  const auth = verifyCronRequest(request, path);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason || "unauthorized" },
      { status: auth.statusCode || 401 }
    );
  }

  if (!listJobs().includes(job)) {
    return NextResponse.json(
      { error: `unknown job: ${job}`, available: listJobs() },
      { status: 404 }
    );
  }

  try {
    const result = await runJob(job);
    return NextResponse.json(
      { ok: true, job, ...result },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        job,
        error: String(err?.message || err).slice(0, 2000),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { jobs: listJobs(), method: "POST with x-cron-timestamp + x-cron-signature" },
    { status: 200 }
  );
}
