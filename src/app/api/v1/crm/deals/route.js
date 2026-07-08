/**
 * /api/v1/crm/deals
 * GET  — paginated list with filter by pipeline, stage, status, contact
 * POST — create a new deal
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const VALID_STATUSES = new Set(["Open", "Won", "Lost"]);

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

function serializeDeal(d) {
  return {
    id: d.id,
    client_id: d.clientId,
    pipeline_id: d.pipelineId,
    stage_id: d.stageId,
    contact_id: d.contactId ?? null,
    title: d.title,
    value: d.value ? Number(d.value) : 0,
    currency: d.currency,
    status: d.status,
    expected_close_date: d.expectedCloseDate ? d.expectedCloseDate.toISOString().split("T")[0] : null,
    closed_at: d.closedAt ?? null,
    closed_reason: d.closedReason ?? null,
    notes: d.notes ?? null,
    tags: d.tags ?? null,
    assigned_to: d.assignedTo ?? null,
    active: d.active,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
    created_by: d.createdBy ?? null,
    updated_by: d.updatedBy ?? null,
    contact: d.contact ? {
      id: d.contact.id,
      first_name: d.contact.firstName,
      last_name: d.contact.lastName,
      email: d.contact.email,
      company: d.contact.company,
    } : null,
    stage: d.stage ? {
      id: d.stage.id,
      name: d.stage.name,
      stage_type: d.stage.stageType,
      display_order: d.stage.displayOrder,
      color: d.stage.color,
    } : null,
    pipeline: d.pipeline ? {
      id: d.pipeline.id,
      name: d.pipeline.name,
    } : null,
  };
}

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      }

      const { searchParams } = new URL(request.url);
      const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
      const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10)));
      const pipelineId = searchParams.get("pipeline_id");
      const stageId = searchParams.get("stage_id");
      const status = searchParams.get("status");
      const contactId = searchParams.get("contact_id");
      const assignedTo = searchParams.get("assigned_to");

      if (status && !VALID_STATUSES.has(status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
      }

      const where = { clientId, active: true };
      if (pipelineId) where.pipelineId = pipelineId;
      if (stageId) where.stageId = stageId;
      if (status) where.status = status;
      if (contactId) where.contactId = contactId;
      if (assignedTo) where.assignedTo = assignedTo;

      const [items, total] = await Promise.all([
        prisma.wehowareCrmDeal.findMany({
          where,
          include: {
            contact: { select: { id: true, firstName: true, lastName: true, email: true, company: true } },
            stage: { select: { id: true, name: true, stageType: true, displayOrder: true, color: true } },
            pipeline: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareCrmDeal.count({ where }),
      ]);

      return NextResponse.json({
        data: items.map(serializeDeal),
        pagination: { totalItems: total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
      });
    } catch (err) {
      console.error("[GET /api/v1/crm/deals] error:", err);
      return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
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

      const {
        pipeline_id, stage_id, contact_id, title, value = 0, currency = "CAD",
        status = "Open", expected_close_date, notes, tags, assigned_to,
      } = body ?? {};

      if (!pipeline_id || !stage_id || !title) {
        return NextResponse.json({ error: "pipeline_id, stage_id, and title are required" }, { status: 400 });
      }

      if (!VALID_STATUSES.has(status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
      }

      // Verify pipeline belongs to client
      const pipeline = await prisma.wehowareCrmPipeline.findFirst({
        where: { id: pipeline_id, clientId },
        select: { id: true },
      });
      if (!pipeline) {
        return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
      }

      // Verify stage belongs to pipeline
      const stage = await prisma.wehowareCrmPipelineStage.findFirst({
        where: { id: stage_id, pipelineId: pipeline_id },
        select: { id: true },
      });
      if (!stage) {
        return NextResponse.json({ error: "Stage not found in this pipeline" }, { status: 404 });
      }

      const deal = await prisma.wehowareCrmDeal.create({
        data: {
          clientId,
          pipelineId: pipeline_id,
          stageId: stage_id,
          contactId: contact_id ?? null,
          title,
          value: value ? Number(value) : 0,
          currency,
          status,
          expectedCloseDate: expected_close_date ? new Date(expected_close_date) : null,
          notes: notes ?? null,
          tags: tags ?? [],
          assignedTo: assigned_to ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true, company: true } },
          stage: { select: { id: true, name: true, stageType: true, displayOrder: true, color: true } },
          pipeline: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({ data: serializeDeal(deal) }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/crm/deals] error:", err);
      return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
