/**
 * /api/v1/customers/[id]
 *
 * GET    — fetch a single customer
 * PUT    — update customer fields
 * DELETE — soft-delete (set active=false) if customer has invoices, else hard-delete
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
      const customer = await prisma.wehowareCustomer.findFirst({
        where: { id, clientId },
      });
      if (!customer) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(serializeCustomer(customer));
    } catch (err) {
      console.error("[GET /api/v1/customers/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch customer" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin"] }
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

      const existing = await prisma.wehowareCustomer.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Customer not found" },
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
      if (body.billing_address !== undefined) data.billingAddress = body.billing_address;
      if (body.shipping_address !== undefined) data.shippingAddress = body.shipping_address;
      if (body.tax_number !== undefined) data.taxNumber = body.tax_number;
      if (body.website !== undefined) data.website = body.website;
      if (body.payment_terms !== undefined) data.paymentTerms = body.payment_terms;
      if (body.currency !== undefined) data.currency = body.currency;
      if (body.notes !== undefined) data.notes = body.notes;
      if (body.active !== undefined) data.active = Boolean(body.active);

      if (Object.keys(data).length === 1) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      const customer = await prisma.wehowareCustomer.update({
        where: { id },
        data,
      });

      return NextResponse.json(serializeCustomer(customer));
    } catch (err) {
      console.error("[PUT /api/v1/customers/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to update customer" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin"] }
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

      const existing = await prisma.wehowareCustomer.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }

      // If the customer has invoices attached, archive instead of hard-deleting
      // to preserve referential integrity and historical data.
      const invoiceCount = await prisma.wehowareInvoice.count({
        where: { customerId: id },
      });
      if (invoiceCount > 0) {
        const archived = await prisma.wehowareCustomer.update({
          where: { id },
          data: { active: false, updatedBy: user.id },
        });
        return NextResponse.json({
          success: true,
          archived: true,
          customer: serializeCustomer(archived),
          message: "Customer archived because it has linked invoices",
        });
      }

      await prisma.wehowareCustomer.delete({ where: { id } });
      return NextResponse.json({ success: true, archived: false });
    } catch (err) {
      console.error("[DELETE /api/v1/customers/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to delete customer" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "admin"] }
);
