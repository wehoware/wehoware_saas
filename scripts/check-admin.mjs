import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

try {
  const admin = await prisma.wehowareProfile.findUnique({
    where: { email: "akhil@wehoware.com" },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, clientId: true },
  });

  if (admin) {
    console.log("Admin user found:");
    console.table(admin);
  } else {
    console.log("Admin user NOT found. You need to run: npm run db:seed");
  }
} catch (err) {
  console.error("DB ERROR:", err.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
