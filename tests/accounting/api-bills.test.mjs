// Integration tests for /api/v1/bills and /api/v1/bills/[id]
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET as listBills, POST as createBill } from "@/app/api/v1/bills/route";
import {
  GET as getBill,
  PUT as updateBill,
  DELETE as deleteBill,
} from "@/app/api/v1/bills/[id]/route";
import { makeRequest, seedAdmin, expectStatus, prisma, __seed } from "../harness.mjs";

function seedVendor(clientId, id = "v1", overrides = {}) {
  __seed("wehowareVendor", [
    { id, clientId, name: "Acme", active: true, ...overrides },
  ]);
}

function baseBillBody(overrides = {}) {
  return {
    vendor_id: "v1",
    bill_date: "2026-04-01",
    due_date: "2026-05-01",
    currency: "CAD",
    tax_rate: 10,
    line_items: [
      { description: "Widget", quantity: 2, unit_price: 50 },
    ],
    ...overrides,
  };
}

test("bills POST: rejects missing vendor_id", async () => {
  seedAdmin();
  const body = baseBillBody();
  delete body.vendor_id;
  const res = await createBill(makeRequest({ method: "POST", body }), {});
  expectStatus(res, 400);
  assert.match((await res.json()).error, /vendor_id is required/i);
});

test("bills POST: rejects invalid bill_date", async () => {
  const { clientId } = seedAdmin();
  seedVendor(clientId);
  const res = await createBill(
    makeRequest({ method: "POST", body: baseBillBody({ bill_date: "not-a-date" }) }),
    {}
  );
  expectStatus(res, 400);
});

test("bills POST: rejects unknown vendor", async () => {
  seedAdmin();
  const res = await createBill(
    makeRequest({
      method: "POST",
      body: baseBillBody({ vendor_id: "does-not-exist" }),
    }),
    {}
  );
  expectStatus(res, 400);
});

test("bills POST: rejects cross-tenant vendor", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareVendor", [
    { id: "v1", clientId: "other-tenant", name: "Acme", active: true },
  ]);
  const res = await createBill(
    makeRequest({ method: "POST", body: baseBillBody() }),
    {}
  );
  expectStatus(res, 400);
});

test("bills POST: computes subtotal, taxAmount, total", async () => {
  const { clientId } = seedAdmin();
  seedVendor(clientId);
  const res = await createBill(
    makeRequest({
      method: "POST",
      body: baseBillBody({
        line_items: [
          { description: "A", quantity: 2, unit_price: 10 },
          { description: "B", quantity: 1, unit_price: 5 },
        ],
        tax_rate: 10,
      }),
    }),
    {}
  );
  expectStatus(res, 201);
  const body = await res.json();
  assert.equal(body.subtotal, 25);
  assert.equal(body.tax_amount, 2.5);
  assert.equal(body.total, 27.5);
  assert.equal(body.amount_due, 27.5);
  assert.equal(body.line_items.length, 2);
  assert.equal(body.line_items[0].sort_order, 0);
  assert.equal(body.line_items[1].sort_order, 1);
});

test("bills POST: auto-generates bill number from accounting settings", async () => {
  const { clientId } = seedAdmin();
  seedVendor(clientId);
  __seed("wehowareAccountingSettings", [
    {
      id: "s1",
      clientId,
      billNumberFormat: "BILL-{YYYY}-{XXXX}",
      nextBillNumber: 7,
    },
  ]);
  const res = await createBill(
    makeRequest({ method: "POST", body: baseBillBody() }),
    {}
  );
  expectStatus(res, 201);
  const body = await res.json();
  assert.match(body.bill_number, /^BILL-\d{4}-0007$/);
  // Sequence should bump to 8
  const settings = await prisma.wehowareAccountingSettings.findUnique({
    where: { clientId },
  });
  assert.equal(settings.nextBillNumber, 8);
});

test("bills POST: does NOT bump sequence when bill_number is provided", async () => {
  const { clientId } = seedAdmin();
  seedVendor(clientId);
  __seed("wehowareAccountingSettings", [
    { id: "s1", clientId, billNumberFormat: "BILL-{XXXX}", nextBillNumber: 5 },
  ]);
  const res = await createBill(
    makeRequest({
      method: "POST",
      body: baseBillBody({ bill_number: "CUSTOM-001" }),
    }),
    {}
  );
  expectStatus(res, 201);
  const body = await res.json();
  assert.equal(body.bill_number, "CUSTOM-001");
  const settings = await prisma.wehowareAccountingSettings.findUnique({
    where: { clientId },
  });
  assert.equal(settings.nextBillNumber, 5);
});

