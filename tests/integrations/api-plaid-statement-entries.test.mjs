import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/api/v1/plaid/statement-entries/route";
import { __seed } from "../mocks/prisma.mjs";
import { makeRequest, seedAdmin } from "../harness.mjs";

function seedEntries(clientId) {
  const rows = [];
  for (let i = 0; i < 25; i += 1) {
    rows.push({
      id: `e${i}`,
      clientId,
      plaidItemId: "item-1",
      bankAccountId: "ba1",
      source: i % 2 === 0 ? "Plaid" : "CSV",
      externalId: `ext-${i}`,
      postedAt: new Date(2026, 0, i + 1),
      amount: 10 + i,
      currency: "USD",
      description: `Tx #${i}`,
      reconciliation: i % 5 === 0 ? "Reconciled" : "Unreconciled",
      pending: false,
      importedAt: new Date(2026, 0, i + 1, 12, 0, 0),
    });
  }
  // Add a different-tenant row to confirm scoping
  rows.push({
    id: "e-other",
    clientId: "OTHER",
    plaidItemId: "x",
    source: "Plaid",
    externalId: "ext-other",
    postedAt: new Date(2026, 0, 1),
    amount: 999,
    currency: "USD",
    description: "Should not appear",
    reconciliation: "Unreconciled",
    pending: false,
  });
  __seed("wehowareBankStatementEntry", rows);
}

test("GET /api/v1/plaid/statement-entries lists tenant entries with pagination", async () => {
  const { clientId } = seedAdmin();
  seedEntries(clientId);
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/statement-entries?page=1&page_size=10",
  });
  const res = await GET(req, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.pagination.total, 25);
  assert.equal(body.pagination.total_pages, 3);
  assert.equal(body.data.length, 10);
  // Newest first
  assert.equal(body.data[0].external_id, "ext-24");
});

test("GET /api/v1/plaid/statement-entries supports reconciliation filter", async () => {
  const { clientId } = seedAdmin();
  seedEntries(clientId);
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/statement-entries?reconciliation=Reconciled&page_size=50",
  });
  const res = await GET(req, {});
  const body = await res.json();
  assert.equal(body.pagination.total, 5);
  for (const r of body.data) assert.equal(r.reconciliation, "Reconciled");
});

test("GET /api/v1/plaid/statement-entries supports source filter", async () => {
  const { clientId } = seedAdmin();
  seedEntries(clientId);
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/statement-entries?source=CSV&page_size=50",
  });
  const res = await GET(req, {});
  const body = await res.json();
  for (const r of body.data) assert.equal(r.source, "CSV");
});

test("GET /api/v1/plaid/statement-entries clamps page_size to MAX", async () => {
  const { clientId } = seedAdmin();
  seedEntries(clientId);
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/statement-entries?page_size=99999",
  });
  const res = await GET(req, {});
  const body = await res.json();
  assert.equal(body.pagination.page_size, 200);
});

test("GET /api/v1/plaid/statement-entries 401 when unauthenticated", async () => {
  const { __resetSession } = await import("../mocks/auth.mjs");
  __resetSession();
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/statement-entries",
  });
  const res = await GET(req, {});
  assert.equal(res.status, 401);
});
