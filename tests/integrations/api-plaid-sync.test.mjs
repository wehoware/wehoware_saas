import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/v1/plaid/sync/route";
import { __setPlaidClientForTests } from "@/lib/plaid/client";
import { encryptSecret } from "@/lib/crypto";
import { __seed } from "../mocks/prisma.mjs";
import { makeRequest, seedAdmin } from "../harness.mjs";

function seedActiveItems(clientId) {
  __seed("wehowarePlaidItem", [
    {
      id: "pi1",
      clientId,
      itemId: "i1",
      institutionName: "B1",
      accessTokenEnc: encryptSecret("t1"),
      status: "Active",
    },
    {
      id: "pi2",
      clientId,
      itemId: "i2",
      institutionName: "B2",
      accessTokenEnc: encryptSecret("t2"),
      status: "Active",
    },
    {
      id: "pi-disc",
      clientId,
      itemId: "i3",
      accessTokenEnc: "",
      status: "Disconnected",
    },
  ]);
}

test("POST /api/v1/plaid/sync syncs every active item by default", async () => {
  const { clientId } = seedAdmin();
  seedActiveItems(clientId);
  __setPlaidClientForTests({
    async transactionsSync() {
      return {
        data: { added: [], modified: [], removed: [], next_cursor: "c", has_more: false },
      };
    },
  });
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/sync",
    method: "POST",
    body: {},
  });
  const res = await POST(req, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.synced, 2);
  __setPlaidClientForTests(null);
});

test("POST /api/v1/plaid/sync targets a single item when plaid_item_id provided", async () => {
  const { clientId } = seedAdmin();
  seedActiveItems(clientId);
  __setPlaidClientForTests({
    async transactionsSync() {
      return { data: { added: [], modified: [], removed: [], next_cursor: "c", has_more: false } };
    },
  });
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/sync",
    method: "POST",
    body: { plaid_item_id: "pi1" },
  });
  const res = await POST(req, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.synced, 1);
  assert.equal(body.results[0].id, "pi1");
  __setPlaidClientForTests(null);
});

test("POST /api/v1/plaid/sync returns 200 with synced=0 when no items exist", async () => {
  seedAdmin();
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/sync",
    method: "POST",
    body: {},
  });
  const res = await POST(req, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.synced, 0);
});

test("POST /api/v1/plaid/sync captures per-item errors without failing the request", async () => {
  const { clientId } = seedAdmin();
  seedActiveItems(clientId);
  let calls = 0;
  __setPlaidClientForTests({
    async transactionsSync() {
      calls += 1;
      if (calls === 1) {
        return { data: { added: [], modified: [], removed: [], next_cursor: "c", has_more: false } };
      }
      throw new Error("boom");
    },
  });
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/sync",
    method: "POST",
    body: {},
  });
  const res = await POST(req, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.synced, 2);
  const failures = body.results.filter((r) => r.error);
  assert.equal(failures.length, 1);
  __setPlaidClientForTests(null);
});

test("POST /api/v1/plaid/sync requires authentication", async () => {
  const { __resetSession } = await import("../mocks/auth.mjs");
  __resetSession();
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/sync",
    method: "POST",
    body: {},
  });
  const res = await POST(req, {});
  assert.equal(res.status, 401);
});
