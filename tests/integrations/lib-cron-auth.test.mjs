import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyCronRequest } from "@/lib/cron/auth";
import { hmacSha256 } from "@/lib/crypto";

const SECRET = process.env.CRON_SECRET;

function buildRequest(headers = {}) {
  return {
    headers: {
      get(name) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
  };
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

test("verifyCronRequest accepts valid HMAC signature", () => {
  const ts = String(nowSec());
  const path = "/api/cron/send-reminders";
  const sig = hmacSha256(SECRET, `${ts}.${path}`);
  const res = verifyCronRequest(
    buildRequest({
      "x-cron-timestamp": ts,
      "x-cron-signature": sig,
    }),
    path
  );
  assert.equal(res.ok, true);
});

test("verifyCronRequest rejects bad signature", () => {
  const ts = String(nowSec());
  const path = "/api/cron/send-reminders";
  const res = verifyCronRequest(
    buildRequest({
      "x-cron-timestamp": ts,
      "x-cron-signature": "0".repeat(64),
    }),
    path
  );
  assert.equal(res.ok, false);
  assert.equal(res.statusCode, 401);
});

test("verifyCronRequest rejects timestamp outside skew window", () => {
  const ts = String(nowSec() - 60 * 60); // 1 hour old
  const path = "/api/cron/x";
  const sig = hmacSha256(SECRET, `${ts}.${path}`);
  const res = verifyCronRequest(
    buildRequest({
      "x-cron-timestamp": ts,
      "x-cron-signature": sig,
    }),
    path
  );
  assert.equal(res.ok, false);
  assert.match(res.reason, /timestamp/);
});

test("verifyCronRequest rejects non-numeric timestamp", () => {
  const res = verifyCronRequest(
    buildRequest({
      "x-cron-timestamp": "not-a-number",
      "x-cron-signature": "abc",
    }),
    "/api/cron/x"
  );
  assert.equal(res.ok, false);
});

test("verifyCronRequest rejects missing headers", () => {
  const res = verifyCronRequest(buildRequest({}), "/api/cron/x");
  assert.equal(res.ok, false);
  assert.match(res.reason, /missing signature/);
});

test("verifyCronRequest 503s when CRON_SECRET is missing", () => {
  const original = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    const res = verifyCronRequest(buildRequest({}), "/api/cron/x");
    assert.equal(res.statusCode, 503);
  } finally {
    process.env.CRON_SECRET = original;
  }
});

test("verifyCronRequest accepts bearer token when CRON_AUTH_MODE=bearer", () => {
  process.env.CRON_AUTH_MODE = "bearer";
  try {
    const res = verifyCronRequest(
      buildRequest({ authorization: `Bearer ${SECRET}` }),
      "/api/cron/x"
    );
    assert.equal(res.ok, true);
  } finally {
    delete process.env.CRON_AUTH_MODE;
  }
});

test("verifyCronRequest rejects wrong bearer token in bearer mode", () => {
  process.env.CRON_AUTH_MODE = "bearer";
  try {
    const res = verifyCronRequest(
      buildRequest({ authorization: "Bearer wrong" }),
      "/api/cron/x"
    );
    assert.equal(res.ok, false);
  } finally {
    delete process.env.CRON_AUTH_MODE;
  }
});

test("verifyCronRequest binds signature to path (replay across paths fails)", () => {
  const ts = String(nowSec());
  const sig = hmacSha256(SECRET, `${ts}./api/cron/send-reminders`);
  const res = verifyCronRequest(
    buildRequest({ "x-cron-timestamp": ts, "x-cron-signature": sig }),
    "/api/cron/sync-plaid"
  );
  assert.equal(res.ok, false);
});
