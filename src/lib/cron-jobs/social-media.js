/**
 * Social media cron jobs:
 *  - publishScheduledPosts: publishes posts where scheduledFor <= now()
 *  - refreshExpiringTokens: refreshes tokens expiring within 2 hours
 *  - retryFailedPosts: retries failed account posts (max 3 attempts)
 */
import { prisma } from "@/lib/prisma";
import { getSocialClient } from "@/lib/social-clients/index.js";

const MAX_RETRY_ATTEMPTS = 3;
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function publishScheduledPosts() {
  const now = new Date();
  const posts = await prisma.wehowareSocialPost.findMany({
    where: { status: "Scheduled", scheduledFor: { lte: now } },
    include: {
      accountPosts: { include: { account: { include: { platform: true } } } },
    },
  });

  for (const post of posts) {
    await _publishPost(post);
  }
}

async function _publishPost(post) {
  await prisma.wehowareSocialPost.update({
    where: { id: post.id },
    data: { status: "Publishing" },
  });

  const targetAccountIds = Array.isArray(post.targetAccounts) ? post.targetAccounts : [];
  const accounts = await prisma.wehowareSocialAccount.findMany({
    where: { id: { in: targetAccountIds }, status: "Active" },
    include: { platform: true },
  });

  const results = [];
  for (const account of accounts) {
    const existing = await prisma.wehowareSocialAccountPost.findUnique({
      where: { postId_accountId: { postId: post.id, accountId: account.id } },
    });
    if (existing?.status === "Published") {
      results.push({ accountId: account.id, success: true });
      continue;
    }

    try {
      const client = getSocialClient(account);
      const mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
      const mediaIds = [];
      for (const url of mediaUrls) {
        const mimeType = url.endsWith(".mp4") || url.endsWith(".mov") ? "video/mp4" : "image/jpeg";
        const mediaId = await client.uploadMedia(url, mimeType);
        if (mediaId) mediaIds.push(mediaId);
      }
      const hashtags = Array.isArray(post.hashtags) ? post.hashtags : [];
      const contentWithTags = hashtags.length > 0
        ? `${post.content}\n\n${hashtags.map((t) => `#${t}`).join(" ")}`
        : post.content;
      const platformPostId = await client.createPost(contentWithTags, mediaIds, {
        pageId: account.profileData?.pageId,
        pageAccessToken: account.profileData?.pageAccessToken,
        igUserId: account.profileData?.igUserId,
      });

      await prisma.wehowareSocialAccountPost.upsert({
        where: { postId_accountId: { postId: post.id, accountId: account.id } },
        update: { status: "Published", platformPostId: platformPostId || null, publishedAt: new Date(), errorDetails: {} },
        create: { postId: post.id, accountId: account.id, status: "Published", platformPostId: platformPostId || null, publishedAt: new Date(), errorDetails: {}, metrics: {} },
      });
      results.push({ accountId: account.id, success: true, platformPostId });
    } catch (err) {
      console.error(`[social-cron] Failed to publish post ${post.id} to account ${account.id}:`, err.message);
      await prisma.wehowareSocialAccountPost.upsert({
        where: { postId_accountId: { postId: post.id, accountId: account.id } },
        update: { status: "Failed", errorDetails: { message: err.message, code: err.statusCode } },
        create: { postId: post.id, accountId: account.id, status: "Failed", errorDetails: { message: err.message, code: err.statusCode }, metrics: {} },
      });
      results.push({ accountId: account.id, success: false, error: err.message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const newStatus = successCount === results.length && results.length > 0
    ? "Published"
    : successCount > 0
    ? "PartiallyPublished"
    : "Failed";

  await prisma.wehowareSocialPost.update({
    where: { id: post.id },
    data: {
      status: newStatus,
      publishedAt: newStatus !== "Failed" ? new Date() : null,
      publishResults: results,
    },
  });
}

export async function refreshExpiringTokens() {
  const cutoff = new Date(Date.now() + TOKEN_REFRESH_BUFFER_MS);
  const accounts = await prisma.wehowareSocialAccount.findMany({
    where: {
      status: "Active",
      tokenExpiresAt: { lte: cutoff },
      refreshToken: { not: null },
    },
    include: { platform: true },
  });

  for (const account of accounts) {
    try {
      const client = getSocialClient(account);
      const newTokens = await client.refreshAccessToken();
      await prisma.wehowareSocialAccount.update({
        where: { id: account.id },
        data: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken ?? account.refreshToken,
          tokenExpiresAt: newTokens.expiresAt,
          syncError: null,
        },
      });
    } catch (err) {
      console.error(`[social-cron] Token refresh failed for account ${account.id}:`, err.message);
      await prisma.wehowareSocialAccount.update({
        where: { id: account.id },
        data: { status: "Error", syncError: err.message },
      });
    }
  }
}

export async function retryFailedPosts() {
  const failedAccountPosts = await prisma.wehowareSocialAccountPost.findMany({
    where: { status: "Failed" },
    include: {
      post: true,
      account: { include: { platform: true } },
    },
  });

  for (const ap of failedAccountPosts) {
    const errorDetails = ap.errorDetails || {};
    const attempts = (errorDetails.attempts || 0) + 1;
    if (attempts > MAX_RETRY_ATTEMPTS) continue;
    if (ap.post.status === "Cancelled" || ap.post.status === "Published") continue;

    await prisma.wehowareSocialAccountPost.update({
      where: { id: ap.id },
      data: { status: "Retrying", errorDetails: { ...errorDetails, attempts } },
    });

    try {
      const client = getSocialClient(ap.account);
      const post = ap.post;
      const mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
      const mediaIds = [];
      for (const url of mediaUrls) {
        const mimeType = url.endsWith(".mp4") || url.endsWith(".mov") ? "video/mp4" : "image/jpeg";
        const mid = await client.uploadMedia(url, mimeType).catch(() => null);
        if (mid) mediaIds.push(mid);
      }
      const hashtags = Array.isArray(post.hashtags) ? post.hashtags : [];
      const content = hashtags.length > 0
        ? `${post.content}\n\n${hashtags.map((t) => `#${t}`).join(" ")}`
        : post.content;
      const platformPostId = await client.createPost(content, mediaIds, {
        pageId: ap.account.profileData?.pageId,
        pageAccessToken: ap.account.profileData?.pageAccessToken,
        igUserId: ap.account.profileData?.igUserId,
      });
      await prisma.wehowareSocialAccountPost.update({
        where: { id: ap.id },
        data: { status: "Published", platformPostId: platformPostId || null, publishedAt: new Date(), errorDetails: {} },
      });
    } catch (err) {
      await prisma.wehowareSocialAccountPost.update({
        where: { id: ap.id },
        data: { status: "Failed", errorDetails: { ...errorDetails, attempts, lastError: err.message } },
      });
    }
  }
}
