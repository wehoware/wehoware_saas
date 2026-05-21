import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/v1/plaid/exchange/route";
import { __setPlaidClientForTests } from "@/lib/plaid/client";
import { decryptSecret } from "@/lib/crypto";
import { __seed, prisma } from "../mocks/prisma.mjs";
import { makeRequest, seedAdmin } from "../harness.mjs";

function fakePlaid({ access_token, item_id, syncPages = [{ added: [], modified: [], removed: [], next_cursor: "c0", has_more: false }] }) {
  let i = 0;
  return {
    async itemPublicTokenExchange() {
      return { data: { access_token, item_id } };
    },
    async transactionsSync() {
      const page = syncPages[i] ?? { added: [], modified: [], removed: [], next_cursor: "end", has_more: false };
      i += 1;
      return { data: page };
    },
  };
}

test("POST /api/v1/plaid/exchange persists encrypted access_token + initial sync", async () => {
  seedAdmin();
  __setPlaidClientForTests(
    fakePlaid({
      access_token: "access-sandbox-xyz",
      item_id: "item-abc",
      syncPages: [
        {
          added: [
            { transaction_id: "tx1", account_id: "acc1", date: "2026-01-01", amount: 25, name: "Test", iso_currency_code: "USD" },
          ],
          modified: [],
          removed: [],
          next_cursor: "c1",
          has_more: false,
        },
      ],
    })
  );

  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/exchange",
    method: "POST",
    body: { public_token: "public-sandbox-123", institution: { id: "ins_1", name: "TestBank" } },
  });
  const res = await POST(req, { params: Promise.resolve({}) });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.item_id, "item-abc");
  assert.equal(body.institution_name, "TestBank");
  assert.equal(body.sync.added, 1);

  const items = await prisma.wehowarePlaidItem.findMany({});
  assert.equal(items.length, 1);
  assert.equal(items[0].itemId, "item-abc");
  assert.equal(decryptSecret(items[0].accessTokenEnc), "access-sandbox-xyz");

  const entries = await prisma.wehowareBankStatementEntry.findMany({});
  assert.equal(entries.length, 1);

  __setPlaidClientForTests(null);
});

test("POST /api/v1/plaid/exchange rejects empty body", async () => {
  seedAdmin();
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/exchange",
    method: "POST",
    body: {},
  });
  const res = await POST(req, { params: Promise.resolve({}) });
  assert.equal(res.status, 400);
});

test("POST /api/v1/plaid/exchange rejects invalid JSON", async () => {
  seedAdmin();
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/exchange",
    method: "POST",
    body: "not-json",
  });
  const res = await POST(req, { params: Promise.resolve({}) });
  assert.equal(res.status, 400);
});

test("POST /api/v1/plaid/exchange rejects re-linking an item owned by another tenant", async () => {
  const { clientId } = seedAdmin();
  // Seed an item for a *different* tenant with the same plaid item_id
  __seed("wehowarePlaidItem", [
    {
      id: "pre-existing",
      clientId: "OTHER-TENANT",
      itemId: "item-abc",
      accessTokenEnc: "v1:x:y:z",
      status: "Active",
    },
  ]);
  __setPlaidClientForTests(
    fakePlaid({ access_token: "access-1", item_id: "item-abc" })
  );
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/exchange",
    method: "POST",
    body: { public_token: "p" },
  });
  const res = await POST(req, { params: Promise.resolve({}) });
  assert.equal(res.status, 409);
  __setPlaidClientForTests(null);
  void clientId;
});

test("POST /api/v1/plaid/exchange surfaces Plaid SDK errors", async () => {
  seedAdmin();
  __setPlaidClientForTests({
    async itemPublicTokenExchange() {
      const err = new Error("INVALID_PUBLIC_TOKEN");
      err.response = { data: { error_message: "INVALID_PUBLIC_TOKEN" } };
      throw err;
    },
  });
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/exchange",
    method: "POST",
    body: { public_token: "bad" },
  });
  const res = await POST(req, { params: Promise.resolve({}) });
  assert.equal(res.status, 502);
  __setPlaidClientForTests(null);
});
