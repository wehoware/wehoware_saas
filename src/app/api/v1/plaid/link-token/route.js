/**
 * POST /api/v1/plaid/link-token
 * Creates a short-lived link_token that the browser SDK uses to open Plaid
 * Link. Scoped to the currently authenticated profile; tenant id is
 * embedded in the client_user_id so the webhook can correlate back.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import {
  getPlaidClient,
  plaidProducts,
  plaidCountryCodes,
} from "@/lib/plaid/client";

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

  let plaid;
  try {
    plaid = await getPlaidClient();
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Plaid not configured" },
      { status: 503 }
    );
  }

  try {
    const resp = await plaid.linkTokenCreate({
      user: { client_user_id: `${clientId}:${user.id}` },
      client_name: "Wehoware",
      products: plaidProducts(),
      country_codes: plaidCountryCodes(),
      language: "en",
      webhook: process.env.PLAID_WEBHOOK_URL || undefined,
    });
    const data = resp.data || resp;
    return NextResponse.json(
      { link_token: data.link_token, expiration: data.expiration },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to create Plaid link token",
        detail: err?.response?.data?.error_message || err?.message,
      },
      { status: 502 }
    );
  }
}, { allowedRoles: ["admin", "client"], allowedClientRoles: ["client"] });
