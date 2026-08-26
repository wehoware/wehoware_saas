const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SOCIAL_PLATFORMS = [
  {
    name: "Facebook",
    platformCode: "facebook",
    logoUrl: "https://cdn.simpleicons.org/facebook/1877F2",
    oauthConfig: {
      authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
      tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
      scopes: ["pages_read_engagement", "pages_manage_posts", "pages_show_list", "public_profile"],
      pkce: false,
    },
    rateLimits: {
      postsPerHour: 200,
      postsPerDay: 1000,
    },
    active: true,
  },
  {
    name: "Instagram",
    platformCode: "instagram",
    logoUrl: "https://cdn.simpleicons.org/Instagram/E4405F",
    oauthConfig: {
      authUrl: "https://www.instagram.com/oauth/authorize",
      tokenUrl: "https://api.instagram.com/oauth/access_token",
      scopes: ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_comments", "instagram_business_manage_messages"],
      pkce: false,
    },
    rateLimits: {
      postsPerHour: 25,
      postsPerDay: 200,
    },
    active: true,
  },
  {
    name: "Twitter / X",
    platformCode: "twitter",
    logoUrl: "https://cdn.simpleicons.org/x/000000",
    oauthConfig: {
      authUrl: "https://twitter.com/i/oauth2/authorize",
      tokenUrl: "https://api.twitter.com/2/oauth2/token",
      scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
      pkce: true,
    },
    rateLimits: {
      postsPerHour: 100,
      postsPerDay: 300,
    },
    active: true,
  },
  {
    name: "TikTok",
    platformCode: "tiktok",
    logoUrl: "https://cdn.simpleicons.org/tiktok/000000",
    oauthConfig: {
      authUrl: "https://www.tiktok.com/v2/auth/authorize",
      tokenUrl: "https://open.tiktokapis.com/v2/oauth/token",
      scopes: ["user.info.basic", "video.upload", "video.publish"],
      pkce: true,
    },
    rateLimits: {
      postsPerHour: 5,
      postsPerDay: 100,
    },
    active: true,
  },
];

async function seedSocialPlatforms() {
  console.log("Seeding social media platforms...");
  for (const platform of SOCIAL_PLATFORMS) {
    await prisma.wehowareSocialPlatform.upsert({
      where: { platformCode: platform.platformCode },
      update: {
        name: platform.name,
        logoUrl: platform.logoUrl,
        oauthConfig: platform.oauthConfig,
        rateLimits: platform.rateLimits,
        active: platform.active,
      },
      create: platform,
    });
    console.log(`  ✓ ${platform.name}`);
  }
  console.log("Social media platforms seeded successfully.");
}

seedSocialPlatforms()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
