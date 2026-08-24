import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

try {
  const ig = await prisma.wehowareSocialPlatform.findUnique({
    where: { platformCode: "instagram" },
    select: { oauthConfig: true, name: true },
  });
  console.log("Instagram oauthConfig in DB:");
  console.log(JSON.stringify(ig, null, 2));
} catch (err) {
  console.error("ERROR:", err.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
