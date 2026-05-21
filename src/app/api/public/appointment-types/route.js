/**
 * GET /api/public/appointment-types?client_slug=acme-corp
 *
 * Returns active appointment types for a client's public booking page.
 * No authentication required. Rate-limited and CORS-enabled.
 */
import { NextResponse } from "next/server";
import { withPublic } from "../utils/public-middleware";
import { prisma } from "@/lib/prisma";

function serializeType(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    duration: row.duration,
    color: row.color ?? null,
    slug: row.slug ?? null,
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    currency: row.currency,
    requires_confirmation: row.requiresConfirmation,
  };
}

export const GET = withPublic(async (request) => {
  try {
    const { client } = request;

    const types = await prisma.wehowareAppointmentType.findMany({
      where: { clientId: client.id, active: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.companyName,
        slug: client.publicSlug,
      },
      appointment_types: types.map(serializeType),
    });
  } catch (err) {
    console.error("[GET /api/public/appointment-types] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch appointment types" },
      { status: 500 }
    );
  }
});
