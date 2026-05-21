/**
 * /api/v1/appointments/[id]
 *
 * Prisma/MySQL-backed handlers for a single appointment.
 *
 * GET    — fetch one appointment (with appointment type)
 * PUT    — update status and/or other fields
 * DELETE — remove the record
 *
 * Role rules:
 *  - GET / PUT / DELETE: client, employee, admin
 *    (clients are scoped to their own clientId automatically)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import { triggerAppointmentNotification } from "@/lib/notification-service";
import { syncAppointmentToCalendars, removeAppointmentFromCalendars } from "@/lib/calendar-sync";
import { generateMeetingLink } from "@/lib/video-meeting-service";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId;
  return user.activeClientId ?? null;
}

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

const VALID_STATUSES = new Set([
  "Pending",
  "Confirmed",
  "Cancelled",
  "Completed",
  "NoShow",
]);

/**
 * Load a single appointment, scoped to the resolved client.
 * Returns null when not found or when the record belongs to a different client.
 */
async function loadAppointment(prisma, user, id) {
  const clientId = resolveClientId(user);
  const where = { id };
  if (clientId) where.clientId = clientId;

  return prisma.wehowareAppointment.findFirst({
    where,
    include: { appointmentType: APPOINTMENT_TYPE_SELECT },
  });
}

// -------------------------------------------------------------------
// GET /api/v1/appointments/[id]
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const record = await loadAppointment(prisma, user, id);
      if (!record) {
        return NextResponse.json(
          { error: "Appointment not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(serialize(record));
    } catch (err) {
      console.error("[GET /api/v1/appointments/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch appointment" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PUT /api/v1/appointments/[id]
// -------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const existing = await loadAppointment(prisma, user, id);
      if (!existing) {
        return NextResponse.json(
          { error: "Appointment not found" },
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

      if (body.guest_name !== undefined) data.guestName = body.guest_name;
      if (body.guest_email !== undefined) data.guestEmail = body.guest_email;
      if (body.guest_phone !== undefined) data.guestPhone = body.guest_phone ?? null;
      if (body.location !== undefined) data.location = body.location ?? null;
      if (body.meeting_link !== undefined) data.meetingLink = body.meeting_link ?? null;
      if (body.address !== undefined) data.address = body.address ?? null;
      if (body.notes !== undefined) data.notes = body.notes ?? null;
      if (body.timezone !== undefined) data.timezone = body.timezone ?? null;

      if (body.status !== undefined) {
        if (!VALID_STATUSES.has(body.status)) {
          return NextResponse.json(
            {
              error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(", ")}`,
            },
            { status: 400 }
          );
        }
        data.status = body.status;
      }

      if (body.scheduled_at !== undefined) {
        const scheduledDate = new Date(body.scheduled_at);
        if (isNaN(scheduledDate.getTime())) {
          return NextResponse.json(
            { error: "Invalid scheduled_at date format. Use ISO 8601." },
            { status: 400 }
          );
        }
        data.scheduledAt = scheduledDate;
      }

      if (body.appointment_type_id !== undefined) {
        const newTypeId = body.appointment_type_id ?? null;
        if (newTypeId !== null) {
          const clientId = resolveClientId(user) ?? existing.clientId;
          const typeExists = await prisma.wehowareAppointmentType.findFirst({
            where: { id: newTypeId, clientId },
            select: { id: true },
          });
          if (!typeExists) {
            return NextResponse.json(
              { error: "appointment_type_id not found for this client" },
              { status: 400 }
            );
          }
        }
        data.appointmentTypeId = newTypeId;
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      // Auto-generate Zoom meeting link if location switched to video and no link
      const hasNoMeetingLink = !existing.meetingLink && !data.meetingLink && !body.meeting_link;
      const isVideoLocation =
        data.location &&
        ["video", "zoom", "google meet", "teams", "virtual", "online"].some(
          (v) => data.location.toLowerCase().includes(v)
        );
      if (hasNoMeetingLink && isVideoLocation) {
        const zoomResult = await generateMeetingLink(
          { scheduledAt: data.scheduledAt || existing.scheduledAt, guestName: data.guestName || existing.guestName, guestEmail: data.guestEmail || existing.guestEmail, notes: data.notes || existing.notes, timezone: data.timezone || existing.timezone, appointmentTypeId: data.appointmentTypeId || existing.appointmentTypeId },
          existing.clientId
        );
        if (zoomResult?.link) {
          data.meetingLink = zoomResult.link;
        }
      }

      data.updatedBy = user.id;

      // Track status and schedule changes for notifications
      const oldStatus = existing.status;
      const oldScheduledAt = existing.scheduledAt;
      const newStatus = data.status;
      const newScheduledAt = data.scheduledAt;

      const updated = await prisma.wehowareAppointment.update({
        where: { id },
        data,
        include: { appointmentType: APPOINTMENT_TYPE_SELECT },
      });

      // Trigger notifications based on changes
      const client = await prisma.wehowareClient.findUnique({
        where: { id: existing.clientId },
        select: { name: true },
      });

      if (client) {
        const serialized = serialize(updated);

        // Status change notifications
        if (newStatus && newStatus !== oldStatus) {
          if (newStatus === "Confirmed") {
            triggerAppointmentNotification('confirmed', serialized, existing.clientId, client.name).catch(err => {
              console.error('[PUT /api/v1/appointments/[id]] notification error:', err);
            });
          } else if (newStatus === "Cancelled") {
            triggerAppointmentNotification('cancelled', serialized, existing.clientId, client.name).catch(err => {
              console.error('[PUT /api/v1/appointments/[id]] notification error:', err);
            });
          }
        }

        // Reschedule notification
        if (newScheduledAt && newScheduledAt.getTime() !== oldScheduledAt.getTime()) {
          triggerAppointmentNotification('rescheduled', serialized, existing.clientId, client.name, {
            oldDate: oldScheduledAt.toISOString(),
          }).catch(err => {
            console.error('[PUT /api/v1/appointments/[id]] notification error:', err);
          });
        }
      }

      // Sync updates to connected calendars (non-blocking)
      syncAppointmentToCalendars(updated, existing.clientId).catch(err => {
        console.error('[PUT /api/v1/appointments/[id]] calendar sync error:', err);
      });

      return NextResponse.json(serialize(updated));
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid appointment_type_id" },
          { status: 400 }
        );
      }
      console.error("[PUT /api/v1/appointments/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to update appointment" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// DELETE /api/v1/appointments/[id]
// -------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const existing = await loadAppointment(prisma, user, id);
      if (!existing) {
        return NextResponse.json(
          { error: "Appointment not found" },
          { status: 404 }
        );
      }

      // Trigger cancellation notification before deleting
      const client = await prisma.wehowareClient.findUnique({
        where: { id: existing.clientId },
        select: { name: true },
      });

      if (client) {
        triggerAppointmentNotification('cancelled', serialize(existing), existing.clientId, client.name).catch(err => {
          console.error('[DELETE /api/v1/appointments/[id]] notification error:', err);
        });
      }

      // Remove from connected calendars (non-blocking)
      removeAppointmentFromCalendars(existing.id, existing.clientId).catch(err => {
        console.error('[DELETE /api/v1/appointments/[id]] calendar removal error:', err);
      });

      await prisma.wehowareAppointment.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/appointments/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to delete appointment" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
