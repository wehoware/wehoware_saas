import { prisma } from "../src/lib/prisma.js";

try {
  const result = await prisma.wehowareUserClient.updateMany({
    where: { role: null },
    data: { role: "client" },
  });
  console.log(`Updated ${result.count} rows to role='client'`);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
