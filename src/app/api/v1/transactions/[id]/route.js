/**
 * /api/v1/transactions/[id]
 *
 * GET    — fetch a single transaction
 * PUT    — update transaction fields
 * DELETE — delete transaction
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

const VALID_TYPES = ["Subscription", "Service", "Refund", "Payout", "Sale", "Other"];
const VALID_STATUSES = ["Pending", "Completed", "Failed", "Refunded"];

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
        data.transactionDate = body.transaction_date
          ? new Date(body.transaction_date)
          : null;
      }
      if (body.description !== undefined) data.description = body.description;
      if (body.amount !== undefined) data.amount = Number(body.amount);
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
