import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/v1/plaid/webhook/route";
import { __setPlaidClientForTests } from "@/lib/plaid/client";
import { encryptSecret } from "@/lib/crypto";
import { __reset, __seed, prisma } from "../mocks/prisma.mjs";
import { makeRequest } from "../harness.mjs";

function seedItem({ status = "Active" } = {}) {
  __reset();
  __seed("wehowarePlaidItem", [
    {
      id: "pi1",
      clientId: "c1",
      itemId: "item-1",
      institutionName: "TestBank",
      accessTokenEnc: encryptSecret("access-token-x"),
      status,
    },
  ]);
}

test("POST /api/v1/plaid/webhook acks unknown item without error", async () => {
  __reset();
  const req = makeRequest({
    method: "POST",
    body: { item_id: "unknown-item", webhook_type: "TRANSACTIONS", webhook_code: "DEFAULT_UPDATE" },
  });
  const res = await POST(req, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.unknown_item, true);
});

test("POST /api/v1/plaid/webhook acks ping (no item_id)", async () => {
  const req = makeRequest({ method: "POST", body: {} });
  const res = await POST(req, {});
  assert.equal(res.status, 200);
});

test("POST /api/v1/plaid/webhook on TRANSACTIONS triggers a sync", async () => {
  seedItem();
  __setPlaidClientForTests({
    async transactionsSync() {
      return {
        data: {
          added: [
            { transaction_id: "t-w", account_id: "a", date: "2026-02-01", amount: 11, name: "x", iso_currency_code: "USD" },
          ],
          modified: [],
          removed: [],
          next_cursor: "c-w",
          has_more: false,
        },
      };
    },
  });
  const req = makeRequest({
    method: "POST",
    body: {
      item_id: "item-1",
      webhook_type: "TRANSACTIONS",
      webhook_code: "DEFAULT_UPDATE",
    },
  });
  const res = await POST(req, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.sync.added, 1);
  __setPlaidClientForTests(null);
});

test("POST /api/v1/plaid/webhook flips item to RequiresReauth on ITEM_LOGIN_REQUIRED", async () => {
  seedItem();
  const req = makeRequest({
    method: "POST",
    body: {
      item_id: "item-1",
      webhook_type: "ITEM",
      webhook_code: "ERROR",
      error: { error_code: "ITEM_LOGIN_REQUIRED", error_message: "needs reauth" },
    },
  });
  const res = await POST(req, {});
  assert.equal(res.status, 200);
  const item = await prisma.wehowarePlaidItem.findUnique({ where: { id: "pi1" } });
  assert.equal(item.status, "RequiresReauth");
  assert.equal(item.errorCode, "ITEM_LOGIN_REQUIRED");
});

test("POST /api/v1/plaid/webhook records non-reauth ITEM ERROR as Error status", async () => {
  seedItem();
  const req = makeRequest({
    method: "POST",
    body: {
      item_id: "item-1",
      webhook_type: "ITEM",
      webhook_code: "ERROR",
      error: { error_code: "INSTITUTION_DOWN", error_message: "down" },
    },
  });
  const res = await POST(req, {});
  assert.equal(res.status, 200);
  const item = await prisma.wehowarePlaidItem.findUnique({ where: { id: "pi1" } });
  assert.equal(item.status, "Error");
  assert.equal(item.errorCode, "INSTITUTION_DOWN");
});

test("POST /api/v1/plaid/webhook ignores unknown webhook types gracefully", async () => {
  seedItem();
  const req = makeRequest({
    method: "POST",
    body: { item_id: "item-1", webhook_type: "WHATEVER", webhook_code: "X" },
  });
  const res = await POST(req, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ignored, "WHATEVER");
});
