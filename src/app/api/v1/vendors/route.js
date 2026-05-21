/**
 * /api/v1/vendors
 *
 * GET  — list vendors for the resolved client (paginated, searchable)
 * POST — create a new vendor
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_NAME_LENGTH = 255;

const VALID_SORT_FIELDS = {
  name: "name",
  createdAt: "createdAt",
};

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function serializeVendor(v) {
  return {
    id: v.id,
    client_id: v.clientId,
    name: v.name,
    contact_person: v.contactPerson,
    email: v.email,
    phone: v.phone,
    address: v.address,
    tax_number: v.taxNumber,
    website: v.website,
    notes: v.notes,
    active: v.active,
    created_at: v.createdAt,
    updated_at: v.updatedAt,
    created_by: v.createdBy,
    updated_by: v.updatedBy,
  };
}

// -------------------------------------------------------------------
// GET — list vendors
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const url = new URL(request.url);
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(
          1,
          parseInt(url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10)
        )
      );
      const search = (url.searchParams.get("search") || "").trim();
      const activeParam = url.searchParams.get("active");
      const rawSortBy = url.searchParams.get("sortBy") || "name";
      const sortBy = VALID_SORT_FIELDS[rawSortBy] ?? "name";
      const sortOrder = url.searchParams.get("sortOrder") === "desc" ? "desc" : "asc";

      const where = { clientId };
      if (activeParam === "true") where.active = true;
      else if (activeParam === "false") where.active = false;
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
          { contactPerson: { contains: search } },
        ];
      }

      const [items, totalItems] = await Promise.all([
        prisma.wehowareVendor.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareVendor.count({ where }),
      ]);

      return NextResponse.json({
        data: items.map(serializeVendor),
        pagination: {
          totalItems,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/vendors] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch vendors" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin"] }
);

// -------------------------------------------------------------------
// POST — create vendor
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }

      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return NextResponse.json(
          { error: "name is required" },
          { status: 400 }
        );
      }
      if (name.length > MAX_NAME_LENGTH) {
        return NextResponse.json(
          { error: `name must be <= ${MAX_NAME_LENGTH} characters` },
          { status: 400 }
        );
      }

      const vendor = await prisma.wehowareVendor.create({
        data: {
          clientId,
          name,
          contactPerson: body.contact_person ?? null,
          email: body.email ?? null,
          phone: body.phone ?? null,
          address: body.address ?? null,
          taxNumber: body.tax_number ?? null,
          website: body.website ?? null,
          notes: body.notes ?? null,
          active: body.active !== false,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      return NextResponse.json(serializeVendor(vendor), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/vendors] error:", err);
      return NextResponse.json(
        { error: "Failed to create vendor" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin"] }
);
