import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const all = await prisma.wehowareAppointment.findMany({
  where: { clientId: "bbd8a4a6-b5d8-4af9-aa5d-becfdcadc3ba" },
  orderBy: { createdAt: "desc" },
  include: {
    appointmentType: { select: { name: true, slug: true } },
  },
});

console.log(`Total Hadi appointments: ${all.length}\n`);
for (const a of all) {
  console.log(`  Guest: ${a.guestName} (${a.guestEmail})`);
  console.log(`  When: ${a.scheduledAt.toISOString()}`);
  console.log(`  Status: ${a.status}`);
  console.log(`  Created: ${a.createdAt.toISOString()}`);
  console.log(`  Via: ${a.createdBy ? "Admin" : "Public API"}`);
  console.log(`  Token: ${a.bookingToken ? a.bookingToken.substring(0, 30) + "..." : "NULL"}`);
  console.log(`  Type: ${a.appointmentType?.name || "N/A"}`);
  console.log("");
}

await prisma.$disconnect();
