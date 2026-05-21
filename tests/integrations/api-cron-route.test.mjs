import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/cron/[job]/route";
import { hmacSha256 } from "@/lib/crypto";
import { __setEmailProviderForTests } from "@/lib/email/ses";
import { __reset, prisma } from "../mocks/prisma.mjs";
import { makeRequest } from "../harness.mjs";

const SECRET = process.env.CRON_SECRET;

function signed({ job, body = {}, ts = Math.floor(Date.now() / 1000) }) {
  const path = `/api/cron/${job}`;
  const sig = hmacSha256(SECRET, `${ts}.${path}`);
  return makeRequest({
    url: `http://test.local${path}`,
    method: "POST",
    body,
    headers: {
      "x-cron-timestamp": String(ts),
      "x-cron-signature": sig,
    },
  });
}

test("POST /api/cron/[job] runs send-reminders with valid HMAC", async () => {
  __reset();
  __setEmailProviderForTests(null, { mode: "log", fromAddress: "f@t.local" });
  const req = signed({ job: "send-reminders" });
  const res = await POST(req, { params: Promise.resolve({ job: "send-reminders" }) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.job, "send-reminders");
  assert.ok(body.runId);
  const runs = await prisma.wehowareCronJobRun.findMany({});
  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, "Succeeded");
});

test("POST /api/cron/[job] rejects invalid HMAC", async () => {
  __reset();
  const req = makeRequest({
    url: "http://test.local/api/cron/send-reminders",
    method: "POST",
    body: {},
    headers: {
      "x-cron-timestamp": String(Math.floor(Date.now() / 1000)),
      "x-cron-signature": "0".repeat(64),
    },
  });
  const res = await POST(req, { params: Promise.resolve({ job: "send-reminders" }) });
  assert.equal(res.status, 401);
});

test("POST /api/cron/[job] returns 404 for unknown job", async () => {
  __reset();
  const req = signed({ job: "no-such-job" });
  const res = await POST(req, { params: Promise.resolve({ job: "no-such-job" }) });
  assert.equal(res.status, 404);
});

test("POST /api/cron/[job] returns 401 with stale timestamp", async () => {
  const req = signed({ job: "send-reminders", ts: Math.floor(Date.now() / 1000) - 60 * 60 });
  const res = await POST(req, { params: Promise.resolve({ job: "send-reminders" }) });
  assert.equal(res.status, 401);
});
