/**
 * /api/v1/crm/activities
 * GET  — paginated list with filter by contact, deal, type, direction
 * POST — create a new activity
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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

function serializeActivity(a) {
  return {
    id: a.id,
    client_id: a.clientId,
    contact_id: a.contactId ?? null,
    deal_id: a.dealId ?? null,
    type: a.type,
    direction: a.direction,
    title: a.title,
    description: a.description ?? null,
    scheduled_at: a.scheduledAt ?? null,
    completed_at: a.completedAt ?? null,
    duration_minutes: a.durationMinutes ?? null,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
    created_by: a.createdBy ?? null,
    updated_by: a.updatedBy ?? null,
    contact: a.contact ? {
      id: a.contact.id,
      first_name: a.contact.firstName,
      last_name: a.contact.lastName,
      email: a.contact.email,
    } : null,
    deal: a.deal ? { id: a.deal.id, title: a.deal.title } : null,
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
      const contactId = searchParams.get("contact_id");
      const dealId = searchParams.get("deal_id");
      const type = searchParams.get("type");
      const direction = searchParams.get("direction");
      const completed = searchParams.get("completed");

      if (type && !VALID_TYPES.has(type)) {
        return NextResponse.json({ error: `Invalid type` }, { status: 400 });
      }
      if (direction && !VALID_DIRECTIONS.has(direction)) {
        return NextResponse.json({ error: `Invalid direction` }, { status: 400 });
      }

      const where = { clientId };
      if (contactId) where.contactId = contactId;
      if (dealId) where.dealId = dealId;
      if (type) where.type = type;
      if (direction) where.direction = direction;
      if (completed === "true") where.completedAt = { not: null };
      if (completed === "false") where.completedAt = null;

      const [items, total] = await Promise.all([
        prisma.wehowareCrmActivity.findMany({
          where,
          include: {
            contact: { select: { id: true, firstName: true, lastName: true, email: true } },
            deal: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareCrmActivity.count({ where }),
      ]);

      return NextResponse.json({
        data: items.map(serializeActivity),
        pagination: { totalItems: total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
      });
    } catch (err) {
      console.error("[GET /api/v1/crm/activities] error:", err);
      return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
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
        contact_id, deal_id, type, direction = "Internal",
        title, description, scheduled_at, completed_at,
        duration_minutes,
      } = body ?? {};

      if (!type || !title) {
        return NextResponse.json({ error: "type and title are required" }, { status: 400 });
      }
      if (!VALID_TYPES.has(type)) {
        return NextResponse.json({ error: `Invalid type. Must be one of: ${[...VALID_TYPES].join(", ")}` }, { status: 400 });
      }
      if (!VALID_DIRECTIONS.has(direction)) {
        return NextResponse.json({ error: `Invalid direction. Must be one of: ${[...VALID_DIRECTIONS].join(", ")}` }, { status: 400 });
      }

      const activity = await prisma.wehowareCrmActivity.create({
        data: {
          clientId,
          contactId: contact_id ?? null,
          dealId: deal_id ?? null,
          type,
          direction,
          title,
          description: description ?? null,
          scheduledAt: scheduled_at ? new Date(scheduled_at) : null,
          completedAt: completed_at ? new Date(completed_at) : null,
          durationMinutes: duration_minutes ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          deal: { select: { id: true, title: true } },
        },
      });

      return NextResponse.json({ data: serializeActivity(activity) }, { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/crm/activities] error:", err);
      return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
