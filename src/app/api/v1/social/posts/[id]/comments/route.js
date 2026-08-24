/**
 * GET  /api/v1/social/posts/[id]/comments
 *   Fetch comments for a post across all platform accounts it was published to.
 *
 * POST /api/v1/social/posts/[id]/comments
 *   Reply to a comment or post a top-level comment.
 *   Body: { accountId, commentId?, text }
 *     - accountId: which connected account to reply from
 *     - commentId: (optional) the platform comment ID to reply to. If omitted,
 *       posts a top-level comment on the post.
 *     - text: the reply/comment text
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";
import { getSocialClient } from "@/lib/social-clients/index.js";
import { MAX_REPLY_LENGTH } from "@/lib/social-clients/constants.js";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;

    const clientId = user.activeClientId || user.clientId;
    const where = user.role === "admin" ? { id } : { id, clientId };
    const post = await prisma.wehowareSocialPost.findFirst({
      where,
      include: {
        accountPosts: {
          include: {
            account: { include: { platform: true } },
          },
        },
      },
    });

    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const allComments = [];
    for (const ap of post.accountPosts) {
      if (ap.status !== "Published" || !ap.platformPostId) continue;
      try {
        const client = getSocialClient({
          ...ap.account,
          platform: ap.account?.platform,
        });
        if (!client || typeof client.fetchComments !== "function") continue;
        const comments = await client.fetchComments(ap.platformPostId);
        for (const c of comments) {
          allComments.push({
            ...c,
            accountId: ap.accountId,
            platformCode: ap.account?.platform?.platformCode,
            accountName: ap.account?.accountName,
          });
        }
      } catch (err) {
        console.error(`[GET comments] Failed for account ${ap.accountId}:`, err.message);
      }
    }

    return NextResponse.json({ comments: allComments });
  } catch (err) {
    console.error("[GET /api/v1/social/posts/[id]/comments]", err);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;

    if (user.role === "client" && user.activeClientRole === "viewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { accountId, commentId, text } = body;

    if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (text.length > MAX_REPLY_LENGTH) {
      return NextResponse.json({ error: `Text exceeds maximum length of ${MAX_REPLY_LENGTH} characters` }, { status: 400 });
    }

    const clientId = user.activeClientId || user.clientId;
    const account = await prisma.wehowareSocialAccount.findFirst({
      where: { id: accountId, clientId },
      include: { platform: true },
    });
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    // Find the accountPost to get the platformPostId
    const ap = await prisma.wehowareSocialAccountPost.findFirst({
      where: { postId: id, accountId, status: "Published" },
    });
    if (!ap || !ap.platformPostId) {
      return NextResponse.json({ error: "Post not published on this account" }, { status: 404 });
    }

    const client = getSocialClient(account);
    if (!client || typeof client.replyToComment !== "function") {
      return NextResponse.json({ error: "Comments not supported for this platform" }, { status: 400 });
    }

    const newCommentId = await client.replyToComment(ap.platformPostId, commentId || null, text.trim());
    return NextResponse.json({ success: true, commentId: newCommentId });
  } catch (err) {
    console.error("[POST /api/v1/social/posts/[id]/comments]", err);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
});
