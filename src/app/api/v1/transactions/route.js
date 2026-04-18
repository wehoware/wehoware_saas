/**
 * /api/v1/transactions
 *
 * GET  — list transactions for the resolved client (paginated, filterable, sortable)
 * POST — create a new transaction
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const VALID_SORT_FIELDS = {
  transactionDate: "transactionDate",
  amount: "amount",
  type: "type",
  status: "status",
  createdAt: "createdAt",
};

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
// GET — list transactions
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
      const page = Math.max(
        1,
        parseInt(url.searchParams.get("page") || "1", 10)
      );
      const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(
          1,
          parseInt(
            url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE),
            10
          )
        )
      );

      const typeParam = url.searchParams.get("type") || "";
      const statusParam = url.searchParams.get("status") || "";
      const rawSortBy = url.searchParams.get("sortBy") || "transactionDate";
      const sortBy = VALID_SORT_FIELDS[rawSortBy] ?? "transactionDate";
      const sortOrder =
        url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

      const where = { clientId };
      if (typeParam && VALID_TYPES.includes(typeParam)) where.type = typeParam;
      if (statusParam && VALID_STATUSES.includes(statusParam))
        where.status = statusParam;

      const [items, totalItems] = await Promise.all([
        prisma.wehowareTransaction.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareTransaction.count({ where }),
      ]);

      return NextResponse.json({
        data: items.map(serializeTransaction),
        pagination: {
          totalItems,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/transactions] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// POST — create transaction
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

      // Required fields
      const transactionDate = body?.transaction_date;
      const amount = body?.amount;
      const type = body?.type;

      if (!transactionDate) {
        return NextResponse.json(
          { error: "transaction_date is required" },
          { status: 400 }
        );
      }
      if (amount === undefined || amount === null) {
        return NextResponse.json(
          { error: "amount is required" },
          { status: 400 }
        );
      }
      if (!type) {
        return NextResponse.json(
          { error: "type is required" },
          { status: 400 }
        );
      }
      if (!VALID_TYPES.includes(type)) {
        return NextResponse.json(
          {
            error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
          },
          { status: 400 }
        );
      }

      const status = body.status ?? "Pending";
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          {
            error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Validate invoiceId belongs to the same client if provided
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

      const transaction = await prisma.wehowareTransaction.create({
        data: {
          clientId,
          transactionDate: new Date(transactionDate),
          description: body.description ?? null,
          amount: Number(amount),
          type,
          status,
          reference: body.reference ?? null,
          currency: body.currency ?? "CAD",
          notes: body.notes ?? null,
          invoiceId: body.invoice_id ?? null,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      return NextResponse.json(serializeTransaction(transaction), {
        status: 201,
      });
    } catch (err) {
      console.error("[POST /api/v1/transactions] error:", err);
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid invoice_id reference" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create transaction" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["employee", "admin"] }
);
