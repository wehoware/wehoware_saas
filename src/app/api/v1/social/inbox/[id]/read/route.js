/**
 * POST /api/v1/social/inbox/[id]/read
 * Marks all messages in a conversation as read and resets unreadCount.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";

export const POST = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const clientId = user.activeClientId || user.clientId;
    if (!clientId) return NextResponse.json({ error: "No active client" }, { status: 400 });

    const conv = await prisma.wehowareSocialInboxConversation.findFirst({
      where: { id, clientId },
    });
    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    await prisma.$transaction([
      prisma.wehowareSocialInboxMessage.updateMany({
        where: { conversationId: id, isRead: false },
        data: { isRead: true },
      }),
      prisma.wehowareSocialInboxConversation.update({
        where: { id },
        data: { unreadCount: 0 },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/v1/social/inbox/[id]/read]", err);
    return NextResponse.json({ error: "Failed to mark conversation as read" }, { status: 500 });
  }
});
