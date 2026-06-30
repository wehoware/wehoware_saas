/**
 * POST /api/v1/social/accounts/[id]/sync
 * Manually syncs account data from the platform API.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";
import { getSocialClient } from "@/lib/social-clients/index.js";

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

    try {
      const client = getSocialClient(account);
      const profile = await client.getProfile();

      await prisma.wehowareSocialAccount.update({
        where: { id },
        data: {
          accountName: profile.accountName,
          accountHandle: profile.accountHandle,
          profileData: { ...profile.profileData, followerCount: profile.followerCount },
          lastSyncedAt: new Date(),
          syncError: null,
        },
      });

      return NextResponse.json({ success: true, synced_at: new Date().toISOString() });
    } catch (syncErr) {
      console.error("[POST /api/v1/social/accounts/[id]/sync] profile fetch failed:", syncErr);
      await prisma.wehowareSocialAccount.update({
        where: { id },
        data: {
          lastSyncedAt: new Date(),
          syncError: syncErr.message || "Sync failed",
        },
      });
      return NextResponse.json({ error: "Failed to sync account profile" }, { status: 502 });
    }
  } catch (err) {
    console.error("[POST /api/v1/social/accounts/[id]/sync]", err);
    return NextResponse.json({ error: "Failed to sync account" }, { status: 500 });
  }
});
