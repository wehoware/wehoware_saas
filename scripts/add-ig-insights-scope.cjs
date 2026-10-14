// Adds instagram_business_manage_insights to the Instagram platform's
// oauthConfig.scopes without overwriting any other config values.
// Existing tokens do NOT gain the scope — reconnect the IG account after running.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const platform = await prisma.wehowareSocialPlatform.findUnique({
    where: { platformCode: "instagram" },
  });
  if (!platform) throw new Error("Instagram platform not found");

  const cfg = platform.oauthConfig || {};
  const scopes = new Set(cfg.scopes || []);
  scopes.add("instagram_business_manage_insights");
  cfg.scopes = [...scopes];

  await prisma.wehowareSocialPlatform.update({
    where: { id: platform.id },
    data: { oauthConfig: cfg },
  });
  console.log("Updated scopes:", cfg.scopes.join(", "));
  await prisma.$disconnect();
})();
