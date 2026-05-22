/**
 * POST /api/v1/social/posts/[id]/cancel
 * Cancels a scheduled post.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";

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
      if (post.status !== "Scheduled") {
        return NextResponse.json({ error: "Only Scheduled posts can be cancelled" }, { status: 409 });
      }

      const updated = await prisma.wehowareSocialPost.update({
        where: { id },
        data: { status: "Cancelled", updatedBy: user.id },
      });
      return NextResponse.json({ post: updated });
    } catch (err) {
      console.error("[POST /api/v1/social/posts/[id]/cancel]", err);
      return NextResponse.json({ error: "Failed to cancel post" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
