/**
 * /api/v1/appointment-types/[id]
 *
 * Prisma/MySQL-backed handlers for a single appointment type.
 *
 * GET    — fetch one appointment type
 * PUT    — update fields
 * DELETE — remove the record
 *
 * Role rules:
 *  - GET:            client, employee, admin
 *  - PUT / DELETE:   employee, admin only
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId;
  return user.activeClientId ?? null;
}

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    client_id: row.clientId,
    name: row.name,
    description: row.description ?? null,
    duration: row.duration,
    color: row.color ?? null,
    slug: row.slug ?? null,
    active: row.active,
    requires_confirmation: row.requiresConfirmation,
    price: row.price ?? null,
    currency: row.currency ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    created_by: row.createdBy ?? null,
  };
}

/**
 * Load a single appointment type, scoped to the resolved client.
 * Returns null when not found or when the record belongs to a different client.
 */
async function loadAppointmentType(prisma, user, id) {
  const clientId = resolveClientId(user);
  const where = { id };
  if (clientId) where.clientId = clientId;

  return prisma.wehowareAppointmentType.findFirst({ where });
}

// -------------------------------------------------------------------
// GET /api/v1/appointment-types/[id]
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const record = await loadAppointmentType(prisma, user, id);
      if (!record) {
        return NextResponse.json(
          { error: "Appointment type not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(serialize(record));
    } catch (err) {
      console.error("[GET /api/v1/appointment-types/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch appointment type" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PUT /api/v1/appointment-types/[id]
// -------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const existing = await loadAppointmentType(prisma, user, id);
      if (!existing) {
        return NextResponse.json(
          { error: "Appointment type not found" },
          { status: 404 }
        );
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const data = {};

      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description ?? null;
      if (body.color !== undefined) data.color = body.color ?? null;
      if (body.slug !== undefined) data.slug = body.slug ?? null;
      if (body.active !== undefined) data.active = Boolean(body.active);
      if (body.requires_confirmation !== undefined) {
        data.requiresConfirmation = Boolean(body.requires_confirmation);
      }
      if (body.price !== undefined) {
        data.price = body.price != null ? parseFloat(body.price) : null;
      }
      if (body.currency !== undefined) data.currency = body.currency ?? null;

      if (body.duration !== undefined) {
        const parsed = parseInt(body.duration, 10);
        if (isNaN(parsed) || parsed <= 0) {
          return NextResponse.json(
            { error: "duration must be a positive integer (minutes)" },
            { status: 400 }
          );
        }
        data.duration = parsed;
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      const updated = await prisma.wehowareAppointmentType.update({
        where: { id },
        data,
      });

      return NextResponse.json(serialize(updated));
    } catch (err) {
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "An appointment type with that slug already exists for this client" },
          { status: 409 }
        );
      }
      console.error("[PUT /api/v1/appointment-types/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to update appointment type" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);

// -------------------------------------------------------------------
// DELETE /api/v1/appointment-types/[id]
// -------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const existing = await loadAppointmentType(prisma, user, id);
      if (!existing) {
        return NextResponse.json(
          { error: "Appointment type not found" },
          { status: 404 }
        );
      }

      await prisma.wehowareAppointmentType.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/appointment-types/[id]] error:", err);
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Cannot delete: this appointment type is referenced by existing appointments" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete appointment type" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
