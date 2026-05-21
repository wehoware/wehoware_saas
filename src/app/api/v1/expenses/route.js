/**
 * /api/v1/expenses
 *
 * GET  — list expenses for the active client (paginated, filterable)
 * POST — create a new expense (always status=Pending unless caller is admin)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";
import {
  parseDateInput,
  EXPENSE_CATEGORY_DB_TO_LABEL,
  EXPENSE_CATEGORY_LABEL_TO_DB,
  EXPENSE_STATUSES,
} from "@/lib/accounting";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const VALID_SORT_FIELDS = {
  expenseDate: "expenseDate",
  amount: "amount",
  status: "status",
  createdAt: "createdAt",
};

const VALID_STATUSES = new Set(EXPENSE_STATUSES);

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function serializeExpense(e) {
  return {
    id: e.id,
    client_id: e.clientId,
    submitted_by: e.submittedBy,
    submitter: e.submitter
      ? {
          id: e.submitter.id,
          email: e.submitter.email,
          first_name: e.submitter.firstName,
          last_name: e.submitter.lastName,
        }
      : null,
    description: e.description,
    category: EXPENSE_CATEGORY_DB_TO_LABEL[e.category] ?? e.category,
    amount: e.amount,
    tax_amount: e.taxAmount,
    currency: e.currency,
    expense_date: e.expenseDate,
    receipt_url: e.receiptUrl,
    status: e.status,
    approved_by: e.approvedBy,
    approver: e.approver
      ? {
          id: e.approver.id,
          email: e.approver.email,
          first_name: e.approver.firstName,
          last_name: e.approver.lastName,
        }
      : null,
    approved_at: e.approvedAt,
    rejected_reason: e.rejectedReason,
    reimbursed_at: e.reimbursedAt,
    notes: e.notes,
    bill_id: e.billId,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

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
      const status = url.searchParams.get("status") || "";
      const categoryLabel = url.searchParams.get("category") || "";
      const submittedBy = url.searchParams.get("submitted_by") || "";
      const rawSortBy = url.searchParams.get("sortBy") || "expenseDate";
      const sortBy = VALID_SORT_FIELDS[rawSortBy] ?? "expenseDate";
      const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

      const where = { clientId };
      if (status && VALID_STATUSES.has(status)) where.status = status;
      if (categoryLabel && EXPENSE_CATEGORY_LABEL_TO_DB[categoryLabel]) {
        where.category = EXPENSE_CATEGORY_LABEL_TO_DB[categoryLabel];
      }
      if (submittedBy) where.submittedBy = submittedBy;

      // Employees can only see their own expenses unless they're admin.
      if (user.role === "employee") where.submittedBy = user.id;

      const [items, totalItems] = await Promise.all([
        prisma.wehowareExpense.findMany({
          where,
          include: {
            submitter: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
            approver: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareExpense.count({ where }),
      ]);

      return NextResponse.json({
        data: items.map(serializeExpense),
        pagination: {
          totalItems,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/expenses] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch expenses" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);

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

      const description =
        typeof body.description === "string" ? body.description.trim() : "";
      if (!description) {
        return NextResponse.json(
          { error: "description is required" },
          { status: 400 }
        );
      }
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "amount must be a positive number" },
          { status: 400 }
        );
      }
      const expenseDate = parseDateInput(body.expense_date);
      if (!expenseDate) {
        return NextResponse.json(
          { error: "expense_date is required" },
          { status: 400 }
        );
      }
      const categoryLabel = body.category ?? "Other";
      const categoryDb = EXPENSE_CATEGORY_LABEL_TO_DB[categoryLabel];
      if (!categoryDb) {
        return NextResponse.json(
          { error: "Invalid category" },
          { status: 400 }
        );
      }

      const expense = await prisma.wehowareExpense.create({
        data: {
          clientId,
          submittedBy: user.id,
          description,
          category: categoryDb,
          amount,
          taxAmount: Number(body.tax_amount) || 0,
          currency: body.currency ?? "CAD",
          expenseDate,
          receiptUrl: body.receipt_url ?? null,
          status: "Pending",
          notes: body.notes ?? null,
        },
        include: {
          submitter: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          approver: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });

      return NextResponse.json(serializeExpense(expense), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/expenses] error:", err);
      return NextResponse.json(
        { error: "Failed to create expense" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);
