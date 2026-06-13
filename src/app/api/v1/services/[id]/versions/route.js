/**
 * GET  /api/v1/services/[id]/versions   — list saved versions (newest first)
 * POST /api/v1/services/[id]/versions   — save current state as a new version
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = user.activeClientId ?? user.clientId;
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

      const versions = await prisma.wehowareServiceVersion.findMany({
        where: { serviceId: id },
        include: { saver: { select: { firstName: true, lastName: true } } },
        orderBy: { versionNum: "desc" },
      });

      return NextResponse.json({
        versions: versions.map((v) => ({
          id: v.id,
          version_num: v.versionNum,
          title: v.title,
          description: v.description,
          saved_at: v.savedAt,
          saved_by: v.saver
            ? `${v.saver.firstName ?? ""} ${v.saver.lastName ?? ""}`.trim()
            : null,
        })),
      });
    } catch (err) {
      console.error("[GET /api/v1/services/[id]/versions] error:", err);
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
      const clientId = user.activeClientId ?? user.clientId;
      if (!clientId) {
        return NextResponse.json({ error: "Active client context required" }, { status: 400 });
      }

      const service = await prisma.wehowareService.findFirst({
        where: { id, clientId },
        select: { id: true, title: true, content: true, description: true },
      });
      if (!service) {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }

      const last = await prisma.wehowareServiceVersion.findFirst({
        where: { serviceId: id },
        orderBy: { versionNum: "desc" },
        select: { versionNum: true },
      });

      const version = await prisma.wehowareServiceVersion.create({
        data: {
          serviceId: id,
          versionNum: (last?.versionNum ?? 0) + 1,
          title: service.title,
          content: service.content,
          description: service.description,
          savedBy: user.id,
        },
      });

      return NextResponse.json({ version_num: version.versionNum }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/services/[id]/versions] error:", err);
      return NextResponse.json({ error: "Failed to save version" }, { status: 500 });
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
