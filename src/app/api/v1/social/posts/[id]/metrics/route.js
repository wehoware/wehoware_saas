/**
 * POST /api/v1/social/posts/[id]/metrics
 * On-demand insights refresh for a post's published platform copies.
 * The 6-hourly collect_post_metrics cron is too slow for interactive use —
 * this lets users pull fresh likes/reach/etc. straight from the post page.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";
import { getSocialClient } from "@/lib/social-clients/index.js";
import { shapePost, POST_INCLUDE } from "@/lib/social-clients/post-utils.js";

export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = user.activeClientId || user.clientId;

      const post = await prisma.wehowareSocialPost.findFirst({
        where: user.role === "admin" ? { id } : { id, clientId },
      });
      if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

      const accountPosts = await prisma.wehowareSocialAccountPost.findMany({
        where: { postId: id, status: "Published", platformPostId: { not: null } },
        include: { account: { include: { platform: true } } },
      });

      const results = [];
      for (const ap of accountPosts) {
        try {
          const client = getSocialClient(ap.account);
          const metrics = await client.getPostMetrics(ap.platformPostId);
          if (!metrics || Object.keys(metrics).length === 0) {
            results.push({ accountPostId: ap.id, metrics: {} });
            continue;
          }
          const now = new Date();
          for (const [metricType, metricValue] of Object.entries(metrics)) {
            if (typeof metricValue !== "number" || Number.isNaN(metricValue)) continue;
            await prisma.wehowareSocialPostAnalytics.create({
              data: { accountPostId: ap.id, metricType, metricValue, recordedAt: now },
            });
          }
          await prisma.wehowareSocialAccountPost.update({
            where: { id: ap.id },
            data: { metrics },
          });
          results.push({ accountPostId: ap.id, metrics });
        } catch (err) {
          results.push({ accountPostId: ap.id, error: err.message });
        }
      }

      const updated = await prisma.wehowareSocialPost.findUnique({
        where: { id },
        include: POST_INCLUDE,
      });
      return NextResponse.json({ post: shapePost(updated), results });
    } catch (err) {
      console.error("[POST /api/v1/social/posts/[id]/metrics]", err);
      return NextResponse.json({ error: "Failed to refresh metrics" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
