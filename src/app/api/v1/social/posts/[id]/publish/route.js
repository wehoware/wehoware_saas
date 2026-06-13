/**
 * POST /api/v1/social/posts/[id]/publish
 * Immediately publishes a post to all target platforms.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";
import { getSocialClient } from "@/lib/social-clients/index.js";

const PUBLISHABLE = new Set(["Draft", "Scheduled", "Failed"]);

function buildContent(post) {
  const hashtags = Array.isArray(post.hashtags) ? post.hashtags : [];
  if (hashtags.length === 0) return post.content;
  const tagString = hashtags.map((t) => "#" + t).join(" ");
  return `${post.content}\n\n${tagString}`;
}

async function publishToAccount(prisma, postId, account, post) {
  const client = getSocialClient(account);
  const mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];

  const mediaIds = [];
  for (const url of mediaUrls) {
    const mimeType = url.endsWith(".mp4") || url.endsWith(".mov") ? "video/mp4" : "image/jpeg";
    // Allow upload errors to propagate — a missing image is a publish failure, not a partial success
    const mid = await client.uploadMedia(url, mimeType);
    if (mid) mediaIds.push(mid);
  }

  const platformPostId = await client.createPost(buildContent(post), mediaIds, {
    pageId: account.profileData?.pageId,
    pageAccessToken: account.profileData?.pageAccessToken,
    igUserId: account.profileData?.igUserId,
  });

  await prisma.wehowareSocialAccountPost.upsert({
    where: { postId_accountId: { postId, accountId: account.id } },
    update: { status: "Published", platformPostId: platformPostId || null, publishedAt: new Date(), errorDetails: {} },
    create: { postId, accountId: account.id, status: "Published", platformPostId: platformPostId || null, publishedAt: new Date(), errorDetails: {}, metrics: {} },
  });

  return { accountId: account.id, success: true, platformPostId };
}

async function handleAccountError(prisma, postId, accountId, err) {
  console.error(`[publish] Failed for account ${accountId}:`, err.message);
  await prisma.wehowareSocialAccountPost.upsert({
    where: { postId_accountId: { postId, accountId } },
    update: { status: "Failed", errorDetails: { message: err.message } },
    create: { postId, accountId, status: "Failed", errorDetails: { message: err.message }, metrics: {} },
  });
  return { accountId, success: false, error: err.message };
}

export const POST = withAuth(
  async (request, { params }) => {
    // Await params before the try block so `id` is available in the catch for recovery
    const { id } = await params;

    try {
      const { prisma, user } = request;
      const clientId = user.activeClientId || user.clientId;

      const post = await prisma.wehowareSocialPost.findFirst({
        where: user.role === "admin" ? { id } : { id, clientId },
      });
      if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
      if (!PUBLISHABLE.has(post.status)) {
        return NextResponse.json({ error: `Cannot publish a post with status: ${post.status}` }, { status: 409 });
      }

      const targetAccountIds = Array.isArray(post.targetAccounts) ? post.targetAccounts : [];
      if (targetAccountIds.length === 0) {
        return NextResponse.json({ error: "No target accounts selected" }, { status: 400 });
      }

      // Atomic lock: transition from a publishable status to Publishing in a single statement.
      // If another request already claimed the post, count === 0 and we bail.
      const lock = await prisma.wehowareSocialPost.updateMany({
        where: { id, status: { in: [...PUBLISHABLE] } },
        data: { status: "Publishing" },
      });
      if (lock.count === 0) {
        return NextResponse.json({ error: "Post is already being published" }, { status: 409 });
      }

      const accounts = await prisma.wehowareSocialAccount.findMany({
        where: { id: { in: targetAccountIds }, status: "Active" },
        include: { platform: true },
      });

      if (accounts.length === 0) {
        await prisma.wehowareSocialPost.update({
          where: { id },
          data: { status: "Failed", publishResults: [] },
        });
        return NextResponse.json({ error: "No active accounts available for publishing" }, { status: 400 });
      }

      const results = [];
      for (const account of accounts) {
        try {
          const result = await publishToAccount(prisma, id, account, post);
          results.push(result);
        } catch (err) {
          const result = await handleAccountError(prisma, id, account.id, err);
          results.push(result);
        }
      }

      const successCount = results.filter((r) => r.success).length;
      let finalStatus;
      if (successCount === results.length) {
        finalStatus = "Published";
      } else if (successCount > 0) {
        finalStatus = "PartiallyPublished";
      } else {
        finalStatus = "Failed";
      }

      const updated = await prisma.wehowareSocialPost.update({
        where: { id },
        data: {
          status: finalStatus,
          publishedAt: finalStatus === "Failed" ? null : new Date(),
          publishResults: results,
        },
        include: {
          accountPosts: { include: { account: { include: { platform: true } } } },
        },
      });

      return NextResponse.json({ post: updated, results });
    } catch (err) {
      console.error("[POST /api/v1/social/posts/[id]/publish]", err);
      // request.prisma is set by withAuth — safe to access even if the inner destructure never ran
      await request.prisma?.wehowareSocialPost
        .update({ where: { id }, data: { status: "Failed" } })
        .catch(() => {});
      return NextResponse.json({ error: "Failed to publish post" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
