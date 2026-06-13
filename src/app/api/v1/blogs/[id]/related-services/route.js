/**
 * GET    /api/v1/blogs/[id]/related-services   — list linked services
 * POST   /api/v1/blogs/[id]/related-services   — link a service  { serviceId }
 * DELETE /api/v1/blogs/[id]/related-services   — unlink a service { serviceId }
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

      const blog = await prisma.wehowareBlog.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!blog) {
        return NextResponse.json({ error: "Blog not found" }, { status: 404 });
      }

      const relations = await prisma.wehowareBlogServiceRelation.findMany({
        where: { blogId: id },
        include: {
          service: {
            select: { id: true, title: true, slug: true, thumbnail: true, fee: true, feeCurrency: true, active: true },
          },
        },
      });

      return NextResponse.json({
        services: relations.map((r) => ({
          id: r.service.id,
          title: r.service.title,
          slug: r.service.slug,
          thumbnail: r.service.thumbnail,
          fee: r.service.fee ? Number(r.service.fee) : null,
          fee_currency: r.service.feeCurrency,
          active: r.service.active,
        })),
      });
    } catch (err) {
      console.error("[GET /api/v1/blogs/[id]/related-services] error:", err);
      return NextResponse.json({ error: "Failed to fetch related services" }, { status: 500 });
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

      const { serviceId } = await request.json();
      if (!serviceId) {
        return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
      }

      const [blog, service] = await Promise.all([
        prisma.wehowareBlog.findFirst({ where: { id, clientId }, select: { id: true } }),
        prisma.wehowareService.findFirst({ where: { id: serviceId, clientId }, select: { id: true } }),
      ]);
      if (!blog) return NextResponse.json({ error: "Blog not found" }, { status: 404 });
      if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

      await prisma.wehowareBlogServiceRelation.upsert({
        where: { blogId_serviceId: { blogId: id, serviceId } },
        create: { blogId: id, serviceId },
        update: {},
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[POST /api/v1/blogs/[id]/related-services] error:", err);
      return NextResponse.json({ error: "Failed to link service" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
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

      const { serviceId } = await request.json();
      if (!serviceId) {
        return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
      }

      await prisma.wehowareBlogServiceRelation.deleteMany({
        where: { blogId: id, serviceId },
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/blogs/[id]/related-services] error:", err);
      return NextResponse.json({ error: "Failed to unlink service" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
