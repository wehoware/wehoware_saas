/**
 * GET  /api/v1/blogs/[id]/versions   — list saved versions (newest first)
 * POST /api/v1/blogs/[id]/versions   — save current state as a new version
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

      const versions = await prisma.wehowareBlogVersion.findMany({
        where: { blogId: id },
        include: { saver: { select: { firstName: true, lastName: true } } },
        orderBy: { versionNum: "desc" },
      });

      return NextResponse.json({
        versions: versions.map((v) => ({
          id: v.id,
          version_num: v.versionNum,
          title: v.title,
          excerpt: v.excerpt,
          status: v.status,
          saved_at: v.savedAt,
          saved_by: v.saver
            ? `${v.saver.firstName ?? ""} ${v.saver.lastName ?? ""}`.trim()
            : null,
        })),
      });
    } catch (err) {
      console.error("[GET /api/v1/blogs/[id]/versions] error:", err);
      return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
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

      const blog = await prisma.wehowareBlog.findFirst({
        where: { id, clientId },
        select: { id: true, title: true, content: true, excerpt: true, status: true },
      });
      if (!blog) {
        return NextResponse.json({ error: "Blog not found" }, { status: 404 });
      }

      const last = await prisma.wehowareBlogVersion.findFirst({
        where: { blogId: id },
        orderBy: { versionNum: "desc" },
        select: { versionNum: true },
      });

      const version = await prisma.wehowareBlogVersion.create({
        data: {
          blogId: id,
          versionNum: (last?.versionNum ?? 0) + 1,
          title: blog.title,
          content: blog.content,
          excerpt: blog.excerpt,
          status: blog.status,
          savedBy: user.id,
        },
      });

      return NextResponse.json({ version_num: version.versionNum }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/blogs/[id]/versions] error:", err);
      return NextResponse.json({ error: "Failed to save version" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
