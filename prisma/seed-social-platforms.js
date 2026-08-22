const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SOCIAL_PLATFORMS = [
  {
    name: "Facebook",
    platformCode: "facebook",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/2023_Facebook_icon.svg/512px-2023_Facebook_icon.svg.png",
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
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Instagram_logo_2016.svg/512px-Instagram_logo_2016.svg.png",
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
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Logo_of_Twitter.svg/512px-Logo_of_Twitter.svg.png",
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
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/TikTok_logo.svg/512px-TikTok_logo.svg.png",
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
