/**
 * /api/v1/clients/[clientId]
 *
 * Prisma/MySQL-backed handlers for a single client record.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

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
    companyName: c.companyName,
    contactPerson: c.contactPerson,
    contactNumber: c.contactNumber,
  };
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
async function getClientById(request, { params }) {
  try {
    const { prisma } = request;
    const { clientId } = await params;

    const client = await prisma.wehowareClient.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({ client: serializeClient(client) });
  } catch (err) {
    console.error("[GET /api/v1/clients/[clientId]] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}

// -------------------------------------------------------------------
// PUT
// -------------------------------------------------------------------
async function updateClient(request, { params }) {
  try {
    const { prisma } = request;
    const { clientId } = await params;
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "No data provided" },
        { status: 400 }
      );
    }

    const existing = await prisma.wehowareClient.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Build update data; accept both snake_case and camelCase keys
    const data = {};
    const mapField = (out, snake, camel) => {
      if (body[snake] !== undefined) data[out] = body[snake];
      else if (body[camel] !== undefined) data[out] = body[camel];
    };
    mapField("companyName", "company_name", "companyName");
    mapField("contactPerson", "contact_person", "contactPerson");
    mapField("contactNumber", "contact_number", "contactNumber");
    if (body.email !== undefined) data.email = body.email;
    if (body.address !== undefined) data.address = body.address;
    if (body.website !== undefined) data.website = body.website;
    if (body.industry !== undefined) data.industry = body.industry;
    if (body.domain !== undefined) data.domain = body.domain;
    if (body.publicSlug !== undefined) data.publicSlug = body.publicSlug;
    else if (body.public_slug !== undefined) data.publicSlug = body.public_slug;
    if (body.active !== undefined) data.active = body.active;

    const client = await prisma.wehowareClient.update({
      where: { id: clientId },
      data,
    });

    return NextResponse.json({ client: serializeClient(client) });
  } catch (err) {
    console.error("[PUT /api/v1/clients/[clientId]] error:", err);
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    );
  }
}

// -------------------------------------------------------------------
// DELETE (admin only)
// -------------------------------------------------------------------
async function deleteClient(request, { params }) {
  try {
    const { prisma } = request;
    const { clientId } = await params;

    const existing = await prisma.wehowareClient.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    await prisma.wehowareClient.delete({ where: { id: clientId } });
    return NextResponse.json({
      success: true,
      message: "Client deleted successfully",
    });
  } catch (err) {
    console.error("[DELETE /api/v1/clients/[clientId]] error:", err);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getClientById, {
  allowedRoles: ["admin"],
});
export const PUT = withAuth(updateClient, {
  allowedRoles: ["admin"],
});
export const DELETE = withAuth(deleteClient, { allowedRoles: ["admin"] });
