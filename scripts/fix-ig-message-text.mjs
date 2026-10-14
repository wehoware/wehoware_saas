// One-off repair: Instagram messages were synced using the wrong field names
// (text/timestamp instead of message/created_time), so text messages were
// stored as "[Media message]" with sentAt = sync time. Re-fetches messages via
// the fixed client and UPDATES content/sentAt in place. Nothing is deleted.
import { PrismaClient } from "@prisma/client";
import { InstagramClient } from "../src/lib/social-clients/instagram-client.js";

const prisma = new PrismaClient();
const stats = { convs: 0, msgsFixed: 0, failed: 0 };

try {
  const accounts = await prisma.wehowareSocialAccount.findMany({
    where: { platform: { platformCode: "instagram" }, status: "Active" },
    include: { platform: true },
  });
  console.log(`Found ${accounts.length} active IG account(s)`);

  for (const acct of accounts) {
    console.log(`\n── ${acct.accountName} ${acct.accountHandle || ""} ──`);
    const client = new InstagramClient(acct);

    const convs = (
      await prisma.wehowareSocialInboxConversation.findMany({
        where: { accountId: acct.id },
      })
    ).filter((c) => !c.metadata?.unreadable && !c.metadata?.isGroup);
    console.log(`  ${convs.length} stored conversations`);

    for (const conv of convs) {
      let platformMsgs;
      try {
        platformMsgs = await client.fetchMessages(conv.platformConversationId);
      } catch (e) {
        stats.failed++;
        console.log(`  conv ${conv.platformConversationId.slice(0, 24)}… fetch failed: ${e.message.slice(0, 100)}`);
        continue;
      }
      stats.convs++;
      const byPlatId = new Map(platformMsgs.map((m) => [m.platformMessageId, m]));

      const storedMsgs = await prisma.wehowareSocialInboxMessage.findMany({
        where: { conversationId: conv.id },
        select: { id: true, platformMessageId: true, content: true, sentAt: true },
      });

      let fixed = 0;
      for (const sm of storedMsgs) {
        const truth = byPlatId.get(sm.platformMessageId);
        if (!truth) continue;
        const truthSentAt = truth.sentAt instanceof Date ? truth.sentAt : new Date(truth.sentAt);
        const contentChanged = truth.content !== sm.content;
        const timeChanged = Math.abs(truthSentAt - new Date(sm.sentAt)) > 1000;
        if (contentChanged || timeChanged) {
          await prisma.wehowareSocialInboxMessage.update({
            where: { id: sm.id },
            data: {
              content: truth.content,
              sentAt: truthSentAt,
              ...(truth.mediaUrls?.length ? { mediaUrls: truth.mediaUrls } : {}),
            },
          });
          fixed++;
        }
      }
      stats.msgsFixed += fixed;
      if (fixed) console.log(`  conv ${conv.platformConversationId.slice(0, 24)}… peer=${conv.participantName}: fixed ${fixed} messages`);
    }
  }

  console.log("\n══ Done ══");
  console.log(`  conversations checked: ${stats.convs}`);
  console.log(`  conversations failed: ${stats.failed}`);
  console.log(`  messages repaired: ${stats.msgsFixed}`);
} catch (e) {
  console.error("FATAL:", e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
