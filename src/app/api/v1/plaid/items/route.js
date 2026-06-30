/**
 * GET    /api/v1/plaid/items            — list items + last sync status
 * DELETE /api/v1/plaid/items?id=<uuid>  — disconnect a Plaid item
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import { getPlaidClient } from "@/lib/plaid/client";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function serializeItem(item, bankAccounts = []) {
  return {
    id: item.id,
    item_id: item.itemId,
    institution_id: item.institutionId,
    institution_name: item.institutionName,
    status: item.status,
    last_sync_at: item.lastSyncAt,
    error_code: item.errorCode,
    error_message: item.errorMessage,
    bank_accounts: bankAccounts.map((a) => ({
      id: a.id,
      name: a.name,
      mask: a.mask,
      currency: a.currency,
      is_active: a.isActive,
    })),
    created_at: item.createdAt,
  };
}

export const GET = withAuth(async (request, _context) => {
  const { user } = request;
  const clientId = resolveClientId(user);
  if (!clientId) {
    return NextResponse.json(
      { error: "No active client resolved" },
      { status: 400 }
    );
  }

  const items = await prisma.wehowarePlaidItem.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });

  const data = await Promise.all(
    items.map(async (item) => {
      const accounts = await prisma.wehowareBankAccount.findMany({
        where: { clientId, plaidItemId: item.itemId },
      });
      return serializeItem(item, accounts);
    })
  );

  return NextResponse.json({ data }, { status: 200 });
}, { allowedRoles: ["admin", "client"], allowedClientRoles: ["client"] });

export const DELETE = withAuth(async (request, _context) => {
  const { user } = request;
  const clientId = resolveClientId(user);
  if (!clientId) {
    return NextResponse.json(
      { error: "No active client resolved" },
      { status: 400 }
    );
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "id query parameter is required" },
      { status: 400 }
    );
  }

  const item = await prisma.wehowarePlaidItem.findUnique({ where: { id } });
  if (!item || item.clientId !== clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Best-effort: tell Plaid to invalidate. Never fail the delete if Plaid is unreachable.
  try {
    const plaid = await getPlaidClient();
    const token = decryptSecret(item.accessTokenEnc);
    if (token) await plaid.itemRemove({ access_token: token });
  } catch {
    // ignore — we still mark as disconnected locally
  }

  await prisma.wehowarePlaidItem.update({
    where: { id },
    data: { status: "Disconnected", accessTokenEnc: "" },
  });
  await prisma.wehowareBankAccount.updateMany({
    where: { clientId, plaidItemId: item.itemId },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true, id }, { status: 200 });
}, { allowedRoles: ["admin", "client"], allowedClientRoles: ["client"] });
