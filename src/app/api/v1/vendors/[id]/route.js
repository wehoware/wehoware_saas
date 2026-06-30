/**
 * /api/v1/vendors/[id]
 *
 * GET    — fetch a single vendor
 * PUT    — update vendor fields
 * DELETE — soft-delete (set active=false) if vendor has bills, else hard-delete
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

const MAX_NAME_LENGTH = 255;

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

export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }
      const vendor = await prisma.wehowareVendor.findFirst({
        where: { id, clientId },
      });
      if (!vendor) {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(serializeVendor(vendor));
    } catch (err) {
      console.error("[GET /api/v1/vendors/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch vendor" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin"], allowedClientRoles: ["client"] }
);

export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const existing = await prisma.wehowareVendor.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 }
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

      const data = { updatedBy: user.id };
      if (body.name !== undefined) {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) {
          return NextResponse.json(
            { error: "name cannot be empty" },
            { status: 400 }
          );
        }
        if (name.length > MAX_NAME_LENGTH) {
          return NextResponse.json(
            { error: `name must be <= ${MAX_NAME_LENGTH} characters` },
            { status: 400 }
          );
        }
        data.name = name;
      }
      if (body.contact_person !== undefined) data.contactPerson = body.contact_person;
      if (body.email !== undefined) data.email = body.email;
      if (body.phone !== undefined) data.phone = body.phone;
      if (body.address !== undefined) data.address = body.address;
      if (body.tax_number !== undefined) data.taxNumber = body.tax_number;
      if (body.website !== undefined) data.website = body.website;
      if (body.notes !== undefined) data.notes = body.notes;
      if (body.active !== undefined) data.active = Boolean(body.active);

      if (Object.keys(data).length === 1) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      const vendor = await prisma.wehowareVendor.update({
        where: { id },
        data,
      });

      return NextResponse.json(serializeVendor(vendor));
    } catch (err) {
      console.error("[PUT /api/v1/vendors/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to update vendor" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin"], allowedClientRoles: ["client"] }
);

export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }

      const existing = await prisma.wehowareVendor.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 }
        );
      }

      // If the vendor has bills attached, archive instead of hard-deleting
      // to preserve referential integrity.
      const billCount = await prisma.wehowareBill.count({
        where: { vendorId: id },
      });
      if (billCount > 0) {
        const archived = await prisma.wehowareVendor.update({
          where: { id },
          data: { active: false, updatedBy: user.id },
        });
        return NextResponse.json({
          success: true,
          archived: true,
          vendor: serializeVendor(archived),
          message: "Vendor archived because it has linked bills",
        });
      }

      await prisma.wehowareVendor.delete({ where: { id } });
      return NextResponse.json({ success: true, archived: false });
    } catch (err) {
      console.error("[DELETE /api/v1/vendors/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to delete vendor" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
