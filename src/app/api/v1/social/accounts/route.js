/**
 * GET  /api/v1/social/accounts — List accounts for active client
 * POST /api/v1/social/accounts — (unused, accounts created via OAuth callback)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const { searchParams } = new URL(request.url);
    const clientId = user.activeClientId || user.clientId;
    if (!clientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }

    const where = { clientId };
    const statusFilter = searchParams.get("status");
    const platformFilter = searchParams.get("platform");
    if (statusFilter) where.status = statusFilter;
    if (platformFilter) {
      where.platform = { platformCode: platformFilter };
    }

    const accounts = await prisma.wehowareSocialAccount.findMany({
      where,
      include: {
        platform: { select: { id: true, name: true, platformCode: true, logoUrl: true } },
        _count: { select: { accountPosts: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const shaped = accounts.map((a) => ({
      id: a.id,
      client_id: a.clientId,
      platform_id: a.platformId,
      account_name: a.accountName,
      account_handle: a.accountHandle,
      account_id: a.accountId,
      status: a.status,
      last_synced_at: a.lastSyncedAt,
      sync_error: a.syncError,
      created_at: a.createdAt,
      token_expires_at: a.tokenExpiresAt,
      platform: a.platform,
      posts_count: a._count.accountPosts,
      profile_data: {
        pageId: a.profileData?.pageId,
        username: a.profileData?.username || a.profileData?.igUserId,
      },
    }));

    return NextResponse.json({ accounts: shaped });
  } catch (err) {
    console.error("[GET /api/v1/social/accounts]", err);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
});
