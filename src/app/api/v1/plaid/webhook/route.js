/**
 * POST /api/v1/plaid/webhook
 * Plaid posts item/transaction lifecycle events here.  This endpoint is
 * unauthenticated in the Next.js sense (Plaid signs the request with its
 * own JWT via `plaid-verification` header; full verification is future
 * work). For now we:
 *   - Look up the WehowarePlaidItem by item_id.  If unknown, return 200
 *     (Plaid retries forever otherwise).
 *   - Dispatch on webhook_type/code.  TRANSACTIONS codes trigger a sync.
 *   - ITEM ERROR codes flip the item status so the UI can prompt reauth.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPlaidItem } from "@/lib/plaid/sync";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const itemId = body?.item_id;
  if (!itemId) {
    // Plaid may send test/ping webhooks without item_id — ack so it stops retrying
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  const item = await prisma.wehowarePlaidItem.findUnique({
    where: { itemId },
  });
  if (!item) {
    return NextResponse.json({ ok: true, unknown_item: true }, { status: 200 });
  }

  const type = body?.webhook_type;
  const code = body?.webhook_code;

  try {
    if (type === "TRANSACTIONS") {
      // Codes: SYNC_UPDATES_AVAILABLE, INITIAL_UPDATE, HISTORICAL_UPDATE,
      // DEFAULT_UPDATE, TRANSACTIONS_REMOVED
      const result = await syncPlaidItem({ plaidItemId: item.id });
      return NextResponse.json({ ok: true, code, sync: result }, { status: 200 });
    }
    if (type === "ITEM") {
      if (code === "ERROR") {
        const errorCode = body?.error?.error_code || "UNKNOWN";
        const requiresReauth = ["ITEM_LOGIN_REQUIRED", "PENDING_EXPIRATION"].includes(errorCode);
        await prisma.wehowarePlaidItem.update({
          where: { id: item.id },
          data: {
            status: requiresReauth ? "RequiresReauth" : "Error",
            errorCode,
            errorMessage: String(body?.error?.error_message || errorCode).slice(0, 2000),
          },
        });
      } else if (code === "PENDING_EXPIRATION") {
        await prisma.wehowarePlaidItem.update({
          where: { id: item.id },
          data: { status: "RequiresReauth", errorCode: code },
        });
      }
      return NextResponse.json({ ok: true, code }, { status: 200 });
    }
    return NextResponse.json({ ok: true, ignored: type }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: String(err?.message || err).slice(0, 2000),
      },
      { status: 500 }
    );
  }
}
