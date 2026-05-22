/**
 * POST /api/v1/social/posts/[id]/publish
 * Immediately publishes a post to all target platforms.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";
import { getSocialClient } from "@/lib/social-clients/index.js";

export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = user.activeClientId || user.clientId;

      const post = await prisma.wehowareSocialPost.findFirst({
        where: { id, ...(user.role !== "admin" ? { clientId } : {}) },
      });
      if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

      const PUBLISHABLE = new Set(["Draft", "Scheduled", "Failed"]);
      if (!PUBLISHABLE.has(post.status)) {
        return NextResponse.json({ error: `Cannot publish a post with status: ${post.status}` }, { status: 409 });
      }

      const targetAccountIds = Array.isArray(post.targetAccounts) ? post.targetAccounts : [];
      if (targetAccountIds.length === 0) {
        return NextResponse.json({ error: "No target accounts selected" }, { status: 400 });
      }

      const accounts = await prisma.wehowareSocialAccount.findMany({
        where: { id: { in: targetAccountIds }, status: "Active" },
        include: { platform: true },
      });

      await prisma.wehowareSocialPost.update({ where: { id }, data: { status: "Publishing" } });

      const results = [];
      for (const account of accounts) {
        try {
          const client = getSocialClient(account);
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
            pageId: account.profileData?.pageId,
            pageAccessToken: account.profileData?.pageAccessToken,
            igUserId: account.profileData?.igUserId,
          });

          await prisma.wehowareSocialAccountPost.upsert({
            where: { postId_accountId: { postId: id, accountId: account.id } },
            update: { status: "Published", platformPostId: platformPostId || null, publishedAt: new Date(), errorDetails: {} },
            create: { postId: id, accountId: account.id, status: "Published", platformPostId: platformPostId || null, publishedAt: new Date(), errorDetails: {}, metrics: {} },
          });
          results.push({ accountId: account.id, success: true, platformPostId });
        } catch (err) {
          await prisma.wehowareSocialAccountPost.upsert({
            where: { postId_accountId: { postId: id, accountId: account.id } },
            update: { status: "Failed", errorDetails: { message: err.message } },
            create: { postId: id, accountId: account.id, status: "Failed", errorDetails: { message: err.message }, metrics: {} },
          });
          results.push({ accountId: account.id, success: false, error: err.message });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const finalStatus = successCount === results.length && results.length > 0
        ? "Published"
        : successCount > 0 ? "PartiallyPublished" : "Failed";

      const updated = await prisma.wehowareSocialPost.update({
        where: { id },
        data: { status: finalStatus, publishedAt: finalStatus !== "Failed" ? new Date() : null, publishResults: results },
        include: {
          accountPosts: { include: { account: { include: { platform: true } } } },
        },
      });

      return NextResponse.json({ post: updated, results });
    } catch (err) {
      console.error("[POST /api/v1/social/posts/[id]/publish]", err);
      await prisma.wehowareSocialPost.update({ where: { id: params.id }, data: { status: "Failed" } }).catch(() => {});
      return NextResponse.json({ error: "Failed to publish post" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
