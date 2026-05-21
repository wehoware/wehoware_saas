/**
 * /api/v1/transactions/[id]
 *
 * GET    — fetch a single transaction
 * PUT    — update transaction fields
 * DELETE — delete transaction
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import { parseDateInput } from "@/lib/accounting";

const VALID_TYPES = ["Subscription", "Service", "Refund", "Payout", "Sale", "Other"];
const VALID_STATUSES = ["Pending", "Completed", "Failed", "Refunded"];
const MAX_DESCRIPTION_LENGTH = 500;

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function serializeTransaction(t) {
  return {
    id: t.id,
    client_id: t.clientId,
    transaction_date: t.transactionDate,
    description: t.description,
    amount: t.amount,
    type: t.type,
    status: t.status,
    reference: t.reference,
    currency: t.currency,
    notes: t.notes,
    invoice_id: t.invoiceId,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    created_by: t.createdBy,
  };
}

// -------------------------------------------------------------------
// GET — single transaction
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

      const transaction = await prisma.wehowareTransaction.findFirst({
        where: { id, clientId },
      });

      if (!transaction) {
        return NextResponse.json(
          { error: "Transaction not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(serializeTransaction(transaction));
    } catch (err) {
      console.error("[GET /api/v1/transactions/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch transaction" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PUT — update transaction
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

      const existing = await prisma.wehowareTransaction.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Transaction not found" },
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

      if (body.transaction_date !== undefined) {
        const parsed = parseDateInput(body.transaction_date);
        if (!parsed) {
          return NextResponse.json(
            { error: "transaction_date is invalid" },
            { status: 400 }
          );
        }
        data.transactionDate = parsed;
      }
      if (body.description !== undefined) {
        const desc =
          typeof body.description === "string" ? body.description.trim() : "";
        if (!desc) {
          return NextResponse.json(
            { error: "description cannot be empty" },
            { status: 400 }
          );
        }
        if (desc.length > MAX_DESCRIPTION_LENGTH) {
          return NextResponse.json(
            { error: `description must be <= ${MAX_DESCRIPTION_LENGTH} characters` },
            { status: 400 }
          );
        }
        data.description = desc;
      }
      if (body.amount !== undefined) {
        const amountNum = Number(body.amount);
        if (!Number.isFinite(amountNum)) {
          return NextResponse.json(
            { error: "amount must be a number" },
            { status: 400 }
          );
        }
        data.amount = amountNum;
      }
      if (body.reference !== undefined) data.reference = body.reference;
      if (body.currency !== undefined) data.currency = body.currency;
      if (body.notes !== undefined) data.notes = body.notes;

      if (body.type !== undefined) {
        if (!VALID_TYPES.includes(body.type)) {
          return NextResponse.json(
            {
              error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
            },
            { status: 400 }
          );
        }
        data.type = body.type;
      }

      if (body.status !== undefined) {
        if (!VALID_STATUSES.includes(body.status)) {
          return NextResponse.json(
            {
              error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
            },
            { status: 400 }
          );
        }
        data.status = body.status;
      }

      if (body.invoice_id !== undefined) {
        if (body.invoice_id) {
          const invoiceExists = await prisma.wehowareInvoice.findFirst({
            where: { id: body.invoice_id, clientId },
            select: { id: true },
          });
          if (!invoiceExists) {
            return NextResponse.json(
              { error: "invoice_id not found for this client" },
              { status: 400 }
            );
          }
        }
        data.invoiceId = body.invoice_id ?? null;
      }

      if (Object.keys(data).length === 1) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      const transaction = await prisma.wehowareTransaction.update({
        where: { id },
        data,
      });

      return NextResponse.json(serializeTransaction(transaction));
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      console.error("[PUT /api/v1/transactions/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to update transaction" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);

// -------------------------------------------------------------------
// DELETE — remove transaction
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

      const existing = await prisma.wehowareTransaction.findFirst({
        where: { id, clientId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Transaction not found" },
          { status: 404 }
        );
      }

      await prisma.wehowareTransaction.delete({ where: { id } });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/transactions/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to delete transaction" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
