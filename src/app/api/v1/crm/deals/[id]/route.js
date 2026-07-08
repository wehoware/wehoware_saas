/**
 * /api/v1/crm/deals/[id]
 * GET    — single deal with relations
 * PUT    — update deal (including stage move)
 * DELETE — soft-delete deal
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

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
    pipeline: d.pipeline ? { id: d.pipeline.id, name: d.pipeline.name } : null,
    activities: (d.activities || []).map((a) => ({
      id: a.id,
      type: a.type,
      direction: a.direction,
      title: a.title,
      description: a.description ?? null,
      scheduled_at: a.scheduledAt ?? null,
      completed_at: a.completedAt ?? null,
      created_at: a.createdAt,
    })),
  };
}

export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      const { id } = await params;

      const deal = await prisma.wehowareCrmDeal.findFirst({
        where: { id, clientId },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true, company: true } },
          stage: { select: { id: true, name: true, stageType: true, displayOrder: true, color: true } },
          pipeline: { select: { id: true, name: true } },
          activities: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      });
      if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

      return NextResponse.json({ data: serializeDeal(deal) });
    } catch (err) {
      console.error("[GET /api/v1/crm/deals/[id]] error:", err);
      return NextResponse.json({ error: "Failed to fetch deal" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      const { id } = await params;

      const existing = await prisma.wehowareCrmDeal.findFirst({
        where: { id, clientId },
        select: { id: true, stageId: true, status: true },
      });
      if (!existing) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const data = { updatedBy: user.id };

      if (body.title !== undefined) data.title = body.title;
      if (body.value !== undefined) data.value = Number(body.value);
      if (body.currency !== undefined) data.currency = body.currency;
      if (body.contact_id !== undefined) data.contactId = body.contact_id;
      if (body.notes !== undefined) data.notes = body.notes;
      if (body.tags !== undefined) data.tags = body.tags;
      if (body.assigned_to !== undefined) data.assignedTo = body.assigned_to;
      if (body.expected_close_date !== undefined) {
        data.expectedCloseDate = body.expected_close_date ? new Date(body.expected_close_date) : null;
      }

      if (body.stage_id !== undefined) {
        const stage = await prisma.wehowareCrmPipelineStage.findFirst({
          where: { id: body.stage_id, pipeline: { clientId } },
          select: { id: true },
        });
        if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 });
        data.stageId = body.stage_id;
      }

      if (body.status !== undefined) {
        if (!VALID_STATUSES.has(body.status)) {
          return NextResponse.json({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}` }, { status: 400 });
        }
        data.status = body.status;
        if (body.status === "Won" || body.status === "Lost") {
          data.closedAt = new Date();
          if (body.closed_reason !== undefined) data.closedReason = body.closed_reason;
        }
      }

      if (Object.keys(data).length === 1) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
      }

      const updated = await prisma.wehowareCrmDeal.update({
        where: { id },
        data,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true, company: true } },
          stage: { select: { id: true, name: true, stageType: true, displayOrder: true, color: true } },
          pipeline: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({ data: serializeDeal(updated) });
    } catch (err) {
      console.error("[PUT /api/v1/crm/deals/[id]] error:", err);
      return NextResponse.json({ error: "Failed to update deal" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      const { id } = await params;

      const existing = await prisma.wehowareCrmDeal.findFirst({
        where: { id, clientId },
        select: { id: true, _count: { select: { activities: true } } },
      });
      if (!existing) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

      if (existing._count.activities > 0) {
        await prisma.wehowareCrmDeal.update({
          where: { id },
          data: { active: false, updatedBy: user.id },
        });
        return NextResponse.json({ data: { id, active: false, archived: true } });
      }

      await prisma.wehowareCrmDeal.delete({ where: { id } });
      return NextResponse.json({ data: { id, deleted: true } });
    } catch (err) {
      console.error("[DELETE /api/v1/crm/deals/[id]] error:", err);
      return NextResponse.json({ error: "Failed to delete deal" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
