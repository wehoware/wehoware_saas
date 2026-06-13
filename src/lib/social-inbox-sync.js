/**
 * Social Inbox Sync Service
 *
 * Pulls conversations and messages from each connected platform into the
 * local DB. Designed for:
 *   • On-demand sync (user visits inbox or clicks Sync)
 *   • Background cron (call syncAllInboxes from a cron route)
 *
 * Each conversation tracks `lastSyncedAt` so subsequent syncs only fetch
 * deltas — newer messages are requested with a `since` timestamp.
 */
import { prisma } from "@/lib/prisma";
import { getSocialClient } from "@/lib/social-clients/index.js";

const INBOX_SUPPORTED_PLATFORMS = new Set(["facebook", "instagram", "twitter", "tiktok"]);

/**
 * Sync inbox for a single connected account.
 * Returns a summary { conversationsSynced, messagesSynced, errors }.
 */
export async function syncInboxForAccount(account) {
  if (!INBOX_SUPPORTED_PLATFORMS.has(account.platform?.platformCode)) {
    return { conversationsSynced: 0, messagesSynced: 0, errors: [] };
  }

  const errors = [];
  let conversationsSynced = 0;
  let messagesSynced = 0;

  const client = getSocialClient(account);

  // ── Fetch conversations ──────────────────────────────────────────────────
  let platformConversations = [];
  try {
    platformConversations = await client.fetchConversations(account.lastSyncedAt);
  } catch (err) {
    console.error(`[inbox-sync] fetchConversations failed for account ${account.id}:`, err.message);
    await prisma.wehowareSocialAccount.update({
      where: { id: account.id },
      data: { syncError: `Inbox sync failed: ${err.message}` },
    });
    return { conversationsSynced: 0, messagesSynced: 0, errors: [err.message] };
  }

  // ── Upsert each conversation + its messages ──────────────────────────────
  for (const conv of platformConversations) {
    try {
      const conversation = await prisma.wehowareSocialInboxConversation.upsert({
        where: {
          accountId_platformConversationId: {
            accountId: account.id,
            platformConversationId: conv.platformConversationId,
          },
        },
        update: {
          participantName: conv.participantName,
          participantHandle: conv.participantHandle ?? undefined,
          participantAvatar: conv.participantAvatar ?? undefined,
          lastMessageAt: conv.lastMessageAt ?? undefined,
          lastMessagePreview: conv.lastMessagePreview ?? undefined,
          metadata: conv.metadata || {},
          updatedAt: new Date(),
        },
        create: {
          clientId: account.clientId,
          accountId: account.id,
          platformCode: account.platform.platformCode,
          platformConversationId: conv.platformConversationId,
          participantName: conv.participantName,
          participantHandle: conv.participantHandle || null,
          participantAvatar: conv.participantAvatar || null,
          participantId: conv.participantId,
          lastMessageAt: conv.lastMessageAt || null,
          lastMessagePreview: conv.lastMessagePreview || null,
          unreadCount: 0,
          status: "Open",
          metadata: conv.metadata || {},
        },
      });

      // ── Fetch messages for this conversation (delta) ─────────────────────
      let platformMessages = [];
      try {
        platformMessages = await client.fetchMessages(
          conv.platformConversationId,
          conversation.lastSyncedAt
        );
      } catch (msgErr) {
        console.warn(`[inbox-sync] fetchMessages failed for conv ${conv.platformConversationId}:`, msgErr.message);
        errors.push(`Messages: ${msgErr.message}`);
      }

      let newInbound = 0;
      for (const msg of platformMessages) {
        try {
          const exists = await prisma.wehowareSocialInboxMessage.findUnique({
            where: {
              conversationId_platformMessageId: {
                conversationId: conversation.id,
                platformMessageId: msg.platformMessageId,
              },
            },
            select: { id: true },
          });
          if (!exists) {
            await prisma.wehowareSocialInboxMessage.create({
              data: {
                conversationId: conversation.id,
                platformMessageId: msg.platformMessageId,
                direction: msg.direction,
                senderName: msg.senderName,
                senderHandle: msg.senderHandle || null,
                senderAvatar: msg.senderAvatar || null,
                content: msg.content,
                mediaUrls: msg.mediaUrls || [],
                isRead: msg.direction === "Outbound",
                sentAt: msg.sentAt,
                metadata: msg.metadata || {},
              },
            });
            if (msg.direction === "Inbound") newInbound++;
            messagesSynced++;
          }
        } catch (msgErr) {
          console.warn(`[inbox-sync] Message upsert failed:`, msgErr.message);
          errors.push(msgErr.message);
        }
      }

      // Bump unread count and mark last sync time
      await prisma.wehowareSocialInboxConversation.update({
        where: { id: conversation.id },
        data: {
          lastSyncedAt: new Date(),
          ...(newInbound > 0 ? { unreadCount: { increment: newInbound } } : {}),
        },
      });

      conversationsSynced++;
    } catch (convErr) {
      console.error(`[inbox-sync] Conversation upsert failed:`, convErr.message);
      errors.push(convErr.message);
    }
  }

  // Update account sync timestamp and clear any previous error
  await prisma.wehowareSocialAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date(), syncError: null },
  });

  return { conversationsSynced, messagesSynced, errors };
}

/**
 * Sync all active accounts for a given client.
 * Each account runs concurrently (Promise.allSettled — one failure won't block others).
 */
export async function syncAllInboxes(clientId) {
  const accounts = await prisma.wehowareSocialAccount.findMany({
    where: { clientId, status: "Active" },
    include: { platform: true },
  });

  const results = await Promise.allSettled(
    accounts.map((account) => syncInboxForAccount(account))
  );

  return results.map((r, i) => ({
    accountId: accounts[i].id,
    platformCode: accounts[i].platform?.platformCode,
    ...(r.status === "fulfilled" ? r.value : { errors: [r.reason?.message || "Unknown error"] }),
  }));
}
