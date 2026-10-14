// Read-only diagnostic round 2:
//  a) Inspect the list-entry data for the 3 conversations whose /messages fail
//  b) Verify whether participants/from use IGSID (user_id) vs node id
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const BASE = "https://graph.instagram.com";
const FAILING = new Set([
  "aWdfZAG06MzQwMjgyMzY2ODQxNzEwMzAxMjgxMTUyNjk3Nzg2NTUyMzU3OTA4",
  "aWdfZAG06MzQwMjgyMzY2ODQxNzEwMzAxMjgxMTU4MjQzNjA5Mjc0ODQ5Njg2",
  "aWdfZAG06MzQwMjgyMzY2ODQxNzEwMzAxMjgxMTUzMjQwNDY3NTQwMTIwODU1",
]);

async function g(url) {
  const res = await fetch(url);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  return { status: res.status, body };
}

const acct = await prisma.wehowareSocialAccount.findFirst({
  where: { platform: { platformCode: "instagram" } },
  orderBy: { updatedAt: "desc" },
});
const token = acct.accessToken;
const igId = acct.profileData?.igUserId;

const me = await g(`${BASE}/me?fields=id,user_id,username&access_token=${token}`);
console.log("me:", JSON.stringify(me.body));
const igsid = me.body?.user_id;

const convs = await g(`${BASE}/${igId}/conversations?platform=instagram&fields=id,participants{username,name,id},updated_time,snippet&access_token=${token}`);

console.log("\n── Failing conversations (list-entry view) ──");
for (const c of convs.body?.data || []) {
  if (!FAILING.has(c.id)) continue;
  console.log(`\nconv ${c.id}`);
  console.log(`  updated_time=${c.updated_time}  snippet="${(c.snippet || "").slice(0, 80)}"`);
  for (const p of c.participants?.data || []) {
    console.log(`  participant: id=${p.id} username=${p.username} name=${p.name} ${p.id === igsid ? "[SELF-igsid]" : p.id === igId ? "[SELF-nodeid]" : ""}`);
  }
}

console.log("\n── Working conv: check message from/to ID format ──");
const okConv = convs.body?.data?.find((c) => !FAILING.has(c.id));
if (okConv) {
  for (const p of okConv.participants?.data || []) {
    console.log(`  participant: id=${p.id} username=${p.username} ${p.id === igsid ? "[SELF-igsid]" : p.id === igId ? "[SELF-nodeid]" : ""}`);
  }
  const m = await g(`${BASE}/${okConv.id}/messages?fields=id,from,to,timestamp&limit=5&access_token=${token}`);
  for (const msg of m.body?.data || []) {
    console.log(`  msg from.id=${msg.from?.id} (${msg.from?.username}) to=${JSON.stringify(msg.to?.data?.map(t => t.id))} ${msg.from?.id === igsid ? "[OUTBOUND-self-igsid]" : msg.from?.id === igId ? "[OUTBOUND-self-nodeid]" : "[INBOUND-peer]"}`);
  }
}
await prisma.$disconnect();
