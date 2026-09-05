/**
 * GET /api/public/appointment-types
 *
 * Public API endpoint for fetching active appointment types without authentication.
 * Scoped to a specific client via domain, clientId, or client_slug.
 * Only returns active types.
 *
 * Usage:
 *   GET /api/public/appointment-types?domain=example.com
 *   GET /api/public/appointment-types?clientId=uuid-here
 *   GET /api/public/appointment-types?client_slug=acme-corp
 *   GET /api/public/appointment-types?domain=example.com&search=consult&sortBy=duration&sortOrder=asc&page=1&limit=20
 */
import { NextResponse } from "next/server";
import { withPublic } from "../utils/public-middleware";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const SORTABLE_FIELDS = new Set([
  "created_at",
  "updated_at",
  "name",
  "duration",
  "price",
]);

const FIELD_MAP = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
  duration: "duration",
  price: "price",
};

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
    price_label: row.price === null || row.price === undefined || Number(row.price) === 0 ? "Free" : null,
    currency: row.currency ?? null,
    requires_confirmation: row.requiresConfirmation,
    active: row.active,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export const GET = withPublic(async (request) => {
  try {
    const { client } = request;
    const url = new URL(request.url);

    // Pagination
    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") || "1", 10)
    );
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        parseInt(
          url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE),
          10
        )
      )
    );

    // Filters
    const search = (url.searchParams.get("search") || "").trim();
    const requiresConfirmation = url.searchParams.get("requires_confirmation");

    // Sorting
    const sortByRaw = url.searchParams.get("sortBy") || "created_at";
    const sortOrder =
      url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const sortBy = SORTABLE_FIELDS.has(sortByRaw)
      ? FIELD_MAP[sortByRaw]
      : "createdAt";

    const where = { clientId: client.id, active: true };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (requiresConfirmation === "true") {
      where.requiresConfirmation = true;
    }

    const [items, totalItems] = await Promise.all([
      prisma.wehowareAppointmentType.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wehowareAppointmentType.count({ where }),
    ]);

    const data = items.map(serializeType);

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.companyName,
        slug: client.publicSlug,
        domain: client.domain ?? null,
      },
      data,
      pagination: {
        totalItems,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    });
  } catch (err) {
    console.error("[GET /api/public/appointment-types] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch appointment types" },
      { status: 500 }
    );
  }
});
