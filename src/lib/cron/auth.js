/**
 * Shared-secret HMAC verification for cron endpoints.
 *
 * Trigger side (EventBridge Scheduler target: `api/cron/<job>`):
 *   - Header `x-cron-timestamp: <unix-seconds>`
 *   - Header `x-cron-signature: hex(hmacSha256(CRON_SECRET, "<timestamp>.<path>"))`
 *
 * A 5-minute skew window blocks replay. The secret is never echoed back.
 *
 * A simpler `Authorization: Bearer <CRON_SECRET>` mode is accepted when
 * `CRON_AUTH_MODE=bearer` — lower-security but easier to configure in
 * Amplify if you don't need HMAC.  Default is HMAC.
 */
import { hmacSha256, safeEqualHex } from "@/lib/crypto";

const MAX_SKEW_SECONDS = 300;

export function verifyCronRequest(request, path) {
  const mode = process.env.CRON_AUTH_MODE || "hmac";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return {
      ok: false,
      reason: "CRON_SECRET not configured",
      statusCode: 503,
    };
  }

  if (mode === "bearer") {
    const auth = request.headers.get("authorization") || "";
    const expected = `Bearer ${secret}`;
    if (auth.length !== expected.length || auth !== expected) {
      return { ok: false, reason: "invalid bearer", statusCode: 401 };
    }
    return { ok: true };
  }

  const ts = request.headers.get("x-cron-timestamp");
  const sig = request.headers.get("x-cron-signature");
  if (!ts || !sig) {
    return { ok: false, reason: "missing signature headers", statusCode: 401 };
  }
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) {
    return { ok: false, reason: "invalid timestamp", statusCode: 401 };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "timestamp out of range", statusCode: 401 };
  }
  const expected = hmacSha256(secret, `${ts}.${path}`);
  if (!safeEqualHex(expected, sig)) {
    return { ok: false, reason: "signature mismatch", statusCode: 401 };
  }
  return { ok: true };
}

export const __cronInternal = { MAX_SKEW_SECONDS };
