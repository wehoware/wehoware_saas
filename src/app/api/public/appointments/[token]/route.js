/**
 * /api/public/appointments/[token]
 *
 * Public endpoints for a guest to manage their own appointment
 * using an opaque booking token (not a raw UUID).
 *
 * GET    — retrieve appointment details
 * PUT    — reschedule appointment
 * DELETE — cancel appointment (soft delete via status update)
 *
 * The token is a 64-char hex string generated at booking time.
 * No client_slug/domain/clientId required — the token uniquely
 * identifies the appointment + client.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFreeSlots } from "@/lib/availability";
import { corsHeaders } from "../../utils/public-middleware";
import { notifyAppointmentEvent } from "@/lib/appointment-notifications";

// Lightweight rate limiting for token endpoints (per IP)
const tokenRateStore = new Map();
const TOKEN_RATE_WINDOW_MS = 60_000;
const TOKEN_RATE_MAX = 30;

function checkTokenRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - TOKEN_RATE_WINDOW_MS;
  let entries = tokenRateStore.get(ip) || [];
  entries = entries.filter((ts) => ts > windowStart);
  if (entries.length >= TOKEN_RATE_MAX) return false;
  entries.push(now);
  tokenRateStore.set(ip, entries);
  return true;
}

function getClientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}

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
    location: appointment.location,
    address: appointment.address,
    type: appointment.appointmentType
      ? {
          name: appointment.appointmentType.name,
          slug: appointment.appointmentType.slug,
          duration: appointment.appointmentType.duration,
          color: appointment.appointmentType.color,
        }
      : null,
    client: appointment.client
      ? {
          name: appointment.client.companyName,
          domain: appointment.client.domain ?? null,
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

/**
 * Rate limit check wrapper for token endpoints.
 */
function checkRateLimit(request) {
  const ip = getClientIp(request);
  if (!checkTokenRateLimit(ip)) {
    return jsonWithCors(
      { error: "Rate limit exceeded. Please try again later." },
      429
    );
  }
  return null;
}

async function loadByToken(token) {
  if (token?.length !== 64) return null;
  return prisma.wehowareAppointment.findFirst({
    where: { bookingToken: token },
    include: {
      appointmentType: {
        select: {
          id: true,
          name: true,
          slug: true,
          duration: true,
          color: true,
          requiresConfirmation: true,
        },
      },
      client: { select: { id: true, companyName: true, domain: true } },
    },
  });
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export async function GET(request, { params }) {
  const rateLimited = checkRateLimit(request);
  if (rateLimited) return rateLimited;

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
  const rateLimited = checkRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const { token } = await params;
    const appointment = await loadByToken(token);
    if (!appointment) {
      return jsonWithCors({ error: "Appointment not found" }, 404);
    }

    // Don't allow rescheduling cancelled or completed appointments
    if (appointment.status === "Cancelled") {
      return jsonWithCors(
        { error: "Cannot reschedule a cancelled appointment" },
        400
      );
    }
    if (appointment.status === "Completed") {
      return jsonWithCors(
        { error: "Cannot reschedule a completed appointment" },
        400
      );
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
        appointmentType: {
          select: { name: true, slug: true, duration: true, color: true },
        },
        client: { select: { id: true, companyName: true, domain: true } },
      },
    });

    // Notify the SaaS owner/admins about the reschedule (non-blocking)
    notifyAppointmentEvent(appointment.clientId, {
      event: "rescheduled",
      id: updated.id,
      guest_name: updated.guestName,
      guest_email: updated.guestEmail,
      guest_phone: updated.guestPhone,
      appointment_type: updated.appointmentType?.name,
      scheduled_at: updated.scheduledAt,
      old_scheduled_at: appointment.scheduledAt,
      status: updated.status,
      actor: "guest",
    }, appointment.client?.companyName).catch(err => {
      console.error('[PUT /api/public/appointments/[token]] owner notification error:', err);
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
// DELETE — Cancel (soft delete via status update, per data-safety rule)
// -------------------------------------------------------------------
export async function DELETE(request, { params }) {
  const rateLimited = checkRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const { token } = await params;
    const appointment = await loadByToken(token);
    if (!appointment) {
      return jsonWithCors({ error: "Appointment not found" }, 404);
    }

    if (appointment.status === "Cancelled") {
      return jsonWithCors(
        { error: "Appointment is already cancelled" },
        400
      );
    }
    if (appointment.status === "Completed") {
      return jsonWithCors(
        { error: "Cannot cancel a completed appointment" },
        400
      );
    }

    await prisma.wehowareAppointment.update({
      where: { id: appointment.id },
      data: { status: "Cancelled" },
    });

    // Notify the SaaS owner/admins about the cancellation (non-blocking)
    notifyAppointmentEvent(appointment.clientId, {
      event: "cancelled",
      id: appointment.id,
      guest_name: appointment.guestName,
      guest_email: appointment.guestEmail,
      guest_phone: appointment.guestPhone,
      appointment_type: appointment.appointmentType?.name,
      scheduled_at: appointment.scheduledAt,
      status: "Cancelled",
      actor: "guest",
    }, appointment.client?.companyName).catch(err => {
      console.error('[DELETE /api/public/appointments/[token]] owner notification error:', err);
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
