/**
 * GET  /api/v1/social/inbox  — paginated conversation list
 * Query params:
 *   status   = Open | Archived | Closed  (default: Open)
 *   platform = facebook | instagram | twitter | tiktok
 *   unread   = true  (only conversations with unreadCount > 0)
 *   page, limit
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const VALID_STATUSES = new Set(["Open", "Archived", "Closed"]);

function shapeConversation(c) {
  return {
    id: c.id,
    account_id: c.accountId,
    platform_code: c.platformCode,
    platform_conversation_id: c.platformConversationId,
    participant_name: c.participantName,
    participant_handle: c.participantHandle,
    participant_avatar: c.participantAvatar,
    participant_id: c.participantId,
    last_message_at: c.lastMessageAt,
    last_message_preview: c.lastMessagePreview,
    unread_count: c.unreadCount,
    status: c.status,
    last_synced_at: c.lastSyncedAt,
    created_at: c.createdAt,
    account: c.account
      ? {
          id: c.account.id,
          account_name: c.account.accountName,
          account_handle: c.account.accountHandle,
          platform: c.account.platform,
        }
      : null,
  };
}

export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const { searchParams } = new URL(request.url);
    const clientId = user.activeClientId || user.clientId;
    if (!clientId) return NextResponse.json({ error: "No active client" }, { status: 400 });

    const statusFilter = searchParams.get("status") || "Open";
    if (!VALID_STATUSES.has(statusFilter)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` },
        { status: 400 }
      );
    }

    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10)));
    const platformFilter = searchParams.get("platform");
    const unreadOnly = searchParams.get("unread") === "true";
    const searchQuery = searchParams.get("search")?.trim();

    const where = { clientId, status: statusFilter };
    if (platformFilter) where.platformCode = platformFilter;
    if (unreadOnly) where.unreadCount = { gt: 0 };
    if (searchQuery) {
      where.OR = [
        { participantName: { contains: searchQuery } },
        { participantHandle: { contains: searchQuery } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.wehowareSocialInboxConversation.findMany({
        where,
        include: {
          account: {
            select: {
              id: true, accountName: true, accountHandle: true,
              platform: { select: { id: true, name: true, platformCode: true, logoUrl: true } },
            },
          },
        },
        orderBy: { lastMessageAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wehowareSocialInboxConversation.count({ where }),
    ]);

    return NextResponse.json({
      conversations: conversations.map(shapeConversation),
      total,
      page,
      limit,
      unread_total: await prisma.wehowareSocialInboxConversation.count({
        where: { clientId, status: "Open", unreadCount: { gt: 0 } },
      }),
    });
  } catch (err) {
    console.error("[GET /api/v1/social/inbox]", err);
    return NextResponse.json({ error: "Failed to fetch inbox" }, { status: 500 });
  }
});
