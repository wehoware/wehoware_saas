/**
 * /api/v1/appointment-types
 *
 * Prisma/MySQL-backed handlers for appointment types.
 *
 * GET  — list all appointment types for the resolved client
 * POST — create a new appointment type (employee/admin only)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

/**
 * Resolve the clientId that scopes this request.
 * - employee/admin: use activeClientId (set by auth-middleware via ?clientId= param)
 * - client:        use their own clientId
 */
function resolveClientId(user) {
  if (user.role === "client") return user.clientId;
  return user.activeClientId ?? null;
}

/**
 * Map a Prisma WehowareAppointmentType row to the snake_case response shape.
 */
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

// -------------------------------------------------------------------
// GET /api/v1/appointment-types
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "No client context resolved. Pass ?clientId= or ensure your profile has a clientId." },
          { status: 400 }
        );
      }

      const types = await prisma.wehowareAppointmentType.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ appointment_types: types.map(serialize) });
    } catch (err) {
      console.error("[GET /api/v1/appointment-types] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch appointment types" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// POST /api/v1/appointment-types
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "No client context resolved. Pass ?clientId= to set an active client." },
          { status: 400 }
        );
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const {
        name,
        duration,
        description,
        color,
        slug,
        active,
        requires_confirmation,
        price,
        currency,
      } = body ?? {};

      if (!name || duration == null) {
        return NextResponse.json(
          { error: "name and duration are required" },
          { status: 400 }
        );
      }

      const parsedDuration = parseInt(duration, 10);
      if (isNaN(parsedDuration) || parsedDuration <= 0) {
        return NextResponse.json(
          { error: "duration must be a positive integer (minutes)" },
          { status: 400 }
        );
      }

      const created = await prisma.wehowareAppointmentType.create({
        data: {
          clientId,
          name,
          duration: parsedDuration,
          description: description ?? null,
          color: color ?? null,
          slug: slug ?? null,
          active: active !== undefined ? Boolean(active) : true,
          requiresConfirmation:
            requires_confirmation !== undefined
              ? Boolean(requires_confirmation)
              : false,
          price: price != null ? parseFloat(price) : null,
          currency: currency ?? null,
          createdBy: user.id,
        },
      });

      return NextResponse.json(serialize(created), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/appointment-types] error:", err);
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "An appointment type with that slug already exists for this client" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create appointment type" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
