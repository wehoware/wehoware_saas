/**
 * GET /api/public/availability
 *
 * Returns free time slots for a given client + appointment type across a date range.
 * No authentication required. Rate-limited and CORS-enabled.
 *
 * The appointment type can be specified by either:
 *   - appointment_type_slug=30min-consult  (preferred for public widgets)
 *   - appointment_type_id=uuid             (alternative)
 *
 * Usage:
 *   GET /api/public/availability?domain=example.com&appointment_type_slug=30min&from=2026-05-01&to=2026-05-07
 *   GET /api/public/availability?clientId=uuid&appointment_type_id=uuid&from=2026-05-01&to=2026-05-07
 *   GET /api/public/availability?client_slug=acme&appointment_type_slug=30min&from=2026-05-01&to=2026-05-07
 */
import { NextResponse } from "next/server";
import { withPublic } from "../utils/public-middleware";
import { getFreeSlots } from "@/lib/availability";
import { prisma } from "@/lib/prisma";

const MAX_RANGE_DAYS = 90; // cap to prevent abuse

export const GET = withPublic(async (request) => {
  try {
    const { client } = request;
    const url = new URL(request.url);

    const typeSlug = url.searchParams.get("appointment_type_slug")?.trim();
    const typeId = url.searchParams.get("appointment_type_id")?.trim();
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const timezone = url.searchParams.get("timezone")?.trim() || "UTC";

    if (!fromParam || !toParam) {
      return NextResponse.json(
        { error: "Missing required params: from, to" },
        { status: 400 }
      );
    }

    if (!typeSlug && !typeId) {
      return NextResponse.json(
        {
          error:
            "Missing required param: appointment_type_slug or appointment_type_id",
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

    // Cap the range to prevent excessive computation
    const rangeMs = toDate.getTime() - fromDate.getTime();
    if (rangeMs > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days.` },
        { status: 400 }
      );
    }

    // Resolve appointment type by slug or id
    const typeWhere = { clientId: client.id, active: true };
    if (typeSlug) {
      typeWhere.slug = typeSlug;
    } else {
      typeWhere.id = typeId;
    }

    const appointmentType = await prisma.wehowareAppointmentType.findFirst({
      where: typeWhere,
      select: {
        id: true,
        name: true,
        duration: true,
        color: true,
        slug: true,
        requiresConfirmation: true,
      },
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
        domain: client.domain ?? null,
      },
      appointment_type: {
        id: appointmentType.id,
        name: appointmentType.name,
        slug: appointmentType.slug,
        duration: appointmentType.duration,
        color: appointmentType.color ?? null,
        requires_confirmation: appointmentType.requiresConfirmation,
      },
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        timezone,
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
