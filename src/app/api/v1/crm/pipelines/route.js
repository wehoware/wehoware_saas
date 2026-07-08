/**
 * /api/v1/crm/pipelines
 * GET  — list pipelines with stages for active client
 * POST — create a new pipeline with optional default stages
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

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
    })),
    _count: p._count ?? null,
  };
}

const DEFAULT_STAGES = [
  { name: "Lead", stageType: "Lead", displayOrder: 0, color: "#6b7280" },
  { name: "Qualified", stageType: "Qualified", displayOrder: 1, color: "#3b82f6" },
  { name: "Proposal", stageType: "Proposal", displayOrder: 2, color: "#f59e0b" },
  { name: "Negotiation", stageType: "Negotiation", displayOrder: 3, color: "#8b5cf6" },
  { name: "Won", stageType: "Won", displayOrder: 4, color: "#10b981" },
  { name: "Lost", stageType: "Lost", displayOrder: 5, color: "#ef4444" },
];

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }

      const pipelines = await prisma.wehowareCrmPipeline.findMany({
        where: { clientId },
        include: {
          stages: { orderBy: { displayOrder: "asc" } },
          _count: { select: { deals: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json({ data: pipelines.map(serializePipeline) });
    } catch (err) {
      console.error("[GET /api/v1/crm/pipelines] error:", err);
      return NextResponse.json({ error: "Failed to fetch pipelines" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const { name, description, is_default = false, stages } = body ?? {};
      if (!name) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
      }

      // If is_default, unset any existing default
      if (is_default) {
        await prisma.wehowareCrmPipeline.updateMany({
          where: { clientId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const stagesToCreate = stages?.length
        ? stages.map((s, i) => ({
            name: s.name,
            stageType: s.stage_type || "Custom",
            displayOrder: s.display_order ?? i,
            color: s.color ?? null,
          }))
        : DEFAULT_STAGES;

      const pipeline = await prisma.wehowareCrmPipeline.create({
        data: {
          clientId,
          name,
          description: description ?? null,
          isDefault: is_default,
          createdBy: user.id,
          updatedBy: user.id,
          stages: { create: stagesToCreate },
        },
        include: {
          stages: { orderBy: { displayOrder: "asc" } },
          _count: { select: { deals: true } },
        },
      });

      return NextResponse.json({ data: serializePipeline(pipeline) }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/crm/pipelines] error:", err);
      return NextResponse.json({ error: "Failed to create pipeline" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
