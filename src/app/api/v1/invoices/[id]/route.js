/**
 * /api/v1/invoices/[id]
 *
 * GET    — fetch a single invoice with line items
 * PUT    — update invoice fields; if line_items supplied, replace all existing
 * DELETE — delete invoice (and cascaded line items)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function serializeLineItem(li) {
  return {
    id: li.id,
    description: li.description,
    quantity: li.quantity,
    unit_price: li.unitPrice,
    total: li.total,
    sort_order: li.sortOrder,
  };
}

function serializeInvoice(inv) {
  return {
    id: inv.id,
    client_id: inv.clientId,
    invoice_number: inv.invoiceNumber,
    client_name: inv.clientName,
    client_email: inv.clientEmail,
    invoice_date: inv.invoiceDate,
    due_date: inv.dueDate,
    status: inv.status,
    subtotal: inv.subtotal,
    tax_rate: inv.taxRate,
    tax_amount: inv.taxAmount,
    total: inv.total,
    currency: inv.currency,
    notes: inv.notes,
    paid_at: inv.paidAt,
    created_at: inv.createdAt,
    updated_at: inv.updatedAt,
    created_by: inv.createdBy,
    updated_by: inv.updatedBy,
    line_items: Array.isArray(inv.lineItems)
      ? inv.lineItems.map(serializeLineItem)
      : [],
  };
}

function computeTotals(lineItems, taxRate) {
  const subtotal = lineItems.reduce((sum, li) => {
    return sum + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0);
  }, 0);
  const taxAmount = subtotal * (Number(taxRate) || 0) / 100;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

function buildLineItemData(lineItems, invoiceId, clientId) {
  return lineItems.map((li, idx) => {
    const qty = Number(li.quantity) || 1;
    const unitPrice = Number(li.unit_price) || 0;
    return {
      invoiceId,
      clientId,
      description: li.description ?? "",
      quantity: qty,
      unitPrice,
      total: qty * unitPrice,
      sortOrder: idx,
    };
  });
}

// -------------------------------------------------------------------
// GET — single invoice
// -------------------------------------------------------------------
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

      const invoice = await prisma.wehowareInvoice.findFirst({
        where: { id, clientId },
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
      });

      if (!invoice) {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(serializeInvoice(invoice));
    } catch (err) {
      console.error("[GET /api/v1/invoices/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch invoice" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PUT — update invoice
// -------------------------------------------------------------------
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

      const existing = await prisma.wehowareInvoice.findFirst({
        where: { id, clientId },
        select: { id: true, taxRate: true, subtotal: true, taxAmount: true, total: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Invoice not found" },
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

      if (body.client_name !== undefined) data.clientName = body.client_name;
      if (body.client_email !== undefined) data.clientEmail = body.client_email;
      if (body.invoice_date !== undefined) {
        data.invoiceDate = body.invoice_date ? new Date(body.invoice_date) : null;
      }
      if (body.due_date !== undefined) {
        data.dueDate = body.due_date ? new Date(body.due_date) : null;
      }
      if (body.status !== undefined) data.status = body.status;
      if (body.currency !== undefined) data.currency = body.currency;
      if (body.notes !== undefined) data.notes = body.notes;
      if (body.paid_at !== undefined) {
        data.paidAt = body.paid_at ? new Date(body.paid_at) : null;
      }

      const hasLineItems = Array.isArray(body.line_items);
      const rawLineItems = hasLineItems ? body.line_items : [];

      // Recompute totals if line_items or tax_rate are provided
      if (hasLineItems || body.tax_rate !== undefined) {
        const taxRate =
          body.tax_rate !== undefined
            ? Number(body.tax_rate)
            : existing.taxRate;
        const itemsForCalc = hasLineItems ? rawLineItems : [];

        if (hasLineItems) {
          const { subtotal, taxAmount, total } = computeTotals(
            itemsForCalc,
            taxRate
          );
          data.taxRate = taxRate;
          data.subtotal = subtotal;
          data.taxAmount = taxAmount;
          data.total = total;
        } else {
          // Only tax_rate changed — recalculate from existing subtotal
          data.taxRate = taxRate;
          data.taxAmount = existing.subtotal * taxRate / 100;
          data.total = existing.subtotal + data.taxAmount;
        }
      } else if (body.tax_rate !== undefined) {
        data.taxRate = Number(body.tax_rate);
      }

      if (Object.keys(data).length === 1) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      const invoice = await prisma.$transaction(async (tx) => {
        if (hasLineItems) {
          // Delete all existing line items and recreate
          await tx.wehowareInvoiceLineItem.deleteMany({
            where: { invoiceId: id },
          });

          if (rawLineItems.length > 0) {
            await tx.wehowareInvoiceLineItem.createMany({
              data: buildLineItemData(rawLineItems, id, clientId),
            });
          }
        }

        await tx.wehowareInvoice.update({ where: { id }, data });

        return tx.wehowareInvoice.findUnique({
          where: { id },
          include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        });
      });

      return NextResponse.json(serializeInvoice(invoice));
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      console.error("[PUT /api/v1/invoices/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to update invoice" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);

// -------------------------------------------------------------------
// DELETE — remove invoice
// -------------------------------------------------------------------
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

      const existing = await prisma.wehowareInvoice.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        );
      }

      // Delete line items first (in case no DB-level cascade is configured)
      await prisma.$transaction([
        prisma.wehowareInvoiceLineItem.deleteMany({ where: { invoiceId: id } }),
        prisma.wehowareInvoice.delete({ where: { id } }),
      ]);

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/invoices/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to delete invoice" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
