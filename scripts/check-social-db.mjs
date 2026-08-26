import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

try {
  const count = await prisma.wehowareSocialPlatform.count();
  console.log("Platforms in DB:", count);

  if (count > 0) {
    const platforms = await prisma.wehowareSocialPlatform.findMany({
      select: { id: true, name: true, platformCode: true, active: true },
    });
    console.table(platforms);
  }

  const accountCount = await prisma.wehowareSocialAccount.count();
  console.log("Connected accounts:", accountCount);

  const postCount = await prisma.wehowareSocialPost.count();
  console.log("Posts:", postCount);

  console.log("\nDB connection: OK");
} catch (err) {
  console.error("DB ERROR:", err.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
