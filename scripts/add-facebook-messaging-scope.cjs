// One-off: additively merge pages_messaging into the facebook platform's
// oauthConfig.scopes without overwriting any other config values.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const platform = await prisma.wehowareSocialPlatform.findUnique({
    where: { platformCode: "facebook" },
  });
  if (!platform) {
    console.error("facebook platform row not found");
    process.exit(1);
  }
  const cfg = platform.oauthConfig || {};
  const scopes = new Set(cfg.scopes || []);
  scopes.add("pages_messaging");
  cfg.scopes = [...scopes];
  await prisma.wehowareSocialPlatform.update({
    where: { platformCode: "facebook" },
    data: { oauthConfig: cfg },
  });
  console.log("Updated scopes:", cfg.scopes.join(", "));
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
