/**
 * POST /api/public/appointments?client_slug=acme-corp
 *
 * Guest creates an appointment without authentication.
 * Validates availability to prevent double-booking.
 * Returns a secure booking token for future lookup.
 */
import { NextResponse } from "next/server";
import { withPublic } from "../utils/public-middleware";
import { getFreeSlots } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

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

    if (!guest_name || !guest_email || !scheduled_at || !appointment_type_id) {
      return NextResponse.json(
        {
          error:
            "guest_name, guest_email, appointment_type_id, and scheduled_at are required",
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
    const apptType = await prisma.wehowareAppointmentType.findFirst({
      where: { id: appointment_type_id, clientId: client.id, active: true },
      select: { id: true, name: true, duration: true, requiresConfirmation: true },
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
      include: { appointmentType: { select: { name: true, duration: true, color: true } } },
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
          type: created.appointmentType?.name || null,
          duration: created.appointmentType?.duration || null,
          timezone: created.timezone,
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
