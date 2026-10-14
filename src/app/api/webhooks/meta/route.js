/**
 * Meta Webhook — Facebook Messenger + Instagram DM real-time events.
 *
 *   GET  /api/webhooks/meta  — hub.challenge verification (subscribe handshake)
 *   POST /api/webhooks/meta  — event delivery
 *
 * Payloads carry sender/recipient/message ids but no conversation thread id,
 * so instead of re-ingesting here we use the event as a real-time trigger for
 * syncInboxForAccount() — cheap now that unchanged threads are skipped.
 *
 * Security:
 *   GET  — verified against META_WEBHOOK_VERIFY_TOKEN
 *   POST — X-Hub-Signature-256 (HMAC-SHA256 of raw body) verified against the
 *          Meta app secret(s). Both Messenger and Instagram webhooks are
 *          signed by the same owning Meta app.
 *
 * Env:  META_WEBHOOK_VERIFY_TOKEN  — any random string you choose
 *       FACEBOOK_APP_SECRET / INSTAGRAM_APP_SECRET — used for signature check
 */
import { NextResponse, after } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { syncInboxForAccount } from "@/lib/social-inbox-sync.js";

const SUPPORTED_OBJECTS = new Set(["page", "instagram"]);
// Small delay lets Meta commit the message write before we pull it back.
const SYNC_DELAY_MS = 1500;

// ── Per-account sync coalescing ──────────────────────────────────────────────
// A burst of webhook events (typing, reactions, rapid messages) must not fan
// out into parallel pulls — one in flight per account, one queued behind it.
const inflight = new Set();
const pending = new Set();

function triggerSync(accountId) {
  if (inflight.has(accountId)) {
    pending.add(accountId);
    return;
  }
  inflight.add(accountId);
  (async () => {
    try {
      await new Promise((r) => setTimeout(r, SYNC_DELAY_MS));
      const account = await prisma.wehowareSocialAccount.findUnique({
        where: { id: accountId },
        include: { platform: true },
      });
      if (account?.status === "Active") {
        const res = await syncInboxForAccount(account, { force: true });
        if (res.skipped !== "rate_limited") {
          console.log(
            `[meta-webhook] synced account ${accountId}: ${res.conversationsSynced} convs, ${res.messagesSynced} msgs`
          );
        }
      }
    } catch (err) {
      console.error(`[meta-webhook] sync failed for account ${accountId}:`, err.message);
    } finally {
      inflight.delete(accountId);
      if (pending.delete(accountId)) triggerSync(accountId);
    }
  })();
}

// ── Signature verification ───────────────────────────────────────────────────
function verifySignature(rawBody, header) {
  if (!header?.startsWith("sha256=")) return false;
  const received = header.slice(7);
  const secrets = [process.env.FACEBOOK_APP_SECRET, process.env.INSTAGRAM_APP_SECRET].filter(Boolean);
  for (const secret of secrets) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
      if (timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8"))) return true;
    } catch { /* length mismatch — try next secret */ }
  }
  return false;
}

/**
 * Find which connected account an entry belongs to.
 * Messenger: entry.id is the Page ID. Instagram: entry.id may be the node id
 * or the IGSID depending on API version — match all stored id forms.
 */
async function resolveAccount(entryId, platformCode) {
  const accounts = await prisma.wehowareSocialAccount.findMany({
    where: { platform: { platformCode }, status: "Active" },
    include: { platform: true },
  });
  return (
    accounts.find(
      (a) =>
        a.accountId === entryId ||
        a.profileData?.pageId === entryId ||
        a.profileData?.igUserId === entryId ||
        a.profileData?.igsid === entryId
    ) || null
  );
}

// ── GET: subscription verification handshake ────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// ── POST: event delivery ────────────────────────────────────────────────────
export async function POST(request) {
  const rawBody = await request.text();

  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  const object = body?.object;
  if (!SUPPORTED_OBJECTS.has(object)) {
    // Meta sends other objects (e.g. "user") to the same callback — ack them.
    return NextResponse.json({ received: true });
  }

  const platformCode = object === "page" ? "facebook" : "instagram";
  const accountIds = new Set();

  for (const entry of body.entry || []) {
    // messaging[] = live thread events; standby[] is channel handover — skip it.
    const hasActivity = (entry.messaging || []).some(
      (e) => e.message || e.postback || e.reaction || e.read
    );
    if (!hasActivity) continue;
    const account = await resolveAccount(entry.id, platformCode);
    if (account) accountIds.add(account.id);
  }

  // Defer the pull until after Meta has our 200 — required ack within seconds.
  const ids = [...accountIds];
  if (ids.length) {
    after(() => ids.forEach((id) => triggerSync(id)));
  }

  return NextResponse.json({ received: true });
}
