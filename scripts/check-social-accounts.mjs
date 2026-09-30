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
const accounts = await prisma.wehowareSocialAccount.findMany({ include: { platform: true } });
console.log(JSON.stringify(accounts.map(a => ({
  id: a.id, clientId: a.clientId, name: a.accountName,
  platform: a.platform?.platformCode, status: a.status,
})), null, 2));
const platforms = await prisma.wehowareSocialPlatform.findMany();
console.log("PLATFORMS:", JSON.stringify(platforms.map(p => ({ id: p.id, code: p.platformCode, name: p.name }))));
const convCount = await prisma.wehowareSocialInboxConversation.count();
console.log("existing conversations:", convCount);
await prisma.$disconnect();
