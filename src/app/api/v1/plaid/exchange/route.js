/**
 * POST /api/v1/plaid/exchange
 * Body: { public_token: string, institution?: { id, name } }
 *
 * Exchanges the short-lived public_token returned by Plaid Link for a
 * long-lived access_token, persists it (encrypted) + the associated
 * item_id, then kicks off an initial transactions sync.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import { getPlaidClient } from "@/lib/plaid/client";
import { encryptSecret } from "@/lib/crypto";
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const publicToken = body?.public_token;
  if (!publicToken || typeof publicToken !== "string") {
    return NextResponse.json(
      { error: "public_token is required" },
      { status: 400 }
    );
  }

  let plaid;
  try {
    plaid = await getPlaidClient();
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Plaid not configured" },
      { status: 503 }
    );
  }

  let accessToken;
  let itemId;
  try {
    const exchange = await plaid.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const data = exchange.data || exchange;
    accessToken = data.access_token;
    itemId = data.item_id;
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to exchange public_token",
        detail: err?.response?.data?.error_message || err?.message,
      },
      { status: 502 }
    );
  }

  if (!accessToken || !itemId) {
    return NextResponse.json(
      { error: "Plaid exchange response missing access_token or item_id" },
      { status: 502 }
    );
  }

  const existing = await prisma.wehowarePlaidItem.findUnique({
    where: { itemId },
  });
  if (existing && existing.clientId !== clientId) {
    return NextResponse.json(
      { error: "Plaid item already linked to another tenant" },
      { status: 409 }
    );
  }

  const encTok = encryptSecret(accessToken);
  const plaidItem = existing
    ? await prisma.wehowarePlaidItem.update({
        where: { itemId },
        data: {
          accessTokenEnc: encTok,
          institutionId: body?.institution?.id ?? existing.institutionId,
          institutionName: body?.institution?.name ?? existing.institutionName,
          status: "Active",
          errorCode: null,
          errorMessage: null,
        },
      })
    : await prisma.wehowarePlaidItem.create({
        data: {
          clientId,
          itemId,
          accessTokenEnc: encTok,
          institutionId: body?.institution?.id ?? null,
          institutionName: body?.institution?.name ?? null,
          status: "Active",
          createdBy: user.id,
        },
      });

  // Kick off initial sync synchronously — small enough for sandbox/dev
  let syncResult = null;
  try {
    syncResult = await syncPlaidItem({ plaidItemId: plaidItem.id });
  } catch (err) {
    // Sync failure is non-fatal; the item is still persisted so the user
    // can retry via the /sync endpoint.
    syncResult = {
      error: String(err?.message || err).slice(0, 500),
    };
  }

  return NextResponse.json(
    {
      id: plaidItem.id,
      item_id: plaidItem.itemId,
      institution_name: plaidItem.institutionName,
      status: plaidItem.status,
      sync: syncResult,
    },
    { status: 201 }
  );
});
