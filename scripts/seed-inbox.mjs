#!/usr/bin/env node
/**
 * scripts/seed-inbox.mjs
 *
 * Seeds demo social inbox conversations + messages onto EXISTING connected
 * social accounts so the inbox UI has content to show without platform API
 * access.
 *
 * Usage:
 *   node scripts/seed-inbox.mjs
 *
 * Safe to re-run: conversations upsert on [accountId, platformConversationId]
 * with `seed-conv-*` ids; messages upsert on [conversationId, platformMessageId]
 * with `seed-msg-*` ids.
 *
 * Never deletes anything.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

const prisma = new PrismaClient();
const now = Date.now();
const mins = (n) => new Date(now - n * 60_000);
const avatar = (n) => `https://i.pravatar.cc/150?img=${n}`;

// ── Seed threads: which platform account they attach to + the messages ──────
// dir: "in" = inbound (from the participant), "out" = outbound (account reply)
// Each msg: [dir, text, minutesAgo]
const THREADS = [
  {
    platform: "instagram",
    convId: "seed-conv-ig-1",
    participant: { name: "Sarah Mitchell", handle: "sarah.m.fit", avatar: avatar(47), id: "ig-user-9001" },
    status: "Open",
    msgs: [
      ["in", "Hi! I saw your post about the wellness packages — do you have availability this weekend?", 290],
      ["out", "Hi Sarah! Yes, we have a few slots open Saturday afternoon. What service are you interested in?", 285],
      ["in", "The deep tissue massage, 60 min. And do you offer couples bookings?", 270],
      ["out", "We do! Couples deep tissue is available Sat at 2pm or 4pm. Want me to hold one?", 265],
      ["in", "4pm works perfectly. Can I book through your site?", 30],
      ["in", "Also — is parking available nearby?", 28],
    ],
  },
  {
    platform: "instagram",
    convId: "seed-conv-ig-2",
    participant: { name: "Marcus Chen", handle: "marcuslifts", avatar: avatar(12), id: "ig-user-9002" },
    status: "Open",
    msgs: [
      ["in", "Love the reel you posted 🔥", 4320],
      ["in", "Quick question — do you ship to the US?", 4300],
      ["out", "Thanks Marcus! Currently Canada only, but US shipping is on the roadmap for next quarter.", 4200],
      ["in", "Nice, I'll keep an eye out", 4000],
    ],
  },
  {
    platform: "instagram",
    convId: "seed-conv-ig-3",
    participant: { name: "Priya Sharma", handle: "priya.eats", avatar: avatar(32), id: "ig-user-9003" },
    status: "Open",
    msgs: [
      ["in", "Hi, is this the official page? I want to collaborate on a giveaway", 1500],
    ],
  },
  {
    platform: "facebook",
    convId: "seed-conv-fb-1",
    participant: { name: "Tom Becker", handle: "tom.becker.98", avatar: avatar(15), id: "fb-user-8001" },
    status: "Open",
    msgs: [
      ["in", "Hello, I left a voicemail earlier about scheduling an appointment. Is someone available?", 600],
      ["out", "Hi Tom, sorry we missed your call! I can help you book here. What day works for you?", 580],
      ["in", "Thursday morning if possible", 560],
      ["in", "Around 10am?", 15],
    ],
  },
  {
    platform: "facebook",
    convId: "seed-conv-fb-2",
    participant: { name: "Angela Ruiz", handle: "angela.ruiz.mkt", avatar: avatar(25), id: "fb-user-8002" },
    status: "Open",
    msgs: [
      ["in", "Your ad says free consultation — is that still on?", 2880],
      ["out", "Yes! Free 30-min consultations through the end of the month. Want me to set one up?", 2800],
      ["in", "That would be great, thank you", 2700],
    ],
  },
  {
    platform: "facebook",
    convId: "seed-conv-fb-3",
    participant: { name: "Dave Kowalski", handle: "dave.k", avatar: avatar(60), id: "fb-user-8003" },
    status: "Closed",
    msgs: [
      ["in", "Do you guys take walk-ins?", 8000],
      ["out", "We do for consultations, but services need booking. Anything we can help with?", 7900],
      ["in", "All good, I booked online. Thanks!", 7800],
    ],
  },
];

async function main() {
  console.log("🌱 Seeding social inbox…");

  const accounts = await prisma.wehowareSocialAccount.findMany({
    where: { status: "Active" },
    include: { platform: true },
  });
  const byPlatform = {};
  for (const a of accounts) byPlatform[a.platform?.platformCode] = a;

  let convCount = 0;
  let msgCount = 0;

  for (const t of THREADS) {
    const account = byPlatform[t.platform];
    if (!account) {
      console.log(`   • Skipped ${t.convId} — no active ${t.platform} account`);
      continue;
    }

    const lastMsg = t.msgs[t.msgs.length - 1];
    const lastAt = mins(lastMsg[2]);
    const unread = t.msgs.filter(([dir, , mAgo], i) =>
      dir === "in" && i >= t.msgs.length - 2 && t.status === "Open"
    ).length;

    const conversation = await prisma.wehowareSocialInboxConversation.upsert({
      where: {
        accountId_platformConversationId: {
          accountId: account.id,
          platformConversationId: t.convId,
        },
      },
      update: {
        lastMessageAt: lastAt,
        lastMessagePreview: lastMsg[1].slice(0, 200),
        unreadCount: unread,
        status: t.status,
      },
      create: {
        clientId: account.clientId,
        accountId: account.id,
        platformCode: t.platform,
        platformConversationId: t.convId,
        participantName: t.participant.name,
        participantHandle: t.participant.handle,
        participantAvatar: t.participant.avatar,
        participantId: t.participant.id,
        lastMessageAt: lastAt,
        lastMessagePreview: lastMsg[1].slice(0, 200),
        unreadCount: unread,
        status: t.status,
        metadata: { seeded: true },
        lastSyncedAt: new Date(),
      },
    });
    convCount++;

    for (let i = 0; i < t.msgs.length; i++) {
      const [dir, text, mAgo] = t.msgs[i];
      const inbound = dir === "in";
      const isRecentInbound = inbound && i >= t.msgs.length - 2 && t.status === "Open";
      const exists = await prisma.wehowareSocialInboxMessage.findUnique({
        where: {
          conversationId_platformMessageId: {
            conversationId: conversation.id,
            platformMessageId: `${t.convId}-msg-${i + 1}`,
          },
        },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.wehowareSocialInboxMessage.create({
        data: {
          conversationId: conversation.id,
          platformMessageId: `${t.convId}-msg-${i + 1}`,
          direction: inbound ? "Inbound" : "Outbound",
          senderName: inbound ? t.participant.name : account.accountName,
          senderHandle: inbound ? t.participant.handle : account.accountHandle,
          senderAvatar: inbound ? t.participant.avatar : null,
          content: text,
          mediaUrls: [],
          isRead: inbound ? !isRecentInbound : true,
          sentAt: mins(mAgo),
          metadata: {},
        },
      });
      msgCount++;
    }
  }

  console.log(`   ✓ ${convCount} conversations, ${msgCount} messages seeded`);
  console.log("   Inbox: https://localhost:3000/admin/social-media/inbox");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
