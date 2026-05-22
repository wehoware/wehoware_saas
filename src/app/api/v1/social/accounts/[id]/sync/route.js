/**
 * POST /api/v1/social/accounts/[id]/sync
 * Manually syncs account data from the platform API.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";

export const POST = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const clientId = user.activeClientId || user.clientId;

    const account = await prisma.wehowareSocialAccount.findFirst({
      where: { id, ...(user.role !== "admin" ? { clientId } : {}) },
      include: { platform: true },
    });
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    if (account.status === "Disconnected") {
      return NextResponse.json({ error: "Cannot sync a disconnected account" }, { status: 400 });
    }

    await prisma.wehowareSocialAccount.update({
      where: { id },
      data: { lastSyncedAt: new Date(), syncError: null },
    });

    return NextResponse.json({ success: true, synced_at: new Date().toISOString() });
  } catch (err) {
    console.error("[POST /api/v1/social/accounts/[id]/sync]", err);
    return NextResponse.json({ error: "Failed to sync account" }, { status: 500 });
  }
});
