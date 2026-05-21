/**
 * POST /api/v1/plaid/sync
 * Body: { plaid_item_id?: string }   // omit to sync every active item for this tenant
 *
 * On-demand sync trigger from the UI.  The scheduled cron job runs daily
 * at a fixed time; this endpoint lets users force a refresh.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import { syncPlaidItem } from "@/lib/plaid/sync";
import { prisma } from "@/lib/prisma";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

export const POST = withAuth(async (request, _context) => {
  const { user } = request;
  const clientId = resolveClientId(user);
  if (!clientId) {
    return NextResponse.json(
      { error: "No active client resolved" },
      { status: 400 }
    );
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }
  const where = { clientId, status: "Active" };
  if (body?.plaid_item_id) where.id = body.plaid_item_id;

  const items = await prisma.wehowarePlaidItem.findMany({ where });
  if (items.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        synced: 0,
        detail: "no active plaid items for this client",
      },
      { status: 200 }
    );
  }

  const results = [];
  for (const item of items) {
    try {
      const r = await syncPlaidItem({ plaidItemId: item.id });
      results.push({ id: item.id, ...r });
    } catch (err) {
      results.push({
        id: item.id,
        error: String(err?.message || err).slice(0, 500),
      });
    }
  }
  return NextResponse.json(
    { ok: true, synced: results.length, results },
    { status: 200 }
  );
});
