/**
 * /api/v1/crm/pipelines/[id]
 * GET    — single pipeline with stages and deal counts
 * PUT    — update pipeline (name, description, is_default, active)
 * DELETE — delete pipeline (cascades stages, deals remain via FK)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serializePipeline(p) {
  return {
    id: p.id,
    client_id: p.clientId,
    name: p.name,
    description: p.description ?? null,
    is_default: p.isDefault,
    active: p.active,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    created_by: p.createdBy ?? null,
    updated_by: p.updatedBy ?? null,
    stages: (p.stages || []).map((s) => ({
      id: s.id,
      pipeline_id: s.pipelineId,
      name: s.name,
      stage_type: s.stageType,
      display_order: s.displayOrder,
      color: s.color ?? null,
      active: s.active,
      _count: s._count ?? null,
    })),
    _count: p._count ?? null,
  };
}

export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }
      const { id } = await params;
      const pipeline = await prisma.wehowareCrmPipeline.findFirst({
        where: { id, clientId },
        include: {
          stages: {
            orderBy: { displayOrder: "asc" },
            include: { _count: { select: { deals: true } } },
          },
          _count: { select: { deals: true } },
        },
      });
      if (!pipeline) {
        return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
      }
      return NextResponse.json({ data: serializePipeline(pipeline) });
    } catch (err) {
      console.error("[GET /api/v1/crm/pipelines/[id]] error:", err);
      return NextResponse.json({ error: "Failed to fetch pipeline" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }
      const { id } = await params;
      const existing = await prisma.wehowareCrmPipeline.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const data = { updatedBy: user.id };
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.active !== undefined) data.active = body.active;

      if (body.is_default === true) {
        await prisma.wehowareCrmPipeline.updateMany({
          where: { clientId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
        data.isDefault = true;
      }

      if (Object.keys(data).length === 1) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
      }

      const updated = await prisma.wehowareCrmPipeline.update({
        where: { id },
        data,
        include: {
          stages: { orderBy: { displayOrder: "asc" } },
          _count: { select: { deals: true } },
        },
      });

      return NextResponse.json({ data: serializePipeline(updated) });
    } catch (err) {
      console.error("[PUT /api/v1/crm/pipelines/[id]] error:", err);
      return NextResponse.json({ error: "Failed to update pipeline" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }
      const { id } = await params;
      const existing = await prisma.wehowareCrmPipeline.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
      }

      await prisma.wehowareCrmPipeline.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/crm/pipelines/[id]] error:", err);
      return NextResponse.json({ error: "Failed to delete pipeline" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
