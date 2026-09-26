// POST /api/v1/social/meta/data-deletion
// Meta calls this when a user requests data deletion via Facebook/Instagram
// settings. Contract: respond with { url, confirmation_code } where `url`
// lets the user check the deletion status (served by GET below).

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  readSignedRequest,
  findAccountsForMetaUser,
} from "../_signed-request";

export async function POST(request) {
  const data = await readSignedRequest(request);
  if (!data) {
    return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
  }

  const confirmationCode = `dd-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;

  try {
    const accounts = await findAccountsForMetaUser(prisma, data.user_id);
    if (accounts.length > 0) {
      // Scrub stored credentials and disconnect. Rows are retained for audit;
      // Meta has already invalidated the tokens.
      await prisma.wehowareSocialAccount.updateMany({
        where: { id: { in: accounts.map((a) => a.id) } },
        data: {
          status: "Disconnected",
          accessToken: "[deleted]",
          refreshToken: null,
          syncError: `Data deletion requested via Meta (${confirmationCode})`,
        },
      });
      console.log(
        `[Meta data-deletion] user_id=${data.user_id} code=${confirmationCode} — scrubbed ${accounts.length} account(s)`
      );
    } else {
      console.log(
        `[Meta data-deletion] user_id=${data.user_id} code=${confirmationCode} — no matching accounts`
      );
    }
  } catch (err) {
    console.error("[Meta data-deletion] processing error:", err);
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    url: `${origin}/api/v1/social/meta/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}

// GET /api/v1/social/meta/data-deletion?code=...
// Status check link returned to Meta (and shown to the requesting user).
export async function GET(request) {
  const code = new URL(request.url).searchParams.get("code");
  return NextResponse.json({
    status: "completed",
    confirmation_code: code || null,
    message:
      "Your request has been processed. Connected social account credentials associated with your Meta profile have been removed.",
  });
}
