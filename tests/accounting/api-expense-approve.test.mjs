// Integration tests for /api/v1/expenses/[id]/approve
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST as approveExpense } from "@/app/api/v1/expenses/[id]/approve/route";
import { makeRequest, seedAdmin, expectStatus, prisma, __seed } from "../harness.mjs";

function seedPending(clientId, overrides = {}) {
  __seed("wehowareExpense", [
    {
      id: "e1",
      clientId,
      submittedBy: "submitter-1",
      description: "Taxi",
      category: "Travel",
      amount: 45,
      status: "Pending",
      expenseDate: new Date(),
      ...overrides,
    },
  ]);
}

test("approve POST: rejects unknown action", async () => {
  const { clientId } = seedAdmin();
  seedPending(clientId);
  const res = await approveExpense(
    makeRequest({ method: "POST", body: { action: "bogus" } }),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 400);
});

test("approve POST: requires a reason when rejecting", async () => {
  const { clientId } = seedAdmin();
  seedPending(clientId);
  const res = await approveExpense(
    makeRequest({ method: "POST", body: { action: "reject" } }),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 400);
});

test("approve POST: approves pending expense", async () => {
  const { clientId } = seedAdmin();
  seedPending(clientId);
  const res = await approveExpense(
    makeRequest({ method: "POST", body: { action: "approve" } }),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.status, "Approved");
  const row = await prisma.wehowareExpense.findUnique({ where: { id: "e1" } });
  assert.equal(row.status, "Approved");
  assert.ok(row.approvedBy);
});

test("approve POST: reject sets reason and status=Rejected", async () => {
  const { clientId } = seedAdmin();
  seedPending(clientId);
  const res = await approveExpense(
    makeRequest({
      method: "POST",
      body: { action: "reject", reason: "Out of policy" },
    }),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 200);
  const row = await prisma.wehowareExpense.findUnique({ where: { id: "e1" } });
  assert.equal(row.status, "Rejected");
  assert.equal(row.rejectedReason, "Out of policy");
});

test("approve POST: cannot approve already-approved expense", async () => {
  const { clientId } = seedAdmin();
  seedPending(clientId, { status: "Approved" });
  const res = await approveExpense(
    makeRequest({ method: "POST", body: { action: "approve" } }),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 400);
});

test("approve POST: reimburse only allowed on Approved", async () => {
  const { clientId } = seedAdmin();
  seedPending(clientId);
  const res = await approveExpense(
    makeRequest({ method: "POST", body: { action: "reimburse" } }),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 400);
});

test("approve POST: reimburses an approved expense", async () => {
  const { clientId } = seedAdmin();
  seedPending(clientId, { status: "Approved" });
  const res = await approveExpense(
    makeRequest({ method: "POST", body: { action: "reimburse" } }),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 200);
  const row = await prisma.wehowareExpense.findUnique({ where: { id: "e1" } });
  assert.equal(row.status, "Reimbursed");
  assert.ok(row.reimbursedAt);
});

test("approve POST: submitter cannot self-approve", async () => {
  const { clientId } = seedAdmin({ userId: "self-approver" });
  seedPending(clientId, { submittedBy: "self-approver" });
  const res = await approveExpense(
    makeRequest({ method: "POST", body: { action: "approve" } }),
    { params: Promise.resolve({ id: "e1" }) }
  );
  expectStatus(res, 403);
});
