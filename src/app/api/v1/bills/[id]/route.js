/**
 * /api/v1/bills/[id]
 *
 * GET    — fetch a single bill (with vendor + line items + payments)
 * PUT    — update bill fields (and replace line items if provided)
 * DELETE — delete bill (and cascading line items + payments)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import {
  computeLineItemTotals,
  buildLineItemRows,
  parseDateInput,
  deriveBillStatus,
  BILL_STATUS_DB_TO_LABEL,
  BILL_STATUS_LABEL_TO_DB,
} from "@/lib/accounting";

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

function serializePayment(p) {
  return {
    id: p.id,
    payment_date: p.paymentDate,
    amount: p.amount,
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    bank_account_id: p.bankAccountId,
    created_at: p.createdAt,
    created_by: p.createdBy,
  };
}

function serializeBill(b) {
  return {
    id: b.id,
    client_id: b.clientId,
    vendor_id: b.vendorId,
    vendor: b.vendor
      ? { id: b.vendor.id, name: b.vendor.name, email: b.vendor.email }
      : null,
    bill_number: b.billNumber,
    reference: b.reference,
    bill_date: b.billDate,
    due_date: b.dueDate,
    status: BILL_STATUS_DB_TO_LABEL[b.status] ?? b.status,
    subtotal: b.subtotal,
    tax_rate: b.taxRate,
    tax_amount: b.taxAmount,
    total: b.total,
    amount_paid: b.amountPaid,
    amount_due: Number(b.total) - Number(b.amountPaid),
    currency: b.currency,
    notes: b.notes,
    paid_at: b.paidAt,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
    created_by: b.createdBy,
    updated_by: b.updatedBy,
    line_items: Array.isArray(b.lineItems) ? b.lineItems.map(serializeLineItem) : [],
    payments: Array.isArray(b.payments) ? b.payments.map(serializePayment) : [],
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

      const bill = await prisma.wehowareBill.findFirst({
        where: { id, clientId },
        include: {
          vendor: { select: { id: true, name: true, email: true } },
          lineItems: { orderBy: { sortOrder: "asc" } },
          payments: { orderBy: { paymentDate: "desc" } },
        },
      });
      if (!bill) {
        return NextResponse.json(
          { error: "Bill not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(serializeBill(bill));
    } catch (err) {
      console.error("[GET /api/v1/bills/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch bill" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
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

      const existing = await prisma.wehowareBill.findFirst({
        where: { id, clientId },
        select: {
          id: true,
          status: true,
          dueDate: true,
          amountPaid: true,
        },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Bill not found" },
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

      if (body.vendor_id !== undefined) {
        const vendor = await prisma.wehowareVendor.findFirst({
          where: { id: body.vendor_id, clientId },
          select: { id: true },
        });
        if (!vendor) {
          return NextResponse.json(
            { error: "vendor_id not found for this client" },
            { status: 400 }
          );
        }
        data.vendorId = body.vendor_id;
      }
      if (body.bill_number !== undefined) {
        const trimmed = String(body.bill_number).trim();
        if (!trimmed) {
          return NextResponse.json(
            { error: "bill_number cannot be empty" },
            { status: 400 }
          );
        }
        data.billNumber = trimmed;
      }
      if (body.reference !== undefined) data.reference = body.reference;
      if (body.bill_date !== undefined) {
        const d = parseDateInput(body.bill_date);
        if (!d) {
          return NextResponse.json(
            { error: "bill_date is invalid" },
            { status: 400 }
          );
        }
        data.billDate = d;
      }
      if (body.due_date !== undefined) {
        const d = parseDateInput(body.due_date);
        if (!d) {
          return NextResponse.json(
            { error: "due_date is invalid" },
            { status: 400 }
          );
        }
        data.dueDate = d;
      }
      if (body.currency !== undefined) data.currency = body.currency;
      if (body.notes !== undefined) data.notes = body.notes;
      if (body.status !== undefined) {
        const mapped = BILL_STATUS_LABEL_TO_DB[body.status];
        if (!mapped) {
          return NextResponse.json(
            { error: "status is invalid" },
            { status: 400 }
          );
        }
        data.status = mapped;
      }

      // If line items or tax_rate are provided we recompute totals.
      const newLineItems = Array.isArray(body.line_items) ? body.line_items : null;
      const newTaxRate =
        body.tax_rate !== undefined ? Number(body.tax_rate) : null;

      let itemsForTotals = null;
      if (newLineItems) {
        itemsForTotals = newLineItems;
      } else if (newTaxRate !== null) {
        // Only tax_rate changed — recompute against existing line items so
        // we don't zero-out the bill totals.
        const existingLines = await prisma.wehowareBillLineItem.findMany({
          where: { billId: id },
          orderBy: { sortOrder: "asc" },
        });
        itemsForTotals = existingLines.map((li) => ({
          description: li.description,
          quantity: Number(li.quantity),
          unit_price: Number(li.unitPrice),
        }));
      }
      if (itemsForTotals) {
        const taxRate = newTaxRate ?? 0;
        const totals = computeLineItemTotals(itemsForTotals, taxRate);
        data.subtotal = totals.subtotal;
        data.taxRate = taxRate;
        data.taxAmount = totals.taxAmount;
        data.total = totals.total;
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (newLineItems) {
          await tx.wehowareBillLineItem.deleteMany({ where: { billId: id } });
          if (newLineItems.length > 0) {
            await tx.wehowareBillLineItem.createMany({
              data: buildLineItemRows(newLineItems, id, "billId", clientId),
            });
          }
        }

        // Recompute status if total changed against amount_paid
        const currentBill = await tx.wehowareBill.findUnique({
          where: { id },
          select: { total: true, amountPaid: true, dueDate: true, status: true },
        });
        const tentativeStatus = data.status ?? currentBill.status;
        const totalForStatus = data.total ?? Number(currentBill.total);
        const isMutableStatus = !["Draft", "Void"].includes(tentativeStatus);
        const totalsOrDueChanged =
          data.total !== undefined || data.dueDate !== undefined;
        if (isMutableStatus && totalsOrDueChanged) {
          data.status = deriveBillStatus({
            total: totalForStatus,
            amountPaid: Number(currentBill.amountPaid),
            dueDate: data.dueDate ?? currentBill.dueDate,
            currentStatus: tentativeStatus,
          });
        }

        return tx.wehowareBill.update({
          where: { id },
          data,
          include: {
            vendor: { select: { id: true, name: true, email: true } },
            lineItems: { orderBy: { sortOrder: "asc" } },
            payments: { orderBy: { paymentDate: "desc" } },
          },
        });
      });

      return NextResponse.json(serializeBill(updated));
    } catch (err) {
      console.error("[PUT /api/v1/bills/[id]] error:", err);
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "Bill number already exists for this client" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update bill" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
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

      const existing = await prisma.wehowareBill.findFirst({
        where: { id, clientId },
        select: { id: true, amountPaid: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Bill not found" },
          { status: 404 }
        );
      }

      // Prevent deleting bills with recorded payments to preserve audit history.
      if (Number(existing.amountPaid) > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot delete a bill with recorded payments. Mark as Void instead.",
          },
          { status: 400 }
        );
      }

      await prisma.wehowareBill.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/bills/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to delete bill" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
