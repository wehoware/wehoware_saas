// Integration tests for /api/v1/transactions and /api/v1/transactions/[id]
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GET as listTransactions,
  POST as createTransaction,
} from "@/app/api/v1/transactions/route";
import {
  GET as getTransaction,
  PUT as updateTransaction,
  DELETE as deleteTransaction,
} from "@/app/api/v1/transactions/[id]/route";
import { makeRequest, seedAdmin, expectStatus, prisma, __seed } from "../harness.mjs";

function baseBody(overrides = {}) {
  return {
    transaction_date: "2026-04-01",
    amount: 125.5,
    type: "Sale",
    description: "Subscription renewal",
    ...overrides,
  };
}

test("transactions POST: requires transaction_date", async () => {
  seedAdmin();
  const body = baseBody();
  delete body.transaction_date;
  const res = await createTransaction(makeRequest({ method: "POST", body }), {});
  expectStatus(res, 400);
});

test("transactions POST: rejects invalid date format", async () => {
  seedAdmin();
  const res = await createTransaction(
    makeRequest({
      method: "POST",
      body: baseBody({ transaction_date: "not-a-date" }),
    }),
    {}
  );
  // Bug fix: previously this would create an Invalid Date and break Prisma.
  expectStatus(res, 400);
});

test("transactions POST: rejects invalid type", async () => {
  seedAdmin();
  const res = await createTransaction(
    makeRequest({ method: "POST", body: baseBody({ type: "Bogus" }) }),
    {}
  );
  expectStatus(res, 400);
});

test("transactions POST: rejects invalid status", async () => {
  seedAdmin();
  const res = await createTransaction(
    makeRequest({ method: "POST", body: baseBody({ status: "Bogus" }) }),
    {}
  );
  expectStatus(res, 400);
});

test("transactions POST: requires description (schema is NOT NULL)", async () => {
  seedAdmin();
  const body = baseBody();
  delete body.description;
  const res = await createTransaction(makeRequest({ method: "POST", body }), {});
  // Bug fix: the schema requires description; handler now validates.
  expectStatus(res, 400);
});

test("transactions POST: creates a valid transaction", async () => {
  const { clientId } = seedAdmin();
  const res = await createTransaction(
    makeRequest({ method: "POST", body: baseBody() }),
    {}
  );
  expectStatus(res, 201);
  const body = await res.json();
  assert.equal(body.amount, 125.5);
  assert.equal(body.type, "Sale");
  assert.equal(body.status, "Pending"); // default
  assert.equal(body.client_id, clientId);
});

test("transactions POST: rejects invoice_id from another tenant", async () => {
  seedAdmin();
  __seed("wehowareInvoice", [
    { id: "inv-other", clientId: "other", invoiceNumber: "X", clientName: "Y", status: "Draft", subtotal: 0, taxRate: 0, taxAmount: 0, total: 0, invoiceDate: new Date(), dueDate: new Date() },
  ]);
  const res = await createTransaction(
    makeRequest({
      method: "POST",
      body: baseBody({ invoice_id: "inv-other" }),
    }),
    {}
  );
  expectStatus(res, 400);
});

test("transactions GET: filters by type and status", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareTransaction", [
    { id: "t1", clientId, transactionDate: new Date(), description: "A", amount: 10, type: "Sale", status: "Pending", source: "Manual", direction: "Incoming", reconciliation: "Unreconciled" },
    { id: "t2", clientId, transactionDate: new Date(), description: "B", amount: 20, type: "Refund", status: "Completed", source: "Manual", direction: "Outgoing", reconciliation: "Unreconciled" },
  ]);
  const res = await listTransactions(
    makeRequest({ url: "http://t/api/v1/transactions?type=Sale" }),
    {}
  );
  const body = await res.json();
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].type, "Sale");
});

test("transactions PUT: rejects null transaction_date (schema NOT NULL)", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareTransaction", [
    { id: "t1", clientId, transactionDate: new Date(), description: "A", amount: 10, type: "Sale", status: "Pending", source: "Manual", direction: "Incoming", reconciliation: "Unreconciled" },
  ]);
  const res = await updateTransaction(
    makeRequest({ method: "PUT", body: { transaction_date: null } }),
    { params: Promise.resolve({ id: "t1" }) }
  );
  // Bug fix: previously this would set transactionDate to null which violates
  // the schema. Handler should reject.
  expectStatus(res, 400);
});

test("transactions PUT: rejects null description (schema NOT NULL)", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareTransaction", [
    { id: "t1", clientId, transactionDate: new Date(), description: "A", amount: 10, type: "Sale", status: "Pending", source: "Manual", direction: "Incoming", reconciliation: "Unreconciled" },
  ]);
  const res = await updateTransaction(
    makeRequest({ method: "PUT", body: { description: null } }),
    { params: Promise.resolve({ id: "t1" }) }
  );
  expectStatus(res, 400);
});

test("transactions PUT: updates type when valid", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareTransaction", [
    { id: "t1", clientId, transactionDate: new Date(), description: "A", amount: 10, type: "Sale", status: "Pending", source: "Manual", direction: "Incoming", reconciliation: "Unreconciled" },
  ]);
  const res = await updateTransaction(
    makeRequest({ method: "PUT", body: { type: "Refund" } }),
    { params: Promise.resolve({ id: "t1" }) }
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.type, "Refund");
});

test("transactions DELETE: removes record", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareTransaction", [
    { id: "t1", clientId, transactionDate: new Date(), description: "A", amount: 10, type: "Sale", status: "Pending", source: "Manual", direction: "Incoming", reconciliation: "Unreconciled" },
  ]);
  const res = await deleteTransaction(
    makeRequest({ method: "DELETE" }),
    { params: Promise.resolve({ id: "t1" }) }
  );
  expectStatus(res, 200);
  assert.equal(
    await prisma.wehowareTransaction.findFirst({ where: { id: "t1" } }),
    null
  );
});

test("transactions GET single: tenant isolation", async () => {
  seedAdmin();
  __seed("wehowareTransaction", [
    { id: "t1", clientId: "other", transactionDate: new Date(), description: "X", amount: 1, type: "Sale", status: "Pending", source: "Manual", direction: "Incoming", reconciliation: "Unreconciled" },
  ]);
  const res = await getTransaction(
    makeRequest({}),
    { params: Promise.resolve({ id: "t1" }) }
  );
  expectStatus(res, 404);
});
