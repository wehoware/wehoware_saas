// One-off repair: Instagram conversations were synced with IGSID-vs-node-id
// confusion — peer identity resolved to the account itself and every message
// was stored as "Inbound". Re-fetches conversations/messages via the fixed
// client and UPDATES mismatched rows in place. Nothing is deleted.
import { PrismaClient } from "@prisma/client";
import { InstagramClient } from "../src/lib/social-clients/instagram-client.js";

const prisma = new PrismaClient();
const stats = { convsFixed: 0, groupsMarked: 0, msgsFlipped: 0, unreadable: 0 };

try {
  const accounts = await prisma.wehowareSocialAccount.findMany({
    where: { platform: { platformCode: "instagram" }, status: "Active" },
    include: { platform: true },
  });
  console.log(`Found ${accounts.length} active IG account(s)`);

  for (const acct of accounts) {
    console.log(`\n── ${acct.accountName} ${acct.accountHandle || ""} ──`);
    const client = new InstagramClient(acct);

    let platformConvs;
    try {
      platformConvs = await client.fetchConversations();
    } catch (e) {
      console.log(`  fetchConversations failed: ${e.message} — skipping account`);
      continue;
    }
    console.log(`  ${platformConvs.length} platform conversations`);

    // Persist resolved IGSID back to the account so syncs skip the /me call
    if (client._igsid && acct.profileData?.igsid !== client._igsid) {
      await prisma.wehowareSocialAccount.update({
        where: { id: acct.id },
        data: { profileData: { ...acct.profileData, igsid: client._igsid } },
      });
      console.log(`  stored igsid=${client._igsid} on account profileData`);
    }

    for (const pc of platformConvs) {
      const stored = await prisma.wehowareSocialInboxConversation.findFirst({
        where: { accountId: acct.id, platformConversationId: pc.platformConversationId },
      });
      if (!stored) continue; // not synced yet — next sync will create it correctly
      if (stored.metadata?.seeded) continue;

      const isGroup = pc.metadata?.isGroup === true;
      const newMeta = { ...stored.metadata, ...(isGroup ? { isGroup: true, unreadable: true } : {}) };

      // Repair conversation-level fields (peer identity was self)
      await prisma.wehowareSocialInboxConversation.update({
        where: { id: stored.id },
        data: {
          participantName: pc.participantName,
          participantId: pc.participantId,
          participantHandle: pc.participantHandle,
          metadata: newMeta,
        },
      });
      stats.convsFixed++;
      if (isGroup) { stats.groupsMarked++; continue; }

      // Repair message directions
      let platformMsgs;
      try {
        platformMsgs = await client.fetchMessages(pc.platformConversationId);
      } catch (e) {
        if (/Unsupported get request/.test(e.message)) {
          await prisma.wehowareSocialInboxConversation.update({
            where: { id: stored.id },
            data: { metadata: { ...newMeta, unreadable: true } },
          });
          stats.unreadable++;
          console.log(`  conv ${pc.platformConversationId.slice(0, 24)}… → unreadable (non-group)`);
          continue;
        }
        console.log(`  conv ${pc.platformConversationId.slice(0, 24)}… fetch failed: ${e.message.slice(0, 100)}`);
        continue;
      }

      const byPlatId = new Map(platformMsgs.map((m) => [m.platformMessageId, m]));
      const storedMsgs = await prisma.wehowareSocialInboxMessage.findMany({
        where: { conversationId: stored.id },
        select: { id: true, platformMessageId: true, direction: true },
      });
      let flipped = 0;
      for (const sm of storedMsgs) {
        const truth = byPlatId.get(sm.platformMessageId);
        if (truth && truth.direction !== sm.direction) {
          await prisma.wehowareSocialInboxMessage.update({
            where: { id: sm.id },
            data: { direction: truth.direction, isRead: truth.direction === "Outbound" ? true : sm.isRead },
          });
          flipped++;
        }
      }
      stats.msgsFlipped += flipped;

      // Recount unread (inbound + unread)
      const unread = await prisma.wehowareSocialInboxMessage.count({
        where: { conversationId: stored.id, direction: "Inbound", isRead: false },
      });
      await prisma.wehowareSocialInboxConversation.update({
        where: { id: stored.id },
        data: { unreadCount: unread },
      });
      if (flipped) console.log(`  conv ${pc.platformConversationId.slice(0, 24)}… peer=${pc.participantName}: flipped ${flipped} messages, unread=${unread}`);
    }
  }

  console.log("\n══ Done ══");
  console.log(`  conversations repaired: ${stats.convsFixed}`);
  console.log(`  group threads marked unreadable: ${stats.groupsMarked}`);
  console.log(`  other unreadable conversations: ${stats.unreadable}`);
  console.log(`  messages flipped to correct direction: ${stats.msgsFlipped}`);
} catch (e) {
  console.error("FATAL:", e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
