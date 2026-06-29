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

  // ─────────────────────────────────────────────────────────────────────
  // 4. Inventory categories (idempotent by [clientId, slug])
  // ─────────────────────────────────────────────────────────────────────
  const categorySeeds = [
    { name: "Sedans", slug: "sedans", description: "Sedan vehicles", iconUrl: null },
    { name: "SUVs", slug: "suvs", description: "Sport utility vehicles", iconUrl: null },
    { name: "Trucks", slug: "trucks", description: "Pickup trucks", iconUrl: null },
  ];

  const categoryIds = {};
  for (const cat of categorySeeds) {
    const row = await prisma.wehowareInventoryCategory.upsert({
      where: { clientId_slug: { clientId: client.id, slug: cat.slug } },
      update: { description: cat.description },
      create: {
        clientId: client.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        iconUrl: cat.iconUrl,
        active: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });
    categoryIds[cat.slug] = row.id;
  }
  console.log(`   ✓ Seeded ${categorySeeds.length} inventory categories`);

  // ─────────────────────────────────────────────────────────────────────
  // 5. Inventory items (idempotent by [clientId, slug])
  // ─────────────────────────────────────────────────────────────────────
  const itemSeeds = [
    {
      title: "2024 Toyota Camry SE",
      slug: "2024-toyota-camry-se",
      categoryId: categoryIds.sedans,
      type: "vehicle",
      sku: "TCA-2024-SE",
      description: "Mid-size sedan with 2.5L engine, 8-speed automatic transmission.",
      price: 32000,
      currency: "CAD",
      priceVisible: true,
      quantity: 5,
      reorderThreshold: 2,
      status: "in_stock",
      tags: ["toyota", "camry", "sedan", "2024"],
      featured: true,
      active: true,
      attributes: { make: "Toyota", model: "Camry", year: 2024, mileage: 0, vin: "JT2BG28K401234567" },
      images: [],
      metaTitle: "2024 Toyota Camry SE - Wehoware Motors",
      metaDescription: "Brand new 2024 Toyota Camry SE with full warranty.",
      metaKeywords: "toyota, camry, 2024, sedan, for sale",
    },
    {
      title: "2024 Honda CR-V EX",
      slug: "2024-honda-cr-v-ex",
      categoryId: categoryIds.suvs,
      type: "vehicle",
      sku: "HCR-2024-EX",
      description: "Compact SUV with 1.5L turbo engine and AWD.",
      price: 38000,
      currency: "CAD",
      priceVisible: true,
      quantity: 3,
      reorderThreshold: 2,
      status: "in_stock",
      tags: ["honda", "cr-v", "suv", "2024"],
      featured: true,
      active: true,
      attributes: { make: "Honda", model: "CR-V", year: 2024, mileage: 0, vin: "5J6RW2H80NL123456" },
      images: [],
      metaTitle: "2024 Honda CR-V EX - Wehoware Motors",
      metaDescription: "Brand new 2024 Honda CR-V EX with AWD.",
      metaKeywords: "honda, cr-v, 2024, suv, for sale",
    },
    {
      title: "2024 Ford F-150 XLT",
      slug: "2024-ford-f-150-xlt",
      categoryId: categoryIds.trucks,
      type: "vehicle",
      sku: "FF1-2024-XLT",
      description: "Full-size pickup truck with 3.5L EcoBoost V6 engine.",
      price: 45000,
      currency: "CAD",
      priceVisible: true,
      quantity: 1,
      reorderThreshold: 2,
      status: "low_stock",
      tags: ["ford", "f-150", "truck", "2024"],
      featured: false,
      active: true,
      attributes: { make: "Ford", model: "F-150", year: 2024, mileage: 0, vin: "1FTFW1E80NFA12345" },
      images: [],
      metaTitle: "2024 Ford F-150 XLT - Wehoware Motors",
      metaDescription: "Brand new 2024 Ford F-150 XLT pickup truck.",
      metaKeywords: "ford, f-150, 2024, truck, for sale",
    },
    {
      title: "2023 Toyota Corolla LE",
      slug: "2023-toyota-corolla-le",
      categoryId: categoryIds.sedans,
      type: "vehicle",
      sku: "TCO-2023-LE",
      description: "Compact sedan with 2.0L engine, certified pre-owned.",
      price: 24000,
      currency: "CAD",
      priceVisible: true,
      quantity: 0,
      reorderThreshold: 1,
      status: "out_of_stock",
      tags: ["toyota", "corolla", "sedan", "2023", "used"],
      featured: false,
      active: false,
      attributes: { make: "Toyota", model: "Corolla", year: 2023, mileage: 15000, vin: "JTDBR32E501234567" },
      images: [],
      metaTitle: "2023 Toyota Corolla LE - Wehoware Motors",
      metaDescription: "Certified pre-owned 2023 Toyota Corolla LE.",
      metaKeywords: "toyota, corolla, 2023, sedan, used, for sale",
    },
  ];

  for (const item of itemSeeds) {
    await prisma.wehowareInventoryItem.upsert({
      where: { clientId_slug: { clientId: client.id, slug: item.slug } },
      update: { updatedBy: admin.id },
      create: {
        clientId: client.id,
        categoryId: item.categoryId,
        title: item.title,
        slug: item.slug,
        type: item.type,
        sku: item.sku,
        description: item.description,
        price: item.price,
        currency: item.currency,
        priceVisible: item.priceVisible,
        quantity: item.quantity,
        reorderThreshold: item.reorderThreshold,
        status: item.status,
        tags: item.tags,
        featured: item.featured,
        active: item.active,
        attributes: item.attributes,
        images: item.images,
        metaTitle: item.metaTitle,
        metaDescription: item.metaDescription,
        metaKeywords: item.metaKeywords,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });
  }
  console.log(`   ✓ Seeded ${itemSeeds.length} inventory items`);

  // ─────────────────────────────────────────────────────────────────────
  // 6. Inventory settings (idempotent by unique clientId)
  // ─────────────────────────────────────────────────────────────────────
  await prisma.wehowareInventorySetting.upsert({
    where: { clientId: client.id },
    update: {},
    create: {
      clientId: client.id,
      defaultCurrency: "CAD",
      lowStockThreshold: 5,
      autoArchiveDays: 90,
      enableStockTracking: true,
      enableLowStockAlerts: true,
      enablePublicListing: true,
      enableInquiries: true,
      enableTestDrive: true,
      defaultItemType: "vehicle",
      listingPageTitle: "Our Vehicle Inventory",
      listingPageDescription: "Browse our selection of quality vehicles.",
      contactEmail: EMAIL,
      contactPhone: "+1-555-0100",
      businessHours: "Mon-Fri 9:00 AM - 6:00 PM, Sat 10:00 AM - 4:00 PM",
      address: "123 Main Street, Toronto, ON, Canada",
      seoTitle: "Vehicle Inventory - Wehoware Motors",
      seoDescription: "Browse our full selection of quality new and used vehicles.",
      seoKeywords: "cars, vehicles, for sale, toronto, dealership",
    },
  });
  console.log(`   ✓ Seeded inventory settings`);

  // ─────────────────────────────────────────────────────────────────────
  // 7. Sample stock movement for the Camry
  // ─────────────────────────────────────────────────────────────────────
  const camry = await prisma.wehowareInventoryItem.findFirst({
    where: { clientId: client.id, slug: "2024-toyota-camry-se" },
    select: { id: true },
  });
  if (camry) {
    const existingMovement = await prisma.wehowareInventoryStockMovement.findFirst({
      where: { itemId: camry.id, clientId: client.id, movementType: "restock" },
      select: { id: true },
    });
    if (!existingMovement) {
      await prisma.wehowareInventoryStockMovement.create({
        data: {
          itemId: camry.id,
          clientId: client.id,
          movementType: "restock",
          quantityChange: 5,
          quantityAfter: 5,
          reason: "Initial stock from seed",
          createdBy: admin.id,
        },
      });
      console.log(`   ✓ Seeded 1 stock movement`);
    }
  }

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
