/**
 * GET /api/public/availability?client_slug=acme-corp&appointment_type_slug=30min&from=2026-05-01&to=2026-05-07
 *
 * Returns free time slots for a given client + appointment type across a date range.
 * No authentication required. Rate-limited and CORS-enabled.
 */
import { NextResponse } from "next/server";
import { withPublic } from "../utils/public-middleware";
import { getFreeSlots } from "@/lib/availability";
import { prisma } from "@/lib/prisma";

export const GET = withPublic(async (request) => {
  try {
    const { client } = request;
    const url = new URL(request.url);

    const typeSlug = url.searchParams.get("appointment_type_slug");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    if (!typeSlug || !fromParam || !toParam) {
      return NextResponse.json(
        {
          error:
            "Missing required params: appointment_type_slug, from, to",
        },
        { status: 400 }
      );
    }

    const fromDate = new Date(fromParam);
    const toDate = new Date(toParam);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO 8601 (YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    if (fromDate >= toDate) {
      return NextResponse.json(
        { error: "'from' must be before 'to'." },
        { status: 400 }
      );
    }

    const appointmentType = await prisma.wehowareAppointmentType.findFirst({
      where: { clientId: client.id, slug: typeSlug, active: true },
      select: { id: true, name: true, duration: true },
    });

    if (!appointmentType) {
      return NextResponse.json(
        { error: "Appointment type not found or inactive." },
        { status: 404 }
      );
    }

    const slots = await getFreeSlots(
      client.id,
      fromDate,
      toDate,
      appointmentType.duration
    );

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.companyName,
        slug: client.publicSlug,
      },
      appointment_type: {
        id: appointmentType.id,
        name: appointmentType.name,
        duration: appointmentType.duration,
      },
      slots: slots.map((s) => ({
        start: s.toISOString(),
        // Duration is implicit from the appointment type; consumer can compute end
      })),
      total_slots: slots.length,
    });
  } catch (err) {
    console.error("[GET /api/public/availability] error:", err);
    return NextResponse.json(
      { error: "Failed to compute availability" },
      { status: 500 }
    );
  }
});
