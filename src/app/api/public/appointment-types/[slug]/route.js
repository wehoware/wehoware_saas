/**
 * GET /api/public/appointment-types/[slug]
 *
 * Fetch a single active appointment type by slug for a client.
 * Returns full details including booking configuration.
 *
 * Usage:
 *   GET /api/public/appointment-types/30min-consult?domain=example.com
 *   GET /api/public/appointment-types/30min-consult?clientId=uuid-here
 *   GET /api/public/appointment-types/30min-consult?client_slug=acme-corp
 */
import { NextResponse } from "next/server";
import { withPublic } from "../../utils/public-middleware";
import { prisma } from "@/lib/prisma";

function serializeTypeDetail(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    duration: row.duration,
    color: row.color ?? null,
    slug: row.slug ?? null,
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    price_label:
      row.price === null || row.price === undefined || Number(row.price) === 0
        ? "Free"
        : null,
    currency: row.currency ?? null,
    requires_confirmation: row.requiresConfirmation,
    active: row.active,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    // Include the booking URL pattern for client-side widget rendering
    booking_url: row.slug
      ? `/api/public/appointments?client_slug=${row.clientId}`
      : null,
    // Include appointment count for this type (optional context)
    appointments_count: row.appointments?.length ?? 0,
  };
}

export const GET = withPublic(async (request, { params }) => {
  try {
    const { client } = request;
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

    const appointmentType = await prisma.wehowareAppointmentType.findFirst({
      where: {
        clientId: client.id,
        slug,
        active: true,
      },
      include: {
        appointments: {
          where: {
            status: { notIn: ["Cancelled"] },
            scheduledAt: { gte: new Date() },
          },
          select: { id: true },
        },
      },
    });

    if (!appointmentType) {
      return NextResponse.json(
        { error: "Appointment type not found or inactive" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.companyName,
        slug: client.publicSlug,
        domain: client.domain ?? null,
      },
      appointment_type: serializeTypeDetail(appointmentType),
    });
  } catch (err) {
    console.error("[GET /api/public/appointment-types/[slug]] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch appointment type" },
      { status: 500 }
    );
  }
});
