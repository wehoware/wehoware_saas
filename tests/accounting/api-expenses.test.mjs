// Integration tests for /api/v1/expenses and /api/v1/expenses/[id]
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET as listExpenses, POST as createExpense } from "@/app/api/v1/expenses/route";
import {
  GET as getExpense,
  PUT as updateExpense,
  DELETE as deleteExpense,
} from "@/app/api/v1/expenses/[id]/route";
import { makeRequest, seedAdmin, expectStatus, prisma, __seed } from "../harness.mjs";
import { __setSession } from "../mocks/auth.mjs";

function baseBody(overrides = {}) {
  return {
    description: "Taxi to airport",
    category: "Travel",
    amount: 45.5,
    expense_date: "2026-04-10",
    ...overrides,
  };
}

test("expenses POST: rejects missing description", async () => {
  seedAdmin();
  const res = await createExpense(
    makeRequest({ method: "POST", body: { ...baseBody(), description: "" } }),
    {}
  );
  expectStatus(res, 400);
});

test("expenses POST: rejects non-positive amount", async () => {
  seedAdmin();
  const res = await createExpense(
    makeRequest({ method: "POST", body: { ...baseBody(), amount: 0 } }),
    {}
  );
  expectStatus(res, 400);
});

test("expenses POST: rejects invalid category", async () => {
  seedAdmin();
  const res = await createExpense(
    makeRequest({ method: "POST", body: { ...baseBody(), category: "Bogus" } }),
    {}
  );
  expectStatus(res, 400);
});

test("expenses POST: maps spaced category label to DB enum", async () => {
  const { clientId } = seedAdmin();
  const res = await createExpense(
    makeRequest({
      method: "POST",
      body: baseBody({ category: "Office Supplies" }),
    }),
    {}
  );
  expectStatus(res, 201);
  const body = await res.json();
  assert.equal(body.category, "Office Supplies");
  const row = await prisma.wehowareExpense.findFirst({
    where: { id: body.id },
  });
  assert.equal(row.category, "OfficeSupplies");
  assert.equal(row.clientId, clientId);
});

test("expenses POST: always starts Pending regardless of body", async () => {
  seedAdmin();
  const res = await createExpense(
    makeRequest({
      method: "POST",
      body: baseBody({ status: "Approved" }), // ignored
    }),
    {}
  );
  const body = await res.json();
  assert.equal(body.status, "Pending");
});

test("expenses GET: employees only see their own", async () => {
  const { clientId } = seedAdmin({ role: "employee", userId: "emp-1" });
  __seed("wehowareExpense", [
    { id: "e1", clientId, submittedBy: "emp-1", description: "Mine", category: "Other", amount: 10, status: "Pending", expenseDate: new Date() },
    { id: "e2", clientId, submittedBy: "emp-2", description: "Theirs", category: "Other", amount: 20, status: "Pending", expenseDate: new Date() },
  ]);
  const res = await listExpenses(
    makeRequest({ url: "http://t/api/v1/expenses" }),
    {}
  );
  const body = await res.json();
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].id, "e1");
});

test("expenses GET: admin sees all", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareExpense", [
    { id: "e1", clientId, submittedBy: "u1", description: "A", category: "Other", amount: 10, status: "Pending", expenseDate: new Date() },
    { id: "e2", clientId, submittedBy: "u2", description: "B", category: "Other", amount: 20, status: "Approved", expenseDate: new Date() },
  ]);
  const res = await listExpenses(
    makeRequest({ url: "http://t/api/v1/expenses" }),
    {}
  );
  const body = await res.json();
  assert.equal(body.data.length, 2);
});

test("expenses PUT: employee cannot edit non-pending expense", async () => {
  const { clientId } = seedAdmin({ role: "employee", userId: "emp-1" });
  __seed("wehowareExpense", [
    { id: "e1", clientId, submittedBy: "emp-1", description: "A", category: "Other", amount: 10, status: "Approved", expenseDate: new Date() },
  ]);
  const res = await updateExpense(
    makeRequest({ method: "PUT", body: { amount: 20 } }),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 400);
});

test("expenses PUT: employee cannot edit another's expense", async () => {
  const { clientId } = seedAdmin({ role: "employee", userId: "emp-1" });
  __seed("wehowareExpense", [
    { id: "e1", clientId, submittedBy: "emp-2", description: "A", category: "Other", amount: 10, status: "Pending", expenseDate: new Date() },
  ]);
  const res = await updateExpense(
    makeRequest({ method: "PUT", body: { amount: 20 } }),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 403);
});

test("expenses PUT: admin can edit non-pending expense", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareExpense", [
    { id: "e1", clientId, submittedBy: "someone-else", description: "A", category: "Other", amount: 10, status: "Approved", expenseDate: new Date() },
  ]);
  const res = await updateExpense(
    makeRequest({ method: "PUT", body: { amount: 25 } }),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 200);
});

test("expenses DELETE: cannot delete reimbursed expense", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareExpense", [
    { id: "e1", clientId, submittedBy: "u1", description: "A", category: "Other", amount: 10, status: "Reimbursed", expenseDate: new Date() },
  ]);
  const res = await deleteExpense(
    makeRequest({ method: "DELETE" }),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 400);
});

test("expenses DELETE: employee can delete own pending expense", async () => {
  const { clientId } = seedAdmin({ role: "employee", userId: "emp-1" });
  __seed("wehowareExpense", [
    { id: "e1", clientId, submittedBy: "emp-1", description: "A", category: "Other", amount: 10, status: "Pending", expenseDate: new Date() },
  ]);
  const res = await deleteExpense(
    makeRequest({ method: "DELETE" }),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 200);
});

test("expenses GET single: employee cannot view other's expense", async () => {
  const { clientId } = seedAdmin({ role: "employee", userId: "emp-1" });
  __seed("wehowareExpense", [
    { id: "e1", clientId, submittedBy: "emp-2", description: "A", category: "Other", amount: 10, status: "Pending", expenseDate: new Date() },
  ]);
  const res = await getExpense(
    makeRequest({}),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 403);
});
