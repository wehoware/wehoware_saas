/**
 * /api/v1/bills/[id]/payments
 *
 * GET  — list payments for a bill
 * POST — record a payment against a bill (atomically updates bill.amountPaid + status)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";
import { parseDateInput, deriveBillStatus, PAYMENT_METHODS } from "@/lib/accounting";

const VALID_METHODS = new Set(PAYMENT_METHODS);

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function serializePayment(p) {
  return {
    id: p.id,
    bill_id: p.billId,
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

export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: billId } = await params;
      const clientId = resolveClientId(user);
      if (!clientId) {
        return NextResponse.json(
          { error: "Active client context required" },
          { status: 400 }
        );
      }
      const bill = await prisma.wehowareBill.findFirst({
        where: { id: billId, clientId },
        select: { id: true },
      });
      if (!bill) {
        return NextResponse.json(
          { error: "Bill not found" },
          { status: 404 }
        );
      }
      const payments = await prisma.wehowareBillPayment.findMany({
        where: { billId, clientId },
        orderBy: { paymentDate: "desc" },
      });
      return NextResponse.json({ data: payments.map(serializePayment) });
    } catch (err) {
      console.error("[GET /api/v1/bills/[id]/payments] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch payments" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);

export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: billId } = await params;
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

      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "amount must be a positive number" },
          { status: 400 }
        );
      }
      const paymentDate = parseDateInput(body.payment_date);
      if (!paymentDate) {
        return NextResponse.json(
          { error: "payment_date is required" },
          { status: 400 }
        );
      }
      if (body.method && !VALID_METHODS.has(body.method)) {
        return NextResponse.json(
          {
            error: `Invalid method. Must be one of: ${[...VALID_METHODS].join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Validate bank account if provided
      if (body.bank_account_id) {
        const bankAccount = await prisma.wehowareBankAccount.findFirst({
          where: { id: body.bank_account_id, clientId },
          select: { id: true },
        });
        if (!bankAccount) {
          return NextResponse.json(
            { error: "bank_account_id not found for this client" },
            { status: 400 }
          );
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const bill = await tx.wehowareBill.findFirst({
          where: { id: billId, clientId },
          select: {
            id: true,
            total: true,
            amountPaid: true,
            dueDate: true,
            status: true,
          },
        });
        if (!bill) {
          throw Object.assign(new Error("Bill not found"), { status: 404 });
        }

        const newAmountPaid = Number(bill.amountPaid) + amount;
        if (newAmountPaid > Number(bill.total) + 0.005) {
          throw Object.assign(
            new Error("Payment exceeds bill total"),
            { status: 400 }
          );
        }

        const payment = await tx.wehowareBillPayment.create({
          data: {
            billId,
            clientId,
            paymentDate,
            amount,
            method: body.method ?? null,
            reference: body.reference ?? null,
            notes: body.notes ?? null,
            bankAccountId: body.bank_account_id ?? null,
            createdBy: user.id,
          },
        });

        const newStatus = deriveBillStatus({
          total: bill.total,
          amountPaid: newAmountPaid,
          dueDate: bill.dueDate,
          currentStatus: bill.status,
        });

        await tx.wehowareBill.update({
          where: { id: billId },
          data: {
            amountPaid: newAmountPaid,
            status: newStatus,
            paidAt: newStatus === "Paid" ? new Date() : null,
            updatedBy: user.id,
          },
        });

        return payment;
      });

      return NextResponse.json(serializePayment(result), { status: 201 });
    } catch (err) {
      const status = err?.status ?? 500;
      if (status !== 500) {
        return NextResponse.json({ error: err.message }, { status });
      }
      console.error("[POST /api/v1/bills/[id]/payments] error:", err);
      return NextResponse.json(
        { error: "Failed to record payment" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);
