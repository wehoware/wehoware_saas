import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config();

const prisma = new PrismaClient();

/**
 * Migrates legacy WehowareInquiry records into CRM contacts and logs
 * corresponding activities. Uses the CRM bridge pattern for deduplication.
 *
 * Usage: node scripts/migrate-inquiries-to-crm.mjs
 */
async function main() {
  console.log("Starting inquiry migration to CRM...");

  const inquiries = await prisma.wehowareInquiry.findMany({
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${inquiries.length} inquiries to migrate`);

  let created = 0;
  let skipped = 0;
  let activitiesCreated = 0;

  for (const inquiry of inquiries) {
    // Check if a CRM contact already exists for this email + client
    const existing = await prisma.wehowareCrmContact.findFirst({
      where: {
        clientId: inquiry.clientId,
        email: inquiry.email,
        active: true,
      },
    });

    let contactId;

    if (existing) {
      contactId = existing.id;
      skipped++;
    } else {
      // Create new CRM contact from inquiry
      const nameParts = (inquiry.name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || inquiry.name || "Unknown";
      const lastName = nameParts.slice(1).join(" ") || "";

      const contact = await prisma.wehowareCrmContact.create({
        data: {
          clientId: inquiry.clientId,
          firstName,
          lastName,
          email: inquiry.email,
          phone: inquiry.phone || null,
          type: "Lead",
          status: inquiry.status === "Resolved" ? "Converted" : inquiry.status === "In_Progress" ? "Contacted" : "New",
          source: "Website",
          notes: `Migrated from inquiry: ${inquiry.subject}`,
          createdBy: inquiry.updatedBy || null,
        },
      });
      contactId = contact.id;
      created++;
    }

    // Log activity for the inquiry
    const existingActivity = await prisma.wehowareCrmActivity.findFirst({
      where: {
        clientId: inquiry.clientId,
        contactId,
        type: "Note",
        title: `Inquiry: ${inquiry.subject}`,
      },
    });

    if (!existingActivity) {
      await prisma.wehowareCrmActivity.create({
        data: {
          clientId: inquiry.clientId,
          contactId,
          type: "Note",
          direction: "Inbound",
          title: `Inquiry: ${inquiry.subject}`,
          description: inquiry.message,
          createdBy: inquiry.updatedBy || null,
        },
      });
      activitiesCreated++;
    }
  }

  console.log("\nMigration complete:");
  console.log(`  Contacts created: ${created}`);
  console.log(`  Contacts skipped (already existed): ${skipped}`);
  console.log(`  Activities created: ${activitiesCreated}`);
  console.log(`  Total inquiries processed: ${inquiries.length}`);
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
