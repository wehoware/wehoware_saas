/**
 * /api/v1/expenses/[id]
 *
 * GET    — fetch a single expense
 * PUT    — update an expense (only the submitter can edit while Pending)
 * DELETE — delete a Pending expense (admins can delete any non-Reimbursed)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import {
  parseDateInput,
  EXPENSE_CATEGORY_DB_TO_LABEL,
  EXPENSE_CATEGORY_LABEL_TO_DB,
} from "@/lib/accounting";

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

const INCLUDE_RELATIONS = {
  submitter: { select: { id: true, email: true, firstName: true, lastName: true } },
  approver: { select: { id: true, email: true, firstName: true, lastName: true } },
};

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
      const expense = await prisma.wehowareExpense.findFirst({
        where: { id, clientId },
        include: INCLUDE_RELATIONS,
      });
      if (!expense) {
        return NextResponse.json(
          { error: "Expense not found" },
          { status: 404 }
        );
      }
      // Employees can only view their own expenses.
      if (user.role === "employee" && expense.submittedBy !== user.id) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
      return NextResponse.json(serializeExpense(expense));
    } catch (err) {
      console.error("[GET /api/v1/expenses/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch expense" },
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

      const existing = await prisma.wehowareExpense.findFirst({
        where: { id, clientId },
        select: { id: true, status: true, submittedBy: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Expense not found" },
          { status: 404 }
        );
      }

      // Only the submitter or an admin can edit, and only while Pending.
      const isAdmin = user.role === "admin";
      const isOwner = existing.submittedBy === user.id;
      if (!isAdmin && !isOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (existing.status !== "Pending" && !isAdmin) {
        return NextResponse.json(
          { error: "Only Pending expenses can be edited" },
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

      const data = {};
      if (body.description !== undefined) {
        const desc = String(body.description).trim();
        if (!desc) {
          return NextResponse.json(
            { error: "description cannot be empty" },
            { status: 400 }
          );
        }
        data.description = desc;
      }
      if (body.category !== undefined) {
        const mapped = EXPENSE_CATEGORY_LABEL_TO_DB[body.category];
        if (!mapped) {
          return NextResponse.json(
            { error: "Invalid category" },
            { status: 400 }
          );
        }
        data.category = mapped;
      }
      if (body.amount !== undefined) {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          return NextResponse.json(
            { error: "amount must be a positive number" },
            { status: 400 }
          );
        }
        data.amount = amount;
      }
      if (body.tax_amount !== undefined) data.taxAmount = Number(body.tax_amount) || 0;
      if (body.currency !== undefined) data.currency = body.currency;
      if (body.expense_date !== undefined) {
        const d = parseDateInput(body.expense_date);
        if (!d) {
          return NextResponse.json(
            { error: "expense_date is invalid" },
            { status: 400 }
          );
        }
        data.expenseDate = d;
      }
      if (body.receipt_url !== undefined) data.receiptUrl = body.receipt_url;
      if (body.notes !== undefined) data.notes = body.notes;

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      const updated = await prisma.wehowareExpense.update({
        where: { id },
        data,
        include: INCLUDE_RELATIONS,
      });

      return NextResponse.json(serializeExpense(updated));
    } catch (err) {
      console.error("[PUT /api/v1/expenses/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to update expense" },
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
      const existing = await prisma.wehowareExpense.findFirst({
        where: { id, clientId },
        select: { id: true, status: true, submittedBy: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Expense not found" },
          { status: 404 }
        );
      }
      const isAdmin = user.role === "admin";
      const isOwner = existing.submittedBy === user.id;
      if (!isAdmin && !isOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (existing.status === "Reimbursed") {
        return NextResponse.json(
          { error: "Cannot delete a reimbursed expense" },
          { status: 400 }
        );
      }
      if (existing.status !== "Pending" && !isAdmin) {
        return NextResponse.json(
          { error: "Only Pending expenses can be deleted by the submitter" },
          { status: 400 }
        );
      }

      await prisma.wehowareExpense.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/expenses/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to delete expense" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
