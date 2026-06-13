/**
 * GET    /api/v1/services/[id]/related-blogs   — list linked blogs
 * POST   /api/v1/services/[id]/related-blogs   — link a blog  { blogId }
 * DELETE /api/v1/services/[id]/related-blogs   — unlink a blog { blogId }
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  return user.activeClientId ?? null;
}

export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "Active client context required" }, { status: 400 });
      }

      const service = await prisma.wehowareService.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!service) {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }

      const relations = await prisma.wehowareBlogServiceRelation.findMany({
        where: { serviceId: id },
        include: {
          blog: {
            select: { id: true, title: true, slug: true, thumbnail: true, excerpt: true, status: true },
          },
        },
      });

      return NextResponse.json({
        blogs: relations.map((r) => ({
          id: r.blog.id,
          title: r.blog.title,
          slug: r.blog.slug,
          thumbnail: r.blog.thumbnail,
          excerpt: r.blog.excerpt,
          status: r.blog.status,
        })),
      });
    } catch (err) {
      console.error("[GET /api/v1/services/[id]/related-blogs] error:", err);
      return NextResponse.json({ error: "Failed to fetch related blogs" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "Active client context required" }, { status: 400 });
      }

      const { blogId } = await request.json();
      if (!blogId) {
        return NextResponse.json({ error: "blogId is required" }, { status: 400 });
      }

      const [service, blog] = await Promise.all([
        prisma.wehowareService.findFirst({ where: { id, clientId }, select: { id: true } }),
        prisma.wehowareBlog.findFirst({ where: { id: blogId, clientId }, select: { id: true } }),
      ]);
      if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });
      if (!blog) return NextResponse.json({ error: "Blog not found" }, { status: 404 });

      await prisma.wehowareBlogServiceRelation.upsert({
        where: { blogId_serviceId: { blogId, serviceId: id } },
        create: { blogId, serviceId: id },
        update: {},
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[POST /api/v1/services/[id]/related-blogs] error:", err);
      return NextResponse.json({ error: "Failed to link blog" }, { status: 500 });
    }
  },
  { allowedRoles: ["employee", "admin"] }
);

export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "Active client context required" }, { status: 400 });
      }

      const { blogId } = await request.json();
      if (!blogId) {
        return NextResponse.json({ error: "blogId is required" }, { status: 400 });
      }

      await prisma.wehowareBlogServiceRelation.deleteMany({
        where: { blogId, serviceId: id },
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/services/[id]/related-blogs] error:", err);
      return NextResponse.json({ error: "Failed to unlink blog" }, { status: 500 });
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
