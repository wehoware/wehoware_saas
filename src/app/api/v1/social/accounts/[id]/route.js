/**
 * GET    /api/v1/social/accounts/[id] — Get account details
 * PUT    /api/v1/social/accounts/[id] — Update account status/config
 * DELETE /api/v1/social/accounts/[id] — Disconnect account
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

const ACCOUNT_INCLUDE = {
  platform: { select: { id: true, name: true, platformCode: true, logoUrl: true, rateLimits: true } },
  _count: { select: { accountPosts: true } },
};

function shapeAccount(a) {
  return {
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
    updated_at: a.updatedAt,
    token_expires_at: a.tokenExpiresAt,
    platform: a.platform,
    posts_count: a._count?.accountPosts ?? 0,
    profile_data: {
      pageId: a.profileData?.pageId,
      username: a.profileData?.username || a.profileData?.igUserId,
    },
  };
}

async function resolveAccount(prisma, id, user) {
  const clientId = user.activeClientId || user.clientId;
  const account = await prisma.wehowareSocialAccount.findFirst({
    where: { id, ...(user.role !== "admin" ? { clientId } : {}) },
    include: ACCOUNT_INCLUDE,
  });
  return account;
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const account = await resolveAccount(prisma, id, user);
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    return NextResponse.json({ account: shapeAccount(account) });
  } catch (err) {
    console.error("[GET /api/v1/social/accounts/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch account" }, { status: 500 });
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const account = await resolveAccount(prisma, id, user);
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const body = await request.json();
    const { status } = body ?? {};

    const VALID_STATUSES = ["Active", "Paused", "Disconnected"];
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }

    const updated = await prisma.wehowareSocialAccount.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        updatedBy: user.id,
      },
      include: ACCOUNT_INCLUDE,
    });
    return NextResponse.json({ account: shapeAccount(updated) });
  } catch (err) {
    console.error("[PUT /api/v1/social/accounts/[id]]", err);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const account = await resolveAccount(prisma, id, user);
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    // Permanently delete the account and all related data (accountPosts,
    // inbox conversations) via cascade. This is irreversible.
    await prisma.wehowareSocialAccount.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/v1/social/accounts/[id]]", err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
});
