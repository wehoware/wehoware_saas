/**
 * POST /api/public/appointments
 *
 * Guest creates an appointment without authentication.
 * Validates availability to prevent double-booking.
 * Returns a secure booking token for future lookup.
 *
 * The appointment type can be specified by either:
 *   - appointment_type_slug=30min-consult  (preferred for public widgets)
 *   - appointment_type_id=uuid             (alternative)
 *
 * Usage:
 *   POST /api/public/appointments?domain=example.com
 *   POST /api/public/appointments?clientId=uuid-here
 *   POST /api/public/appointments?client_slug=acme-corp
 *
 * Body:
 *   {
 *     "guest_name": "Jane Doe",
 *     "guest_email": "jane@example.com",
 *     "guest_phone": "+1-555-0123",          // optional
 *     "appointment_type_id": "uuid",          // or appointment_type_slug
 *     "appointment_type_slug": "30min",       // alternative to id
 *     "scheduled_at": "2026-05-10T14:00:00Z",
 *     "notes": "Looking forward to it",       // optional
 *     "timezone": "America/New_York",         // optional, defaults to UTC
 *     "honeypot": ""                          // anti-spam, leave empty
 *   }
 */
import { NextResponse } from "next/server";
import { withPublic } from "../utils/public-middleware";
import { getFreeSlots } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";
import { notifyAppointmentBooked } from "@/lib/appointment-notifications";

function generateBookingToken() {
  return randomBytes(32).toString("hex");
}

export const POST = withPublic(async (request) => {
  try {
    const { client } = request;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      guest_name,
      guest_email,
      guest_phone,
      appointment_type_id,
      appointment_type_slug,
      scheduled_at,
      notes,
      timezone = "UTC",
      honeypot,
    } = body ?? {};

    // Honeypot anti-spam check
    if (honeypot) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    if (!guest_name || !guest_email || !scheduled_at) {
      return NextResponse.json(
        {
          error:
            "guest_name, guest_email, and scheduled_at are required",
        },
        { status: 400 }
      );
    }

    if (!appointment_type_id && !appointment_type_slug) {
      return NextResponse.json(
        {
          error:
            "appointment_type_id or appointment_type_slug is required",
        },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduled_at);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduled_at date format. Use ISO 8601." },
        { status: 400 }
      );
    }

    // Verify the appointment type belongs to this client and is active
    const typeWhere = { clientId: client.id, active: true };
    if (appointment_type_id) {
      typeWhere.id = appointment_type_id;
    } else if (appointment_type_slug) {
      typeWhere.slug = appointment_type_slug;
    }

    const apptType = await prisma.wehowareAppointmentType.findFirst({
      where: typeWhere,
      select: {
        id: true,
        name: true,
        duration: true,
        requiresConfirmation: true,
        color: true,
        slug: true,
      },
    });

    if (!apptType) {
      return NextResponse.json(
        { error: "Appointment type not found or inactive." },
        { status: 404 }
      );
    }

    // Race-safe availability check: recompute free slots for that exact day
    const dayStart = new Date(scheduledDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledDate);
    dayEnd.setHours(23, 59, 59, 999);

    const freeSlots = await getFreeSlots(
      client.id,
      dayStart,
      dayEnd,
      apptType.duration
    );

    // Check if the requested slot is within the free list (±1 min tolerance)
    const slotMatch = freeSlots.some(
      (s) => Math.abs(s.getTime() - scheduledDate.getTime()) <= 60_000
    );

    if (!slotMatch) {
      return NextResponse.json(
        { error: "The selected time slot is no longer available." },
        { status: 409 }
      );
    }

    // Determine status based on requires_confirmation
    const initialStatus = apptType.requiresConfirmation ? "Pending" : "Confirmed";

    const token = generateBookingToken();

    const created = await prisma.wehowareAppointment.create({
      data: {
        clientId: client.id,
        appointmentTypeId: apptType.id,
        guestName: guest_name,
        guestEmail: guest_email,
        guestPhone: guest_phone || null,
        scheduledAt: scheduledDate,
        status: initialStatus,
        notes: notes || null,
        timezone,
        bookingToken: token,
        createdBy: null,
      },
      include: {
        appointmentType: {
          select: { name: true, duration: true, color: true, slug: true },
        },
      },
    });

    // Notify the SaaS owner/admins (non-blocking)
    notifyAppointmentBooked(client.id, {
      id: created.id,
      guest_name: created.guestName,
      guest_email: created.guestEmail,
      guest_phone: created.guestPhone,
      scheduled_at: created.scheduledAt,
      appointment_type: { name: created.appointmentType?.name },
      notes: created.notes,
    }, client.companyName).catch(err => {
      console.error('[POST /api/public/appointments] notification error:', err);
    });

    return NextResponse.json(
      {
        booking_token: token,
        appointment: {
          id: created.id,
          guest_name: created.guestName,
          guest_email: created.guestEmail,
          guest_phone: created.guestPhone,
          scheduled_at: created.scheduledAt.toISOString(),
          status: created.status,
          timezone: created.timezone,
          notes: created.notes,
          type: created.appointmentType?.name || null,
          type_slug: created.appointmentType?.slug || null,
          duration: created.appointmentType?.duration || null,
          color: created.appointmentType?.color || null,
        },
        client: {
          id: client.id,
          name: client.companyName,
          slug: client.publicSlug,
          domain: client.domain ?? null,
        },
        requires_confirmation: apptType.requiresConfirmation,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/public/appointments] error:", err);
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "This time slot has just been booked by someone else." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create appointment" },
      { status: 500 }
    );
  }
});
