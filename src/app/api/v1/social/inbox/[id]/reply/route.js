/**
 * POST /api/v1/social/inbox/[id]/reply
 * Sends a reply in a conversation and stores it as an Outbound message.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";
import { getSocialClient } from "@/lib/social-clients/index.js";
import { MAX_REPLY_LENGTH } from "@/lib/social-clients/constants.js";

export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = user.activeClientId || user.clientId;
      if (!clientId) return NextResponse.json({ error: "No active client" }, { status: 400 });

      const conv = await prisma.wehowareSocialInboxConversation.findFirst({
        where: { id, clientId },
        include: {
          account: { include: { platform: true } },
        },
      });
      if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      if (conv.status === "Closed") {
        return NextResponse.json({ error: "Cannot reply to a closed conversation" }, { status: 409 });
      }

      const body = await request.json();
      const text = (body?.text || "").trim();
      if (!text) return NextResponse.json({ error: "Reply text is required" }, { status: 400 });
      if (text.length > MAX_REPLY_LENGTH) {
        return NextResponse.json(
          { error: `Reply exceeds maximum length of ${MAX_REPLY_LENGTH} characters` },
          { status: 400 }
        );
      }

      // Send via platform API
      const client = getSocialClient(conv.account);
      let platformMessageId;
      try {
        platformMessageId = await client.sendReply(
          conv.platformConversationId,
          conv.participantId,
          text
        );
      } catch (apiErr) {
        console.error("[inbox/reply] Platform send failed:", apiErr.message);
        return NextResponse.json({ error: "Failed to send reply via platform" }, { status: 502 });
      }

      // Store the outbound message locally
      const message = await prisma.wehowareSocialInboxMessage.create({
        data: {
          conversationId: conv.id,
          platformMessageId: platformMessageId || `local-${Date.now()}`,
          direction: "Outbound",
          senderName: conv.account.accountName,
          senderHandle: conv.account.accountHandle || null,
          senderAvatar: null,
          content: text,
          mediaUrls: [],
          isRead: true,
          sentAt: new Date(),
          metadata: {},
        },
      });

      // Update conversation preview
      await prisma.wehowareSocialInboxConversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: new Date(), lastMessagePreview: text.slice(0, 100) },
      });

      return NextResponse.json({
        message: {
          id: message.id,
          platform_message_id: message.platformMessageId,
          direction: message.direction,
          sender_name: message.senderName,
          content: message.content,
          sent_at: message.sentAt,
          is_read: message.isRead,
          media_urls: message.mediaUrls,
          metadata: message.metadata,
        },
      });
    } catch (err) {
      console.error("[POST /api/v1/social/inbox/[id]/reply]", err);
      return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
