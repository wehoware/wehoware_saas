/**
 * /api/v1/crm/pipelines/[id]/stages
 * POST — add a stage to a pipeline
 * PUT  — reorder stages (bulk update display_order)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

const VALID_STAGE_TYPES = new Set(["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost", "Custom"]);

export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }
      const { id: pipelineId } = await params;

      const pipeline = await prisma.wehowareCrmPipeline.findFirst({
        where: { id: pipelineId, clientId },
        select: { id: true, stages: { orderBy: { displayOrder: "desc" }, take: 1, select: { displayOrder: true } } },
      });
      if (!pipeline) {
        return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const { name, stage_type = "Custom", color = null } = body ?? {};
      if (!name) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
      }
      if (!VALID_STAGE_TYPES.has(stage_type)) {
        return NextResponse.json({ error: `Invalid stage_type. Must be one of: ${[...VALID_STAGE_TYPES].join(", ")}` }, { status: 400 });
      }

      const nextOrder = (pipeline.stages[0]?.displayOrder ?? -1) + 1;

      const stage = await prisma.wehowareCrmPipelineStage.create({
        data: {
          pipelineId,
          name,
          stageType: stage_type,
          displayOrder: nextOrder,
          color,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      return NextResponse.json({
        data: {
          id: stage.id,
          pipeline_id: stage.pipelineId,
          name: stage.name,
          stage_type: stage.stageType,
          display_order: stage.displayOrder,
          color: stage.color,
          active: stage.active,
        },
      }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/crm/pipelines/[id]/stages] error:", err);
      return NextResponse.json({ error: "Failed to create stage" }, { status: 500 });
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
      const { id: pipelineId } = await params;

      const pipeline = await prisma.wehowareCrmPipeline.findFirst({
        where: { id: pipelineId, clientId },
        select: { id: true },
      });
      if (!pipeline) {
        return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const { stages } = body ?? {};
      if (!Array.isArray(stages) || stages.length === 0) {
        return NextResponse.json({ error: "stages array is required" }, { status: 400 });
      }

      await Promise.all(
        stages.map((s) =>
          prisma.wehowareCrmPipelineStage.update({
            where: { id: s.id },
            data: { displayOrder: s.display_order, updatedBy: user.id },
          })
        )
      );

      const updatedStages = await prisma.wehowareCrmPipelineStage.findMany({
        where: { pipelineId },
        orderBy: { displayOrder: "asc" },
      });

      return NextResponse.json({
        data: updatedStages.map((s) => ({
          id: s.id,
          pipeline_id: s.pipelineId,
          name: s.name,
          stage_type: s.stageType,
          display_order: s.displayOrder,
          color: s.color,
          active: s.active,
        })),
      });
    } catch (err) {
      console.error("[PUT /api/v1/crm/pipelines/[id]/stages] error:", err);
      return NextResponse.json({ error: "Failed to reorder stages" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
