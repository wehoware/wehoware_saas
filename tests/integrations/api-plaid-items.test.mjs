import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, DELETE } from "@/app/api/v1/plaid/items/route";
import { __setPlaidClientForTests } from "@/lib/plaid/client";
import { encryptSecret } from "@/lib/crypto";
import { __seed, prisma } from "../mocks/prisma.mjs";
import { makeRequest, seedAdmin } from "../harness.mjs";

function seedItemsForTenant(clientId) {
  __seed("wehowarePlaidItem", [
    {
      id: "pi1",
      clientId,
      itemId: "item-1",
      institutionName: "Bank One",
      accessTokenEnc: encryptSecret("at-1"),
      status: "Active",
    },
    {
      id: "pi-other",
      clientId: "OTHER",
      itemId: "item-other",
      institutionName: "Other",
      accessTokenEnc: encryptSecret("at-2"),
      status: "Active",
    },
  ]);
  __seed("wehowareBankAccount", [
    {
      id: "ba1",
      clientId,
      name: "Checking",
      mask: "0001",
      currency: "USD",
      plaidItemId: "item-1",
      plaidAccountId: "acc-1",
      isActive: true,
    },
  ]);
}

test("GET /api/v1/plaid/items returns only the active tenant's items + accounts", async () => {
  const { clientId } = seedAdmin();
  seedItemsForTenant(clientId);
  const req = makeRequest({ url: "http://test.local/api/v1/plaid/items" });
  const res = await GET(req, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].item_id, "item-1");
  assert.equal(body.data[0].bank_accounts.length, 1);
});

test("DELETE /api/v1/plaid/items disconnects the item and deactivates accounts", async () => {
  const { clientId } = seedAdmin();
  seedItemsForTenant(clientId);
  __setPlaidClientForTests({
    async itemRemove() {
      return { data: {} };
    },
  });
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/items?id=pi1",
    method: "DELETE",
  });
  const res = await DELETE(req, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);

  const item = await prisma.wehowarePlaidItem.findUnique({ where: { id: "pi1" } });
  assert.equal(item.status, "Disconnected");
  assert.equal(item.accessTokenEnc, "");
  const accounts = await prisma.wehowareBankAccount.findMany({ where: { plaidItemId: "item-1" } });
  assert.equal(accounts[0].isActive, false);

  __setPlaidClientForTests(null);
});

test("DELETE /api/v1/plaid/items 400 without id", async () => {
  seedAdmin();
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/items",
    method: "DELETE",
  });
  const res = await DELETE(req, {});
  assert.equal(res.status, 400);
});

test("DELETE /api/v1/plaid/items 404 when item belongs to another tenant", async () => {
  const { clientId } = seedAdmin();
  seedItemsForTenant(clientId);
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/items?id=pi-other",
    method: "DELETE",
  });
  const res = await DELETE(req, {});
  assert.equal(res.status, 404);
});

test("DELETE /api/v1/plaid/items still succeeds when Plaid itemRemove throws", async () => {
  const { clientId } = seedAdmin();
  seedItemsForTenant(clientId);
  __setPlaidClientForTests({
    async itemRemove() {
      throw new Error("plaid is down");
    },
  });
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/items?id=pi1",
    method: "DELETE",
  });
  const res = await DELETE(req, {});
  assert.equal(res.status, 200);
  const item = await prisma.wehowarePlaidItem.findUnique({ where: { id: "pi1" } });
  assert.equal(item.status, "Disconnected");
  __setPlaidClientForTests(null);
});

test("DELETE /api/v1/plaid/items rejects role=client", async () => {
  seedAdmin({ role: "client" });
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/items?id=pi1",
    method: "DELETE",
  });
  const res = await DELETE(req, {});
  assert.equal(res.status, 403);
});
