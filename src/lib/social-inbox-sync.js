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
import { bridgeSocialConversationToCrm } from "@/lib/crm-bridge.js";

const INBOX_SUPPORTED_PLATFORMS = new Set(["facebook", "instagram", "twitter", "tiktok"]);

// Skip re-syncing an account that was synced this recently (unless forced).
const MIN_SYNC_INTERVAL_MS = 60_000;
// When a platform rate-limits us, stop calling it for this long so the
// app-level bucket can drain instead of staying saturated.
const RATE_LIMIT_BACKOFF_MS = 30 * 60_000;

function isRateLimitError(err) {
  return err?.statusCode === 429 || /request limit|rate limit/i.test(err?.message || "");
}

async function setRateLimitBackoff(account) {
  const until = new Date(Date.now() + RATE_LIMIT_BACKOFF_MS).toISOString();
  await prisma.wehowareSocialAccount.update({
    where: { id: account.id },
    data: {
      syncError: `Rate limited by ${account.platform?.platformCode} — backing off until ${until}`,
      profileData: { ...(account.profileData || {}), rateLimitedUntil: until },
    },
  });
}

// Per-account in-process lock — concurrent triggers (Meta webhook bursts,
// manual "Sync All", the inbox cron) would otherwise race the
// find-then-create checks below and collide on unique constraints.
const syncingAccounts = new Set();

/**
 * Sync inbox for a single connected account.
 * Returns a summary { conversationsSynced, messagesSynced, errors }.
 */
export async function syncInboxForAccount(account, { force = false } = {}) {
  if (!INBOX_SUPPORTED_PLATFORMS.has(account.platform?.platformCode)) {
    return { conversationsSynced: 0, messagesSynced: 0, errors: [] };
  }
  if (syncingAccounts.has(account.id)) {
    return { conversationsSynced: 0, messagesSynced: 0, errors: [], skipped: "already_running" };
  }
  syncingAccounts.add(account.id);
  try {
    return await runSyncForAccount(account, { force });
  } finally {
    syncingAccounts.delete(account.id);
  }
}

