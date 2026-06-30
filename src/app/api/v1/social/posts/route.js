/**
 * GET  /api/v1/social/posts — List posts for active client (paginated)
 * POST /api/v1/social/posts — Create a new social post
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import { shapePost, POST_INCLUDE } from "@/lib/social-clients/post-utils.js";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_CONTENT_LENGTH,
  POST_STATUSES,
  POST_TYPES,
  PLATFORMS_REQUIRING_MEDIA,
} from "@/lib/social-clients/constants.js";

const ALLOWED_STATUSES = new Set(POST_STATUSES);
const ALLOWED_TYPES = new Set(POST_TYPES);

export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const { searchParams } = new URL(request.url);
    const clientId = user.activeClientId || user.clientId;
    if (!clientId) return NextResponse.json({ error: "No active client" }, { status: 400 });

    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10)));
    const statusFilter = searchParams.get("status");
    const searchQuery = searchParams.get("search")?.trim();
    const startDate = searchParams.get("scheduled_from");
    const endDate = searchParams.get("scheduled_to");

    const where = { clientId };
    if (statusFilter) {
      if (!ALLOWED_STATUSES.has(statusFilter)) {
        return NextResponse.json({ error: `Invalid status filter. Must be one of: ${[...ALLOWED_STATUSES].join(", ")}` }, { status: 400 });
      }
      where.status = statusFilter;
    }
    if (searchQuery) {
      where.OR = [
        { title: { contains: searchQuery } },
        { content: { contains: searchQuery } },
      ];
    }
    if (startDate || endDate) {
      where.scheduledFor = {};
      if (startDate) where.scheduledFor.gte = new Date(startDate);
      if (endDate) where.scheduledFor.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.wehowareSocialPost.findMany({
        where,
        include: {
          accountPosts: {
            include: { account: { include: { platform: { select: { id: true, name: true, platformCode: true, logoUrl: true } } } } },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wehowareSocialPost.count({ where }),
    ]);

    return NextResponse.json({ posts: items.map(shapePost), total, page, limit });
  } catch (err) {
    console.error("[GET /api/v1/social/posts]", err);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
});

export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = user.activeClientId || user.clientId;
      if (!clientId) return NextResponse.json({ error: "No active client" }, { status: 400 });

      if (user.role === "client" && user.activeClientRole === "viewer") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      const { title, content, media_urls, hashtags, scheduled_for, post_type, target_accounts } = body ?? {};

      if (!content || content.trim().length === 0) {
        return NextResponse.json({ error: "Content is required" }, { status: 400 });
      }
      if (content.length > MAX_CONTENT_LENGTH) {
        return NextResponse.json({ error: "Content exceeds maximum length" }, { status: 400 });
      }
      if (post_type && !ALLOWED_TYPES.has(post_type)) {
        return NextResponse.json({ error: `Invalid post_type. Must be one of: ${[...ALLOWED_TYPES].join(", ")}` }, { status: 400 });
      }
      if (scheduled_for && Number.isNaN(new Date(scheduled_for).getTime())) {
        return NextResponse.json({ error: "Invalid scheduled_for date" }, { status: 400 });
      }
      if (scheduled_for && new Date(scheduled_for) < new Date()) {
        return NextResponse.json({ error: "Scheduled time must be in the future" }, { status: 400 });
      }

      const accountIds = Array.isArray(target_accounts) ? target_accounts : [];
      if (accountIds.length > 0) {
        const validAccounts = await prisma.wehowareSocialAccount.findMany({
          where: { id: { in: accountIds }, clientId },
          select: { id: true, platform: { select: { platformCode: true } } },
        });
        if (validAccounts.length !== accountIds.length) {
          return NextResponse.json({ error: "One or more invalid target accounts" }, { status: 400 });
        }
        // Server-side media validation: Instagram and TikTok require at least one media URL
        const mediaUrlList = Array.isArray(media_urls) ? media_urls : [];
        const selectedPlatformCodes = validAccounts.map((a) => a.platform?.platformCode).filter(Boolean);
        const needsMedia = selectedPlatformCodes.some((code) => PLATFORMS_REQUIRING_MEDIA.has(code));
        if (needsMedia && mediaUrlList.length === 0) {
          return NextResponse.json({ error: "Instagram and TikTok require at least one media URL" }, { status: 400 });
        }
      }

      const status = scheduled_for ? "Scheduled" : "Draft";
      const post = await prisma.wehowareSocialPost.create({
        data: {
          clientId,
          title: title || null,
          content: content.trim(),
          mediaUrls: Array.isArray(media_urls) ? media_urls : [],
          hashtags: Array.isArray(hashtags) ? hashtags : [],
          scheduledFor: scheduled_for ? new Date(scheduled_for) : null,
          status,
          postType: post_type || "Text",
          targetAccounts: accountIds,
          publishResults: [],
          errorDetails: {},
          createdBy: user.id,
          updatedBy: user.id,
        },
        include: POST_INCLUDE,
      });

      return NextResponse.json(shapePost(post), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/social/posts]", err);
      return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
