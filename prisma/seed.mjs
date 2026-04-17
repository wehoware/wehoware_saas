#!/usr/bin/env node
/**
 * prisma/seed.mjs
 *
 * Idempotent seed: creates a default Wehoware tenant client + an admin user
 * so you can actually log in to the freshly-migrated MySQL database.
 *
 * Usage:
 *   npm run db:seed
 *
 * Environment (optional — defaults shown):
 *   SEED_ADMIN_EMAIL     (default: admin@wehoware.com)
 *   SEED_ADMIN_PASSWORD  (default: Wehoware@2025)
 *   SEED_ADMIN_FIRST     (default: Wehoware)
 *   SEED_ADMIN_LAST      (default: Admin)
 *   SEED_CLIENT_NAME     (default: Wehoware Internal)
 *
 * Re-running is safe: it upserts by email / company name.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// --- Load .env.local manually (Prisma CLI does this; raw node doesn't) ----
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envFile = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // No .env.local — assume env is already set (e.g. in CI)
}

const prisma = new PrismaClient();

const EMAIL = process.env.SEED_ADMIN_EMAIL || "akhil@wehoware.com";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Wehoware@2025";
const FIRST = process.env.SEED_ADMIN_FIRST || "Akhil";
const LAST = process.env.SEED_ADMIN_LAST || "Sai";
const CLIENT_NAME = process.env.SEED_CLIENT_NAME || "Wehoware Internal";

async function main() {
  console.log("🌱 Seeding Wehoware database…");

  // 1. Default tenant client
  let client = await prisma.wehowareClient.findFirst({
    where: { companyName: CLIENT_NAME },
  });
  if (!client) {
    client = await prisma.wehowareClient.create({
      data: {
        companyName: CLIENT_NAME,
        contactPerson: `${FIRST} ${LAST}`,
        email: EMAIL,
        active: true,
      },
    });
    console.log(`   ✓ Created tenant client: ${client.companyName} (${client.id})`);
  } else {
    console.log(`   • Tenant client already exists: ${client.companyName}`);
  }

  // 2. Admin profile (upsert by unique email)
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const admin = await prisma.wehowareProfile.upsert({
    where: { email: EMAIL },
    update: {
      passwordHash,
      role: "admin",
      firstName: FIRST,
      lastName: LAST,
      clientId: client.id,
    },
    create: {
      email: EMAIL,
      passwordHash,
      role: "admin",
      firstName: FIRST,
      lastName: LAST,
      clientId: client.id,
    },
  });
  console.log(`   ✓ Admin user: ${admin.email} (${admin.id})`);

  // 3. user ↔ client join row (required for getAccessibleClients())
  await prisma.wehowareUserClient.upsert({
    where: { userId_clientId: { userId: admin.id, clientId: client.id } },
    update: { isPrimary: true },
    create: { userId: admin.id, clientId: client.id, isPrimary: true },
  });
  console.log(`   ✓ Linked admin ↔ client as primary`);

  console.log("");
  console.log("✅ Seed complete.");
  console.log("");
  console.log("   Login at http://localhost:3000/login");
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log("");
  console.log("   (Change the password immediately after first login.)");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
