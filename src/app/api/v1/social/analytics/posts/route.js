/**
 * GET /api/v1/social/analytics/posts
 * Aggregated analytics for all posts in a date range.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const { searchParams } = new URL(request.url);
    const clientId = user.activeClientId || user.clientId;
    if (!clientId) return NextResponse.json({ error: "No active client" }, { status: 400 });

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = searchParams.get("start_date") ? new Date(searchParams.get("start_date")) : defaultStart;
    const endDate = searchParams.get("end_date") ? new Date(searchParams.get("end_date")) : now;

    const posts = await prisma.wehowareSocialPost.findMany({
      where: { clientId, publishedAt: { gte: startDate, lte: endDate } },
      include: {
        accountPosts: {
          include: {
            account: { include: { platform: { select: { platformCode: true, name: true } } } },
            analytics: true,
          },
        },
      },
      orderBy: { publishedAt: "desc" },
    });

    const platformSummary = {};
    let totalPosts = 0, totalPublished = 0, totalFailed = 0;

    for (const post of posts) {
      totalPosts++;
      const hasPublished = post.accountPosts.some((ap) => ap.status === "Published");
      if (hasPublished) totalPublished++;
      const hasFailed = post.accountPosts.some((ap) => ap.status === "Failed");
      if (hasFailed && !hasPublished) totalFailed++;

      for (const ap of post.accountPosts) {
        const code = ap.account?.platform?.platformCode || "unknown";
        if (!platformSummary[code]) {
          platformSummary[code] = { platform: ap.account?.platform?.name || code, posts: 0, published: 0, failed: 0 };
        }
        platformSummary[code].posts++;
        if (ap.status === "Published") platformSummary[code].published++;
        if (ap.status === "Failed") platformSummary[code].failed++;
      }
    }

    return NextResponse.json({
      summary: { total_posts: totalPosts, published: totalPublished, failed: totalFailed },
      by_platform: Object.values(platformSummary),
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content.slice(0, 100),
        status: p.status,
        published_at: p.publishedAt,
        platforms: p.accountPosts.map((ap) => ap.account?.platform?.platformCode).filter(Boolean),
      })),
    });
  } catch (err) {
    console.error("[GET /api/v1/social/analytics/posts]", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
});
