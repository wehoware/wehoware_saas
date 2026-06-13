/**
 * GET /api/v1/social/inbox/[id]  — conversation with full message thread
 * PUT /api/v1/social/inbox/[id]  — update conversation status (Open/Archived/Closed)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

const VALID_STATUSES = new Set(["Open", "Archived", "Closed"]);
const MESSAGE_LIMIT = 100;

function resolveConversation(prisma, id, clientId) {
  return prisma.wehowareSocialInboxConversation.findFirst({
    where: { id, clientId },
    include: {
      account: {
        select: {
          id: true, accountName: true, accountHandle: true,
          platform: { select: { id: true, name: true, platformCode: true, logoUrl: true } },
        },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        take: MESSAGE_LIMIT,
      },
    },
  });
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const clientId = user.activeClientId || user.clientId;
    if (!clientId) return NextResponse.json({ error: "No active client" }, { status: 400 });

    const conv = await resolveConversation(prisma, id, clientId);
    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    return NextResponse.json({
      conversation: {
        id: conv.id,
        account_id: conv.accountId,
        platform_code: conv.platformCode,
        platform_conversation_id: conv.platformConversationId,
        participant_name: conv.participantName,
        participant_handle: conv.participantHandle,
        participant_avatar: conv.participantAvatar,
        participant_id: conv.participantId,
        last_message_at: conv.lastMessageAt,
        unread_count: conv.unreadCount,
        status: conv.status,
        last_synced_at: conv.lastSyncedAt,
        metadata: conv.metadata,
        account: conv.account,
        messages: conv.messages.map((m) => ({
          id: m.id,
          platform_message_id: m.platformMessageId,
          direction: m.direction,
          sender_name: m.senderName,
          sender_handle: m.senderHandle,
          sender_avatar: m.senderAvatar,
          content: m.content,
          media_urls: m.mediaUrls,
          is_read: m.isRead,
          sent_at: m.sentAt,
          metadata: m.metadata,
        })),
      },
    });
  } catch (err) {
    console.error("[GET /api/v1/social/inbox/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const clientId = user.activeClientId || user.clientId;
    if (!clientId) return NextResponse.json({ error: "No active client" }, { status: 400 });

    const conv = await prisma.wehowareSocialInboxConversation.findFirst({
      where: { id, clientId },
    });
    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const body = await request.json();
    const { status } = body ?? {};

    if (status && !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` },
        { status: 400 }
      );
    }

    const updated = await prisma.wehowareSocialInboxConversation.update({
      where: { id },
      data: { ...(status ? { status } : {}) },
    });

    return NextResponse.json({ conversation: { id: updated.id, status: updated.status } });
  } catch (err) {
    console.error("[PUT /api/v1/social/inbox/[id]]", err);
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
});