async function runSyncForAccount(account, { force = false } = {}) {

  // Honor an active rate-limit backoff — calls would just fail anyway.
  const backoffUntil = account.profileData?.rateLimitedUntil
    ? new Date(account.profileData.rateLimitedUntil).getTime()
    : 0;
  if (backoffUntil > Date.now()) {
    return {
      conversationsSynced: 0,
      messagesSynced: 0,
      errors: [`Rate limited until ${new Date(backoffUntil).toISOString()}`],
      skipped: "rate_limited",
    };
  }

  // Throttle: nothing newer can exist meaningfully more often than this.
  if (
    !force &&
    account.lastSyncedAt &&
    Date.now() - new Date(account.lastSyncedAt).getTime() < MIN_SYNC_INTERVAL_MS
  ) {
    return { conversationsSynced: 0, messagesSynced: 0, errors: [], skipped: "recently_synced" };
  }

  const errors = [];
  let conversationsSynced = 0;
  let messagesSynced = 0;
  let rateLimited = false;

  const client = getSocialClient(account);

  // ── Fetch conversations ──────────────────────────────────────────────────
  let platformConversations = [];
  try {
    platformConversations = await client.fetchConversations(account.lastSyncedAt);
  } catch (err) {
    console.error(`[inbox-sync] fetchConversations failed for account ${account.id}:`, err.message);
    if (isRateLimitError(err)) await setRateLimitBackoff(account);
    await prisma.wehowareSocialAccount.update({
      where: { id: account.id },
      data: { syncError: `Inbox sync failed: ${err.message}` },
    });
    return { conversationsSynced: 0, messagesSynced: 0, errors: [err.message] };
  }

  // ── Upsert each conversation + its messages ──────────────────────────────
  for (const conv of platformConversations) {
    if (rateLimited) break;
    try {
      const existing = await prisma.wehowareSocialInboxConversation.findUnique({
        where: {
          accountId_platformConversationId: {
            accountId: account.id,
            platformConversationId: conv.platformConversationId,
          },
        },
        select: { metadata: true, lastSyncedAt: true },
      });

      // Preserve local flags (unreadable) while merging platform flags (isGroup),
      // and track the platform's updated_time so unchanged threads can be
      // skipped without burning an API call.
      const platformUpdatedAt = conv.lastMessageAt ? conv.lastMessageAt.toISOString() : null;
      const mergedMeta = { ...(existing?.metadata || {}), ...(conv.metadata || {}) };
      if (platformUpdatedAt) mergedMeta.platformUpdatedAt = platformUpdatedAt;

      const unreadable = mergedMeta.unreadable || mergedMeta.isGroup;
      const unchanged =
        !!existing?.lastSyncedAt &&
        !!platformUpdatedAt &&
        existing.metadata?.platformUpdatedAt === platformUpdatedAt;

      let conversation;
      try {
        conversation = await prisma.wehowareSocialInboxConversation.upsert({
        where: {
          accountId_platformConversationId: {
            accountId: account.id,
            platformConversationId: conv.platformConversationId,
          },
        },
        update: {
          participantName: conv.participantName,
          participantId: conv.participantId,
          participantHandle: conv.participantHandle ?? undefined,
          participantAvatar: conv.participantAvatar ?? undefined,
          lastMessageAt: conv.lastMessageAt ?? undefined,
          lastMessagePreview: conv.lastMessagePreview ?? undefined,
          metadata: mergedMeta,
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
          metadata: mergedMeta,
        },
        });
      } catch (upsertErr) {
        // A concurrent sync inserted this conversation first — MySQL upserts
        // aren't atomic across two writers. Reuse the winning row.
        if (upsertErr?.code !== "P2002") throw upsertErr;
        conversation = await prisma.wehowareSocialInboxConversation.findUnique({
          where: {
            accountId_platformConversationId: {
              accountId: account.id,
              platformConversationId: conv.platformConversationId,
            },
          },
        });
        if (!conversation) throw upsertErr;
      }

      // ── Fetch messages for this conversation (delta) ─────────────────────
      // Skipped when: the thread is unreadable/group (API can't load it) or
      // its platform updated_time hasn't moved since the last sync.
      let platformMessages = [];
      if (!(unreadable || unchanged)) {
        try {
          platformMessages = await client.fetchMessages(
            conv.platformConversationId,
            conversation.lastSyncedAt
          );
        } catch (msgErr) {
          console.warn(`[inbox-sync] fetchMessages failed for conv ${conv.platformConversationId}:`, msgErr.message);
          if (isRateLimitError(msgErr)) {
            await setRateLimitBackoff(account);
            rateLimited = true;
            break;
          }
          if (/Unsupported get request/.test(msgErr.message)) {
            await prisma.wehowareSocialInboxConversation.update({
              where: { id: conversation.id },
              data: { metadata: { ...mergedMeta, unreadable: true } },
            });
          } else {
            errors.push(`Messages: ${msgErr.message}`);
          }
        }
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
            try {
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
            } catch (createErr) {
              // A concurrent sync inserted this message first — not an error.
              if (createErr?.code !== "P2002") throw createErr;
            }
          }
        } catch (msgErr) {
          console.warn(`[inbox-sync] Message upsert failed:`, msgErr.message);
          errors.push(msgErr.message);
        }
      }

      // Bump unread count and mark last sync time
      // Also update lastMessagePreview from the latest message in the thread
      let latestMessage = null;
      if (platformMessages.length > 0) {
        latestMessage = platformMessages.reduce((latest, msg) => {
          if (!latest || new Date(msg.sentAt) > new Date(latest.sentAt)) return msg;
          return latest;
        }, null);
      }

      const convUpdateData = {
        lastSyncedAt: new Date(),
        ...(newInbound > 0 ? { unreadCount: { increment: newInbound } } : {}),
      };
      // Update lastMessagePreview from the latest message if available
      if (latestMessage?.content) {
        const previewContent = latestMessage.content.length > 200
          ? latestMessage.content.slice(0, 200) + "..."
          : latestMessage.content;
        convUpdateData.lastMessagePreview = previewContent;
        convUpdateData.lastMessageAt = new Date(latestMessage.sentAt);
      }

      await prisma.wehowareSocialInboxConversation.update({
        where: { id: conversation.id },
        data: convUpdateData,
      });

      conversationsSynced++;

      // Bridge new conversations to CRM contacts
      if (!conversation.lastSyncedAt) {
        try {
          await bridgeSocialConversationToCrm({
            clientId: account.clientId,
            conversationId: conversation.id,
            platform: account.platform.platformCode,
            senderName: conv.participantName,
            senderUsername: conv.participantHandle,
            senderProfileUrl: conv.participantAvatar,
            messageContent: conv.lastMessagePreview,
          });
        } catch (bridgeErr) {
          console.warn(`[inbox-sync] CRM bridge failed for conv ${conversation.id}:`, bridgeErr.message);
        }
      }
    } catch (convErr) {
      console.error(`[inbox-sync] Conversation upsert failed:`, convErr.message);
      errors.push(convErr.message);
    }
  }

  // Update account sync timestamp, clear any previous error and stale backoff
  if (!rateLimited) {
    const { rateLimitedUntil: _drop, ...cleanProfile } = account.profileData || {};
    await prisma.wehowareSocialAccount.update({
      where: { id: account.id },
      data: { lastSyncedAt: new Date(), syncError: null, profileData: cleanProfile },
    });
  }

  return { conversationsSynced, messagesSynced, errors };
}

/**
 * Sync all active accounts for a given client.
 * Each account runs concurrently (Promise.allSettled — one failure won't block others).
 * Pass { force: true } to bypass the per-account min-interval throttle
 * (rate-limit backoff is always honored).
 */
export async function syncAllInboxes(clientId, opts = {}) {
  const accounts = await prisma.wehowareSocialAccount.findMany({
    where: { clientId, status: "Active" },
    include: { platform: true },
  });

  const results = await Promise.allSettled(
    accounts.map((account) => syncInboxForAccount(account, opts))
  );

  return results.map((r, i) => ({
    accountId: accounts[i].id,
    platformCode: accounts[i].platform?.platformCode,
    ...(r.status === "fulfilled" ? r.value : { errors: [r.reason?.message || "Unknown error"] }),
  }));
}
