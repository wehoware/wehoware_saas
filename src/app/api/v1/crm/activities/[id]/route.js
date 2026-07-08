/**
 * /api/v1/crm/activities/[id]
 * PUT    — update activity (mark complete, reschedule, edit)
 * DELETE — delete activity
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

const VALID_TYPES = new Set([
  "Call", "Email", "Meeting", "Note", "Task",
  "SocialMessage", "FormBuilderSubmission", "AppointmentBooked",
]);
const VALID_DIRECTIONS = new Set(["Inbound", "Outbound", "Internal"]);

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) return user.activeClientId ?? null;
  return null;
}

export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) return NextResponse.json({ error: "No client context resolved." }, { status: 400 });
      const { id } = await params;

      const existing = await prisma.wehowareCrmActivity.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) return NextResponse.json({ error: "Activity not found" }, { status: 404 });

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const data = { updatedBy: user.id };

      if (body.title !== undefined) data.title = body.title;
      if (body.description !== undefined) data.description = body.description;
      if (body.scheduled_at !== undefined) {
        data.scheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : null;
      }
      if (body.completed_at !== undefined) {
        data.completedAt = body.completed_at ? new Date(body.completed_at) : null;
      }
      if (body.duration_minutes !== undefined) data.durationMinutes = body.duration_minutes;
      if (body.contact_id !== undefined) data.contactId = body.contact_id;
      if (body.deal_id !== undefined) data.dealId = body.deal_id;

      if (body.type !== undefined) {
        if (!VALID_TYPES.has(body.type)) {
          return NextResponse.json({ error: `Invalid type` }, { status: 400 });
        }
        data.type = body.type;
      }
      if (body.direction !== undefined) {
        if (!VALID_DIRECTIONS.has(body.direction)) {
          return NextResponse.json({ error: `Invalid direction` }, { status: 400 });
        }
        data.direction = body.direction;
      }

      if (Object.keys(data).length === 1) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
      }

      const updated = await prisma.wehowareCrmActivity.update({
        where: { id },
        data,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          deal: { select: { id: true, title: true } },
        },
      });

      return NextResponse.json({
        data: {
          id: updated.id,
          client_id: updated.clientId,
          contact_id: updated.contactId,
          deal_id: updated.dealId,
          type: updated.type,
          direction: updated.direction,
          title: updated.title,
          description: updated.description,
          scheduled_at: updated.scheduledAt,
          completed_at: updated.completedAt,
          duration_minutes: updated.durationMinutes,
          created_at: updated.createdAt,
          updated_at: updated.updatedAt,
        },
      });
    } catch (err) {
      console.error("[PUT /api/v1/crm/activities/[id]] error:", err);
      return NextResponse.json({ error: "Failed to update activity" }, { status: 500 });
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

      const existing = await prisma.wehowareCrmActivity.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) return NextResponse.json({ error: "Activity not found" }, { status: 404 });

      await prisma.wehowareCrmActivity.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/crm/activities/[id]] error:", err);
      return NextResponse.json({ error: "Failed to delete activity" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
