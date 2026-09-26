// POST /api/v1/social/meta/deauthorize
// Meta calls this when a user removes the app's authorization in Facebook/
// Instagram settings. No session — authenticity comes from signed_request.
// Meta only requires a 200 response; processing is best-effort.

import { NextResponse } from "next/server";
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

  try {
    const accounts = await findAccountsForMetaUser(prisma, data.user_id);
    if (accounts.length > 0) {
      await prisma.wehowareSocialAccount.updateMany({
        where: { id: { in: accounts.map((a) => a.id) } },
        data: {
          status: "Disconnected",
          syncError: "Authorization revoked by user on Meta platform",
        },
      });
      console.log(
        `[Meta deauthorize] user_id=${data.user_id} — disconnected ${accounts.length} account(s)`
      );
    } else {
      console.log(`[Meta deauthorize] user_id=${data.user_id} — no matching accounts`);
    }
  } catch (err) {
    // Still return 200 — Meta retries otherwise, and revocation is dead either way
    console.error("[Meta deauthorize] processing error:", err);
  }

  return NextResponse.json({ success: true });
}
