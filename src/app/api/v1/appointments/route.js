/**
 * /api/v1/appointments
 *
 * Prisma/MySQL-backed handlers for appointments.
 *
 * GET  — paginated list, filterable by status / date range
 * POST — create an appointment
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";
import { triggerAppointmentNotification } from "@/lib/notification-service";
import { syncAppointmentToCalendars } from "@/lib/calendar-sync";
import { generateMeetingLink } from "@/lib/video-meeting-service";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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
 * Map a Prisma WehowareAppointment row (with optional appointmentType relation)
 * to the snake_case response shape.
 */
function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    client_id: row.clientId,
    appointment_type_id: row.appointmentTypeId ?? null,
    guest_name: row.guestName,
    guest_email: row.guestEmail,
    guest_phone: row.guestPhone ?? null,
    scheduled_at: row.scheduledAt,
    status: row.status,
    location: row.location ?? null,
    meeting_link: row.meetingLink ?? null,
    address: row.address ?? null,
    notes: row.notes ?? null,
    timezone: row.timezone ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    created_by: row.createdBy ?? null,
    updated_by: row.updatedBy ?? null,
    appointment_type: row.appointmentType
      ? {
          id: row.appointmentType.id,
          name: row.appointmentType.name,
          duration: row.appointmentType.duration,
          color: row.appointmentType.color ?? null,
        }
      : null,
  };
}

const APPOINTMENT_TYPE_SELECT = {
  select: {
    id: true,
    name: true,
    duration: true,
    color: true,
  },
};

// -------------------------------------------------------------------
// GET /api/v1/appointments
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const { searchParams } = new URL(request.url);

      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "No client context resolved. Pass ?clientId= or ensure your profile has a clientId." },
          { status: 400 }
        );
      }

      // Pagination
      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10))
      );

      // Filters
      const statusParam = searchParams.get("status");
      const fromParam = searchParams.get("from");
      const toParam = searchParams.get("to");

      const VALID_STATUSES = new Set([
        "Pending",
        "Confirmed",
        "Cancelled",
        "Completed",
        "NoShow",
      ]);

      const where = { clientId };

      if (statusParam) {
        if (!VALID_STATUSES.has(statusParam)) {
          return NextResponse.json(
            {
              error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}`,
            },
            { status: 400 }
          );
        }
        where.status = statusParam;
      }

      if (fromParam || toParam) {
        where.scheduledAt = {};
        if (fromParam) {
          const fromDate = new Date(fromParam);
          if (isNaN(fromDate.getTime())) {
            return NextResponse.json(
              { error: "Invalid 'from' date format. Use ISO 8601." },
              { status: 400 }
            );
          }
          where.scheduledAt.gte = fromDate;
        }
        if (toParam) {
          const toDate = new Date(toParam);
          if (isNaN(toDate.getTime())) {
            return NextResponse.json(
              { error: "Invalid 'to' date format. Use ISO 8601." },
              { status: 400 }
            );
          }
          where.scheduledAt.lte = toDate;
        }
      }

      const [items, total] = await Promise.all([
        prisma.wehowareAppointment.findMany({
          where,
          include: { appointmentType: APPOINTMENT_TYPE_SELECT },
          orderBy: { scheduledAt: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareAppointment.count({ where }),
      ]);

      return NextResponse.json({
        appointments: items.map(serialize),
        total,
        page,
        limit,
      });
    } catch (err) {
      console.error("[GET /api/v1/appointments] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch appointments" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// POST /api/v1/appointments
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
        guest_name,
        guest_email,
        scheduled_at,
        appointment_type_id,
        guest_phone,
        status,
        location,
        meeting_link,
        address,
        notes,
        timezone,
      } = body ?? {};

      // Required fields
      if (!guest_name || !guest_email || !scheduled_at) {
        return NextResponse.json(
          { error: "guest_name, guest_email, and scheduled_at are required" },
          { status: 400 }
        );
      }

      const scheduledDate = new Date(scheduled_at);
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid scheduled_at date format. Use ISO 8601." },
          { status: 400 }
        );
      }

      const VALID_STATUSES = new Set([
        "Pending",
        "Confirmed",
        "Cancelled",
        "Completed",
        "NoShow",
      ]);

      if (status && !VALID_STATUSES.has(status)) {
        return NextResponse.json(
          {
            error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Verify the appointment type belongs to this client (if provided)
      if (appointment_type_id) {
        const typeExists = await prisma.wehowareAppointmentType.findFirst({
          where: { id: appointment_type_id, clientId },
          select: { id: true },
        });
        if (!typeExists) {
          return NextResponse.json(
            { error: "appointment_type_id not found for this client" },
            { status: 400 }
          );
        }
      }

      // Auto-generate Zoom meeting link if video location and no link provided
      let autoMeetingLink = meeting_link ?? null;
      const isVideoLocation =
        location &&
        ["video", "zoom", "google meet", "teams", "virtual", "online"].some(
          (v) => location.toLowerCase().includes(v)
        );
      if (!autoMeetingLink && isVideoLocation) {
        const zoomResult = await generateMeetingLink(
          { scheduledAt: scheduledDate, guestName: guest_name, guestEmail: guest_email, notes, timezone, appointmentTypeId: appointment_type_id },
          clientId
        );
        if (zoomResult?.link) {
          autoMeetingLink = zoomResult.link;
        }
      }

      const created = await prisma.wehowareAppointment.create({
        data: {
          clientId,
          appointmentTypeId: appointment_type_id ?? null,
          guestName: guest_name,
          guestEmail: guest_email,
          guestPhone: guest_phone ?? null,
          scheduledAt: scheduledDate,
          status: status ?? "Pending",
          location: location ?? null,
          meetingLink: autoMeetingLink,
          address: address ?? null,
          notes: notes ?? null,
          timezone: timezone ?? null,
          createdBy: user.id,
        },
        include: { appointmentType: APPOINTMENT_TYPE_SELECT },
      });

      // Trigger notification (non-blocking)
      const client = await prisma.wehowareClient.findUnique({
        where: { id: clientId },
        select: { name: true },
      });
      if (client) {
        triggerAppointmentNotification('created', serialize(created), clientId, client.name).catch(err => {
          console.error('[POST /api/v1/appointments] notification error:', err);
        });
      }

      // Sync to connected calendars (non-blocking)
      syncAppointmentToCalendars(created, clientId).catch(err => {
        console.error('[POST /api/v1/appointments] calendar sync error:', err);
      });

      return NextResponse.json(serialize(created), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/appointments] error:", err);
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid appointment_type_id or client_id" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create appointment" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
