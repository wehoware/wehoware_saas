/**
 * /api/v1/customers
 *
 * GET  — list customers for the resolved client (paginated, searchable)
 * POST — create a new customer
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

function serializeCustomer(c) {
  return {
    id: c.id,
    client_id: c.clientId,
    name: c.name,
    contact_person: c.contactPerson,
    email: c.email,
    phone: c.phone,
    billing_address: c.billingAddress,
    shipping_address: c.shippingAddress,
    tax_number: c.taxNumber,
    website: c.website,
    payment_terms: c.paymentTerms,
    currency: c.currency,
    notes: c.notes,
    active: c.active,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    created_by: c.createdBy,
    updated_by: c.updatedBy,
  };
}

// -------------------------------------------------------------------
// GET — list customers
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
          { phone: { contains: search } },
        ];
      }

      const [items, totalItems] = await Promise.all([
        prisma.wehowareCustomer.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareCustomer.count({ where }),
      ]);

      return NextResponse.json({
        data: items.map(serializeCustomer),
        pagination: {
          totalItems,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/customers] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch customers" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin"], allowedClientRoles: ["client"] }
);

// -------------------------------------------------------------------
// POST — create customer
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

      const customer = await prisma.wehowareCustomer.create({
        data: {
          clientId,
          name,
          contactPerson: body.contact_person ?? null,
          email: body.email ?? null,
          phone: body.phone ?? null,
          billingAddress: body.billing_address ?? null,
          shippingAddress: body.shipping_address ?? null,
          taxNumber: body.tax_number ?? null,
          website: body.website ?? null,
          paymentTerms: body.payment_terms ?? null,
          currency: body.currency ?? null,
          notes: body.notes ?? null,
          active: body.active !== false,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      return NextResponse.json(serializeCustomer(customer), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/customers] error:", err);
      return NextResponse.json(
        { error: "Failed to create customer" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin"], allowedClientRoles: ["client"] }
);
