/**
 * /api/v1/clients
 *
 * Prisma/MySQL-backed replacement for the old Supabase handler.
 *
 * GET  — list clients (clients see only their own; employees/admins see all)
 * POST — create a new client (employee/admin)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

/**
 * Reshape a Prisma client row into the snake_case payload legacy UI expects.
 */
function serializeClient(c) {
  return {
    id: c.id,
    company_name: c.companyName,
    contact_person: c.contactPerson,
    contact_number: c.contactNumber,
    email: c.email,
    address: c.address,
    website: c.website,
    industry: c.industry,
    domain: c.domain,
    public_slug: c.publicSlug,
    active: c.active,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    // Include camelCase fields too so newer UI code doesn't need to translate
    companyName: c.companyName,
    contactPerson: c.contactPerson,
    contactNumber: c.contactNumber,
  };
}

// -------------------------------------------------------------------
// GET — list clients
// -------------------------------------------------------------------
async function getClients(request) {
  try {
    const { prisma, user } = request;
    const url = new URL(request.url);
    const sortField = url.searchParams.get("sort_field") || "companyName";
    const sortOrder = url.searchParams.get("sort_order") || "asc";

    if (user.role === "client") {
      if (!user.clientId) {
        return NextResponse.json(
          { error: "Client association not found" },
          { status: 403 }
        );
      }
      const client = await prisma.wehowareClient.findUnique({
        where: { id: user.clientId },
      });
      return NextResponse.json({
        clients: client ? [serializeClient(client)] : [],
      });
    }

    if (["employee", "admin"].includes(user.role)) {
      const orderByField = {
        companyName: "companyName",
        contactPerson: "contactPerson",
        email: "email",
        domain: "domain",
        created_at: "createdAt",
      }[sortField] || "companyName";

      const clients = await prisma.wehowareClient.findMany({
        orderBy: { [orderByField]: sortOrder === "asc" ? "asc" : "desc" },
      });
      return NextResponse.json({
        clients: clients.map(serializeClient),
      });
    }

    return NextResponse.json(
      { error: "Invalid user role for this operation" },
      { status: 403 }
    );
  } catch (err) {
    console.error("[GET /api/v1/clients] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

// -------------------------------------------------------------------
// POST — create a client
// -------------------------------------------------------------------
async function createClient(request) {
  try {
    const { prisma } = request;
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const companyName = body.company_name ?? body.companyName;
    if (!companyName || typeof companyName !== "string") {
      return NextResponse.json(
        { error: "company_name is required" },
        { status: 400 }
      );
    }

    const client = await prisma.wehowareClient.create({
      data: {
        companyName,
        contactPerson: body.contact_person ?? body.contactPerson ?? null,
        contactNumber: body.contact_number ?? body.contactNumber ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        website: body.website ?? null,
        industry: body.industry ?? null,
        domain: body.domain ?? null,
        publicSlug: body.public_slug ?? body.publicSlug ?? null,
        active: body.active ?? true,
      },
    });

    return NextResponse.json({ client: serializeClient(client) }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/v1/clients] error:", err);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getClients, {
  allowedRoles: ["client", "employee", "admin"],
});
export const POST = withAuth(createClient, {
  allowedRoles: ["employee", "admin"],
});
