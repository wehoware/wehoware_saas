// Integration tests for /api/v1/bills/[id]/payments
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GET as listPayments,
  POST as recordPayment,
} from "@/app/api/v1/bills/[id]/payments/route";
import { makeRequest, seedAdmin, expectStatus, prisma, __seed } from "../harness.mjs";

function seedOpenBill(clientId, overrides = {}) {
  __seed("wehowareVendor", [
    { id: "v1", clientId, name: "Acme", active: true },
  ]);
  __seed("wehowareBill", [
    {
      id: "b1",
      clientId,
      vendorId: "v1",
      status: "Open",
      billNumber: "BILL-1",
      subtotal: 100,
      taxRate: 0,
      taxAmount: 0,
      total: 100,
      amountPaid: 0,
      billDate: new Date(),
      dueDate: new Date(Date.now() + 86_400_000),
      ...overrides,
    },
  ]);
}

test("payments POST: requires positive amount", async () => {
  const { clientId } = seedAdmin();
  seedOpenBill(clientId);
  const res = await recordPayment(
    makeRequest({
      method: "POST",
      body: { amount: 0, payment_date: "2026-04-01", method: "Bank Transfer" },
    }),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 400);
});

test("payments POST: requires valid payment_date", async () => {
  const { clientId } = seedAdmin();
  seedOpenBill(clientId);
  const res = await recordPayment(
    makeRequest({
      method: "POST",
      body: { amount: 50, payment_date: "garbage", method: "Cash" },
    }),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 400);
});

test("payments POST: rejects invalid method", async () => {
  const { clientId } = seedAdmin();
  seedOpenBill(clientId);
  const res = await recordPayment(
    makeRequest({
      method: "POST",
      body: { amount: 50, payment_date: "2026-04-01", method: "Bitcoin" },
    }),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 400);
});

test("payments POST: rejects payment exceeding bill total", async () => {
  const { clientId } = seedAdmin();
  seedOpenBill(clientId);
  const res = await recordPayment(
    makeRequest({
      method: "POST",
      body: { amount: 150, payment_date: "2026-04-01", method: "Cash" },
    }),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 400);
});

test("payments POST: partial payment updates status to PartiallyPaid", async () => {
  const { clientId } = seedAdmin();
  seedOpenBill(clientId);
  const res = await recordPayment(
    makeRequest({
      method: "POST",
      body: { amount: 40, payment_date: "2026-04-01", method: "Cash" },
    }),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 201);
  const bill = await prisma.wehowareBill.findUnique({ where: { id: "b1" } });
  assert.equal(Number(bill.amountPaid), 40);
  assert.equal(bill.status, "PartiallyPaid");
});

test("payments POST: full payment marks bill Paid and sets paid_at", async () => {
  const { clientId } = seedAdmin();
  seedOpenBill(clientId);
  const res = await recordPayment(
    makeRequest({
      method: "POST",
      body: { amount: 100, payment_date: "2026-04-01", method: "Bank Transfer" },
    }),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 201);
  const bill = await prisma.wehowareBill.findUnique({ where: { id: "b1" } });
  assert.equal(bill.status, "Paid");
  assert.ok(bill.paidAt);
});

test("payments POST: second payment closes remaining balance", async () => {
  const { clientId } = seedAdmin();
  seedOpenBill(clientId, { amountPaid: 60, status: "PartiallyPaid" });
  const res = await recordPayment(
    makeRequest({
      method: "POST",
      body: { amount: 40, payment_date: "2026-04-02", method: "Cheque" },
    }),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 201);
  const bill = await prisma.wehowareBill.findUnique({ where: { id: "b1" } });
  assert.equal(bill.status, "Paid");
});

test("payments POST: rejects unknown bank_account_id", async () => {
  const { clientId } = seedAdmin();
  seedOpenBill(clientId);
  const res = await recordPayment(
    makeRequest({
      method: "POST",
      body: {
        amount: 50,
        payment_date: "2026-04-01",
        method: "Cash",
        bank_account_id: "no-such-account",
      },
    }),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 400);
});

test("payments GET: lists payments scoped to bill", async () => {
  const { clientId } = seedAdmin();
  seedOpenBill(clientId);
  __seed("wehowareBillPayment", [
    { id: "p1", billId: "b1", clientId, amount: 50, paymentDate: new Date(), method: "Cash" },
    { id: "p2", billId: "b1", clientId, amount: 50, paymentDate: new Date(), method: "Cheque" },
    { id: "p3", billId: "other", clientId, amount: 10, paymentDate: new Date(), method: "Cash" },
  ]);
  const res = await listPayments(
    makeRequest({}),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.data.length, 2);
});
