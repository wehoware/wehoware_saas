/**
 * Social media cron jobs:
 *  - publishScheduledPosts: publishes posts where scheduledFor <= now()
 *  - refreshExpiringTokens: refreshes tokens expiring within 2 hours
 *  - retryFailedPosts: retries failed account posts (max 3 attempts)
 *  - collectPostMetrics: fetches and stores engagement metrics for published posts
 *  - recoverStuckPublishing: resets posts stuck in Publishing status
 */
import { prisma } from "@/lib/prisma";
import { getSocialClient } from "@/lib/social-clients/index.js";
import {
  MAX_RETRY_ATTEMPTS,
  TOKEN_REFRESH_BUFFER_MS,
  TOKEN_REFRESH_MAX_FAILURES,
  STUCK_PUBLISHING_THRESHOLD_MS,
  buildContent,
  buildPlatformUrl,
} from "@/lib/social-clients/constants.js";

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
  // Atomic lock: only transition from "Scheduled" to "Publishing".
  // If another request (manual publish or another cron run) already claimed
  // the post, count === 0 and we skip it to prevent duplicate publishing.
  const lock = await prisma.wehowareSocialPost.updateMany({
    where: { id: post.id, status: "Scheduled" },
    data: { status: "Publishing" },
  });
  if (lock.count === 0) return;

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
      const contentWithTags = buildContent(post.content, hashtags);
      const platformPostId = await client.createPost(contentWithTags, mediaIds, {
        pageId: account.profileData?.pageId,
        pageAccessToken: account.profileData?.pageAccessToken,
        igUserId: account.profileData?.igUserId,
      });

      const platformUrl = buildPlatformUrl(account.platform?.platformCode, platformPostId, account.profileData);

      await prisma.wehowareSocialAccountPost.upsert({
        where: { postId_accountId: { postId: post.id, accountId: account.id } },
        update: { status: "Published", platformPostId: platformPostId || null, platformUrl, publishedAt: new Date(), errorDetails: {} },
        create: { postId: post.id, accountId: account.id, status: "Published", platformPostId: platformPostId || null, platformUrl, publishedAt: new Date(), errorDetails: {}, metrics: {} },
      });
      results.push({ accountId: account.id, success: true, platformPostId, platformUrl });
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

      // Track consecutive failures in profileData before setting Error status.
      // Only set Error after TOKEN_REFRESH_MAX_FAILURES consecutive failures to avoid
      // taking accounts offline due to transient API errors.
      const currentFailures = (account.profileData?.tokenRefreshFailures || 0) + 1;
      const updateData = {
        syncError: err.message,
        profileData: {
          ...account.profileData,
          tokenRefreshFailures: currentFailures,
          lastTokenRefreshError: err.message,
        },
      };

      if (currentFailures >= TOKEN_REFRESH_MAX_FAILURES) {
        updateData.status = "Error";
        console.warn(`[social-cron] Account ${account.id} set to Error after ${currentFailures} consecutive token refresh failures`);
      }

      await prisma.wehowareSocialAccount.update({
        where: { id: account.id },
        data: updateData,
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
      const content = buildContent(post.content, hashtags);
      const platformPostId = await client.createPost(content, mediaIds, {
        pageId: ap.account.profileData?.pageId,
        pageAccessToken: ap.account.profileData?.pageAccessToken,
        igUserId: ap.account.profileData?.igUserId,
      });

      const platformUrl = buildPlatformUrl(ap.account.platform?.platformCode, platformPostId, ap.account.profileData);

      await prisma.wehowareSocialAccountPost.update({
        where: { id: ap.id },
        data: { status: "Published", platformPostId: platformPostId || null, platformUrl, publishedAt: new Date(), errorDetails: {} },
      });

      // Recalculate parent post status after successful retry
      await _recalculatePostStatus(ap.postId);
    } catch (err) {
      await prisma.wehowareSocialAccountPost.update({
        where: { id: ap.id },
        data: { status: "Failed", errorDetails: { ...errorDetails, attempts, lastError: err.message } },
      });
    }
  }
}

/**
 * Recalculates a parent post's status based on its AccountPost statuses.
 * Called after a retry succeeds to update the parent from Failed/PartiallyPublished.
 */
async function _recalculatePostStatus(postId) {
  const accountPosts = await prisma.wehowareSocialAccountPost.findMany({
    where: { postId },
    select: { status: true },
  });
  if (accountPosts.length === 0) return;

  const published = accountPosts.filter((ap) => ap.status === "Published").length;
  const failed = accountPosts.filter((ap) => ap.status === "Failed").length;
  const total = accountPosts.length;

  let newStatus;
  if (published === total) newStatus = "Published";
  else if (published > 0) newStatus = "PartiallyPublished";
  else if (failed === total) newStatus = "Failed";
  else return; // Some posts are still Pending/Publishing/Retrying — don't change

  await prisma.wehowareSocialPost.update({
    where: { id: postId },
    data: {
      status: newStatus,
      ...(newStatus === "Published" ? { publishedAt: new Date() } : {}),
    },
  });
}

// ── Collect Post Metrics ───────────────────────────────────────────────────

export async function collectPostMetrics() {
  // Fetch published account posts that haven't had metrics collected in the last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const accountPosts = await prisma.wehowareSocialAccountPost.findMany({
    where: {
      status: "Published",
      platformPostId: { not: null },
      OR: [
        { analytics: { none: {} } },
        { analytics: { every: { recordedAt: { lt: oneDayAgo } } } },
      ],
    },
    include: {
      account: { include: { platform: true } },
    },
    take: 50, // Process in batches to avoid API rate limits
  });

  for (const ap of accountPosts) {
    try {
      const client = getSocialClient(ap.account);
      const metrics = await client.getPostMetrics(ap.platformPostId);

      if (!metrics || Object.keys(metrics).length === 0) continue;

      // Store each metric as a separate analytics record
      const now = new Date();
      for (const [metricType, metricValue] of Object.entries(metrics)) {
        if (typeof metricValue !== "number" || Number.isNaN(metricValue)) continue;
        await prisma.wehowareSocialPostAnalytics.create({
          data: {
            accountPostId: ap.id,
            metricType,
            metricValue,
            recordedAt: now,
          },
        });
      }

      // Update the metrics JSON field on the account post for quick access
      await prisma.wehowareSocialAccountPost.update({
        where: { id: ap.id },
        data: { metrics },
      });
    } catch (err) {
      console.error(`[social-cron] Metrics collection failed for account post ${ap.id}:`, err.message);
    }
  }
}

// ── Recover Stuck Publishing Posts ─────────────────────────────────────────

export async function recoverStuckPublishing() {
  const threshold = new Date(Date.now() - STUCK_PUBLISHING_THRESHOLD_MS);
  const stuckPosts = await prisma.wehowareSocialPost.findMany({
    where: {
      status: "Publishing",
      updatedAt: { lt: threshold },
    },
    select: { id: true, updatedAt: true },
  });

  for (const post of stuckPosts) {
    console.warn(`[social-cron] Recovering stuck post ${post.id}, stuck since ${post.updatedAt.toISOString()}`);
    await prisma.wehowareSocialPost.update({
      where: { id: post.id },
      data: { status: "Failed", errorDetails: { message: "Post stuck in Publishing status — recovered by cron" } },
    });
  }
}