test("bills GET: filters by status label", async () => {
  const { clientId } = seedAdmin();
  seedVendor(clientId);
  __seed("wehowareBill", [
    { id: "b1", clientId, vendorId: "v1", status: "Open", billNumber: "1", total: 100, amountPaid: 0, billDate: new Date(), dueDate: new Date() },
    { id: "b2", clientId, vendorId: "v1", status: "Paid", billNumber: "2", total: 100, amountPaid: 100, billDate: new Date(), dueDate: new Date() },
  ]);
  const res = await listBills(
    makeRequest({ url: "http://t/api/v1/bills?status=Paid" }),
    {}
  );
  const body = await res.json();
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].status, "Paid");
});

test("bills GET: translates DB PartiallyPaid to label", async () => {
  const { clientId } = seedAdmin();
  seedVendor(clientId);
  __seed("wehowareBill", [
    { id: "b1", clientId, vendorId: "v1", status: "PartiallyPaid", billNumber: "1", total: 100, amountPaid: 40, billDate: new Date(), dueDate: new Date() },
  ]);
  const res = await listBills(
    makeRequest({ url: "http://t/api/v1/bills" }),
    {}
  );
  const body = await res.json();
  assert.equal(body.data[0].status, "Partially Paid");
});

test("bills PUT: recomputes totals when only tax_rate changes", async () => {
  // This test exists specifically to verify the bug fix where passing
  // only tax_rate previously wiped out totals (since an empty line_items
  // array was used for recomputation).
  const { clientId } = seedAdmin();
  seedVendor(clientId);
  __seed("wehowareBill", [
    {
      id: "b1",
      clientId,
      vendorId: "v1",
      status: "Open",
      billNumber: "1",
      subtotal: 100,
      taxRate: 0,
      taxAmount: 0,
      total: 100,
      amountPaid: 0,
      billDate: new Date(),
      dueDate: new Date(),
    },
  ]);
  __seed("wehowareBillLineItem", [
    { id: "li1", billId: "b1", clientId, description: "X", quantity: 1, unitPrice: 100, total: 100, sortOrder: 0 },
  ]);
  const res = await updateBill(
    makeRequest({ method: "PUT", body: { tax_rate: 10 } }),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.subtotal, 100);
  assert.equal(body.tax_amount, 10);
  assert.equal(body.total, 110);
});

test("bills PUT: rejects invalid status label", async () => {
  const { clientId } = seedAdmin();
  seedVendor(clientId);
  __seed("wehowareBill", [
    { id: "b1", clientId, vendorId: "v1", status: "Open", billNumber: "1", total: 100, amountPaid: 0, billDate: new Date(), dueDate: new Date() },
  ]);
  const res = await updateBill(
    makeRequest({ method: "PUT", body: { status: "Bogus" } }),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 400);
});

test("bills DELETE: blocks deletion with recorded payments", async () => {
  const { clientId } = seedAdmin();
  seedVendor(clientId);
  __seed("wehowareBill", [
    { id: "b1", clientId, vendorId: "v1", status: "Paid", billNumber: "1", total: 100, amountPaid: 100, billDate: new Date(), dueDate: new Date() },
  ]);
  const res = await deleteBill(
    makeRequest({ method: "DELETE" }),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 400);
  assert.match((await res.json()).error, /payments/i);
});

test("bills DELETE: allows deletion of unpaid bill", async () => {
  const { clientId } = seedAdmin();
  seedVendor(clientId);
  __seed("wehowareBill", [
    { id: "b1", clientId, vendorId: "v1", status: "Draft", billNumber: "1", total: 100, amountPaid: 0, billDate: new Date(), dueDate: new Date() },
  ]);
  const res = await deleteBill(
    makeRequest({ method: "DELETE" }),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 200);
});

test("bills GET single: tenant isolation", async () => {
  seedAdmin();
  __seed("wehowareVendor", [{ id: "v1", clientId: "other", name: "V", active: true }]);
  __seed("wehowareBill", [
    { id: "b1", clientId: "other", vendorId: "v1", status: "Open", billNumber: "1", total: 100, amountPaid: 0, billDate: new Date(), dueDate: new Date() },
  ]);
  const res = await getBill(
    makeRequest({}),
    { params: Promise.resolve({ id: "b1" }) }
  );
  expectStatus(res, 404);
});
