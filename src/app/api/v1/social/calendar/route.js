/**
 * GET /api/v1/social/calendar
 * Returns posts grouped by date for calendar view.
 * Query params: year, month (1-12)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const { searchParams } = new URL(request.url);
    const clientId = user.activeClientId || user.clientId;
    if (!clientId) return NextResponse.json({ error: "No active client" }, { status: 400 });

    const now = new Date();
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()), 10);
    const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1), 10);

    if (month < 1 || month > 12 || year < 2020 || year > 2100) {
      return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const posts = await prisma.wehowareSocialPost.findMany({
      where: {
        clientId,
        scheduledFor: { gte: startDate, lte: endDate },
        status: { notIn: ["Draft"] },
      },
      include: {
        accountPosts: {
          include: { account: { include: { platform: { select: { platformCode: true, name: true, logoUrl: true } } } } },
        },
      },
      orderBy: { scheduledFor: "asc" },
    });

    // Group by date string YYYY-MM-DD
    const byDate = {};
    for (const post of posts) {
      const date = post.scheduledFor.toISOString().slice(0, 10);
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push({
        id: post.id,
        title: post.title,
        content: post.content.slice(0, 100),
        status: post.status,
        post_type: post.postType,
        scheduled_for: post.scheduledFor,
        platforms: post.accountPosts.map((ap) => ap.account?.platform?.platformCode).filter(Boolean),
      });
    }

    return NextResponse.json({ calendar: byDate, year, month });
  } catch (err) {
    console.error("[GET /api/v1/social/calendar]", err);
    return NextResponse.json({ error: "Failed to fetch calendar data" }, { status: 500 });
  }
});
