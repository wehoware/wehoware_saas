/**
 * /api/public/appointments/[token]
 *
 * Public endpoints for a guest to manage their own appointment
 * using an opaque booking token (not a raw UUID).
 *
 * GET  — retrieve appointment details
 * PUT  — reschedule appointment
 * DELETE — cancel appointment (soft delete via status update)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFreeSlots } from "@/lib/availability";
import { corsHeaders } from "../../utils/public-middleware";

const VALID_STATUSES = new Set([
  "Pending",
  "Confirmed",
  "Cancelled",
  "Completed",
  "NoShow",
]);

function serialize(appointment) {
  return {
    id: appointment.id,
    guest_name: appointment.guestName,
    guest_email: appointment.guestEmail,
    guest_phone: appointment.guestPhone,
    scheduled_at: appointment.scheduledAt.toISOString(),
    status: appointment.status,
    timezone: appointment.timezone,
    notes: appointment.notes,
    meeting_link: appointment.meetingLink,
    type: appointment.appointmentType
      ? {
          name: appointment.appointmentType.name,
          duration: appointment.appointmentType.duration,
          color: appointment.appointmentType.color,
        }
      : null,
  };
}

/**
 * CORS wrapper for public responses.
 */
function jsonWithCors(body, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

async function loadByToken(token) {
  if (token?.length !== 64) return null;
  return prisma.wehowareAppointment.findFirst({
    where: { bookingToken: token },
    include: {
      appointmentType: { select: { id: true, name: true, duration: true, color: true } },
      client: { select: { id: true, companyName: true } },
    },
  });
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const appointment = await loadByToken(token);
    if (!appointment) {
      return jsonWithCors({ error: "Appointment not found" }, 404);
    }
    return jsonWithCors({ appointment: serialize(appointment) });
  } catch (err) {
    console.error("[GET /api/public/appointments/[token]] error:", err);
    return jsonWithCors({ error: "Failed to fetch appointment" }, 500);
  }
}

// -------------------------------------------------------------------
// PUT — Reschedule
// -------------------------------------------------------------------
export async function PUT(request, { params }) {
  try {
    const { token } = await params;
    const appointment = await loadByToken(token);
    if (!appointment) {
      return jsonWithCors({ error: "Appointment not found" }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonWithCors({ error: "Invalid JSON body" }, 400);
    }

    const { scheduled_at, notes } = body ?? {};

    if (!scheduled_at) {
      return jsonWithCors({ error: "scheduled_at is required" }, 400);
    }

    const newDate = new Date(scheduled_at);
    if (Number.isNaN(newDate.getTime())) {
      return jsonWithCors(
        { error: "Invalid scheduled_at date format. Use ISO 8601." },
        400
      );
    }

    // Re-validate availability for the new slot
    const dayStart = new Date(newDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(newDate);
    dayEnd.setHours(23, 59, 59, 999);

    const freeSlots = await getFreeSlots(
      appointment.clientId,
      dayStart,
      dayEnd,
      appointment.appointmentType?.duration ?? 30
    );

    const slotMatch = freeSlots.some(
      (s) => Math.abs(s.getTime() - newDate.getTime()) <= 60_000
    );

    if (!slotMatch) {
      return jsonWithCors(
        { error: "The selected time slot is no longer available." },
        409
      );
    }

    const updated = await prisma.wehowareAppointment.update({
      where: { id: appointment.id },
      data: {
        scheduledAt: newDate,
        notes: notes ?? undefined,
        status: appointment.appointmentType?.requiresConfirmation
          ? "Pending"
          : "Confirmed",
      },
      include: {
        appointmentType: { select: { name: true, duration: true, color: true } },
      },
    });

    return jsonWithCors({
      appointment: serialize(updated),
      message: "Appointment rescheduled successfully",
    });
  } catch (err) {
    console.error("[PUT /api/public/appointments/[token]] error:", err);
    return jsonWithCors({ error: "Failed to reschedule appointment" }, 500);
  }
}

// -------------------------------------------------------------------
// DELETE — Cancel
// -------------------------------------------------------------------
export async function DELETE(request, { params }) {
  try {
    const { token } = await params;
    const appointment = await loadByToken(token);
    if (!appointment) {
      return jsonWithCors({ error: "Appointment not found" }, 404);
    }

    await prisma.wehowareAppointment.update({
      where: { id: appointment.id },
      data: { status: "Cancelled" },
    });

    return jsonWithCors({
      success: true,
      message: "Appointment cancelled successfully",
    });
  } catch (err) {
    console.error("[DELETE /api/public/appointments/[token]] error:", err);
    return jsonWithCors({ error: "Failed to cancel appointment" }, 500);
  }
}
