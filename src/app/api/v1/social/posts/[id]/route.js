/**
 * GET    /api/v1/social/posts/[id]
 * PUT    /api/v1/social/posts/[id]
 * DELETE /api/v1/social/posts/[id]
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

const EDITABLE_STATUSES = new Set(["Draft", "Scheduled"]);
const DELETABLE_STATUSES = new Set(["Draft", "Scheduled", "Failed", "Cancelled"]);
const ALLOWED_TYPES = new Set(["Text", "Image", "Video", "Carousel", "Story", "Reel"]);

function shapePost(p) {
  return {
    id: p.id,
    client_id: p.clientId,
    title: p.title,
    content: p.content,
    media_urls: p.mediaUrls,
    hashtags: p.hashtags,
    scheduled_for: p.scheduledFor,
    published_at: p.publishedAt,
    status: p.status,
    post_type: p.postType,
    target_accounts: p.targetAccounts,
    publish_results: p.publishResults,
    error_details: p.errorDetails,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    account_posts: (p.accountPosts || []).map((ap) => ({
      id: ap.id,
      account_id: ap.accountId,
      platform_post_id: ap.platformPostId,
      platform_url: ap.platformUrl,
      status: ap.status,
      published_at: ap.publishedAt,
      error_details: ap.errorDetails,
      metrics: ap.metrics,
      account: ap.account ? {
        id: ap.account.id,
        account_name: ap.account.accountName,
        platform: ap.account.platform,
      } : null,
    })),
  };
}

const POST_INCLUDE = {
  accountPosts: {
    include: {
      account: { include: { platform: { select: { id: true, name: true, platformCode: true, logoUrl: true } } } },
    },
  },
};

async function resolvePost(prisma, id, user) {
  const clientId = user.activeClientId || user.clientId;
  return prisma.wehowareSocialPost.findFirst({
    where: { id, ...(user.role !== "admin" ? { clientId } : {}) },
    include: POST_INCLUDE,
  });
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    const post = await resolvePost(prisma, id, user);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json({ post: shapePost(post) });
  } catch (err) {
    console.error("[GET /api/v1/social/posts/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 });
  }
});

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    if (user.role === "client" && user.activeClientRole === "viewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const post = await resolvePost(prisma, id, user);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (!EDITABLE_STATUSES.has(post.status)) {
      return NextResponse.json({ error: `Cannot edit a post with status: ${post.status}` }, { status: 409 });
    }

    const body = await request.json();
    const { title, content, media_urls, hashtags, scheduled_for, post_type, target_accounts } = body ?? {};

    if (content !== undefined && content.trim().length === 0) {
      return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
    }
    if (post_type && !ALLOWED_TYPES.has(post_type)) {
      return NextResponse.json({ error: `Invalid post_type` }, { status: 400 });
    }
    if (scheduled_for && new Date(scheduled_for) < new Date()) {
      return NextResponse.json({ error: "Scheduled time must be in the future" }, { status: 400 });
    }

    const clientId = user.activeClientId || user.clientId;
    if (Array.isArray(target_accounts) && target_accounts.length > 0) {
      const valid = await prisma.wehowareSocialAccount.findMany({
        where: { id: { in: target_accounts }, clientId },
        select: { id: true },
      });
      if (valid.length !== target_accounts.length) {
        return NextResponse.json({ error: "One or more invalid target accounts" }, { status: 400 });
      }
    }

    const newStatus = scheduled_for !== undefined
      ? (scheduled_for ? "Scheduled" : "Draft")
      : post.status;

    const updated = await prisma.wehowareSocialPost.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title || null } : {}),
        ...(content !== undefined ? { content: content.trim() } : {}),
        ...(media_urls !== undefined ? { mediaUrls: media_urls } : {}),
        ...(hashtags !== undefined ? { hashtags } : {}),
        ...(scheduled_for !== undefined ? { scheduledFor: scheduled_for ? new Date(scheduled_for) : null } : {}),
        ...(post_type ? { postType: post_type } : {}),
        ...(target_accounts !== undefined ? { targetAccounts: target_accounts } : {}),
        status: newStatus,
        updatedBy: user.id,
      },
      include: POST_INCLUDE,
    });
    return NextResponse.json({ post: shapePost(updated) });
  } catch (err) {
    console.error("[PUT /api/v1/social/posts/[id]]", err);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;
    if (user.role === "client" && user.activeClientRole === "viewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const post = await resolvePost(prisma, id, user);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (!DELETABLE_STATUSES.has(post.status)) {
      return NextResponse.json({ error: `Cannot delete a post with status: ${post.status}` }, { status: 409 });
    }
    await prisma.wehowareSocialPost.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/v1/social/posts/[id]]", err);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
});
