/**
 * GET    /api/v1/social/posts/[id]
 * PUT    /api/v1/social/posts/[id]
 * DELETE /api/v1/social/posts/[id]
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";
import { shapePost, POST_INCLUDE } from "@/lib/social-clients/post-utils.js";
import {
  MAX_CONTENT_LENGTH,
  EDITABLE_STATUSES,
  DELETABLE_STATUSES,
  POST_TYPES,
  PLATFORMS_REQUIRING_MEDIA,
} from "@/lib/social-clients/constants.js";

const ALLOWED_TYPES = new Set(POST_TYPES);

function resolvePost(prisma, id, user) {
  const clientId = user.activeClientId || user.clientId;
  const where = user.role === "admin" ? { id } : { id, clientId };
  return prisma.wehowareSocialPost.findFirst({ where, include: POST_INCLUDE });
}

function validateBodyForUpdate(body) {
  const { content, post_type, scheduled_for } = body ?? {};
  if (content !== undefined) {
    if (content.trim().length === 0) return "Content cannot be empty";
    if (content.length > MAX_CONTENT_LENGTH) return `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`;
  }
  if (post_type && !ALLOWED_TYPES.has(post_type)) return "Invalid post_type";
  if (scheduled_for !== undefined && scheduled_for !== null && scheduled_for !== "") {
    if (Number.isNaN(new Date(scheduled_for).getTime())) return "Invalid scheduled_for date";
    if (new Date(scheduled_for) < new Date()) return "Scheduled time must be in the future";
  }
  return null;
}

function buildUpdateData(body, currentStatus, userId) {
  const { title, content, media_urls, hashtags, scheduled_for, post_type, target_accounts } = body;

  // Determine new status without nested ternary
  let status;
  if (scheduled_for === undefined) {
    status = currentStatus;
  } else {
    status = scheduled_for ? "Scheduled" : "Draft";
  }

  const data = { status, updatedBy: userId };
  if (title !== undefined) data.title = title || null;
  if (content !== undefined) data.content = content.trim();
  if (media_urls !== undefined) data.mediaUrls = media_urls;
  if (hashtags !== undefined) data.hashtags = hashtags;
  if (scheduled_for !== undefined) data.scheduledFor = scheduled_for ? new Date(scheduled_for) : null;
  if (post_type) data.postType = post_type;
  if (target_accounts !== undefined) data.targetAccounts = target_accounts;
  return data;
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
    const validationError = validateBodyForUpdate(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const { target_accounts, media_urls } = body ?? {};
    const clientId = user.activeClientId || user.clientId;
    if (Array.isArray(target_accounts) && target_accounts.length > 0) {
      const valid = await prisma.wehowareSocialAccount.findMany({
        where: { id: { in: target_accounts }, clientId },
        select: { id: true, platform: { select: { platformCode: true } } },
      });
      if (valid.length !== target_accounts.length) {
        return NextResponse.json({ error: "One or more invalid target accounts" }, { status: 400 });
      }
      // Server-side media validation: Instagram and TikTok require at least one media URL
      const mediaUrlList = Array.isArray(media_urls) ? media_urls : [];
      const selectedPlatformCodes = valid.map((a) => a.platform?.platformCode).filter(Boolean);
      const needsMedia = selectedPlatformCodes.some((code) => PLATFORMS_REQUIRING_MEDIA.has(code));
      if (needsMedia && mediaUrlList.length === 0) {
        return NextResponse.json({ error: "Instagram and TikTok require at least one media URL" }, { status: 400 });
      }
    }

    const updated = await prisma.wehowareSocialPost.update({
      where: { id },
      data: buildUpdateData(body, post.status, user.id),
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
