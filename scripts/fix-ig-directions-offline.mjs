// Offline repair: outbound IG messages were stored as "Inbound" due to the
// IGSID bug. Self-sent messages are identifiable by senderHandle === the
// account's own handle — no API calls needed (works while rate-limited).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

try {
  const accounts = await prisma.wehowareSocialAccount.findMany({
    where: { platform: { platformCode: "instagram" } },
    include: { platform: true },
  });

  for (const acct of accounts) {
    const handle = (acct.accountHandle || acct.accountName || "").replace(/^@/, "");
    if (!handle) continue;
    const convs = await prisma.wehowareSocialInboxConversation.findMany({
      where: { accountId: acct.id },
      select: { id: true, metadata: true },
    });
    const convIds = convs.map((c) => c.id);
    if (!convIds.length) continue;

    const res = await prisma.wehowareSocialInboxMessage.updateMany({
      where: {
        conversationId: { in: convIds },
        direction: "Inbound",
        OR: [
          { senderHandle: `@${handle}` },
          { senderHandle: handle },
          { senderName: handle },
          { senderName: acct.accountName },
        ],
      },
      data: { direction: "Outbound", isRead: true },
    });
    console.log(`${acct.accountName}: flipped ${res.count} messages to Outbound`);

    // Recompute unread counts
    for (const c of convs) {
      const unread = await prisma.wehowareSocialInboxMessage.count({
        where: { conversationId: c.id, direction: "Inbound", isRead: false },
      });
      await prisma.wehowareSocialInboxConversation.update({
        where: { id: c.id },
        data: { unreadCount: unread },
      });
    }
    console.log(`${acct.accountName}: unread counts recomputed for ${convs.length} conversations`);
  }
} catch (e) {
  console.error("FATAL:", e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
