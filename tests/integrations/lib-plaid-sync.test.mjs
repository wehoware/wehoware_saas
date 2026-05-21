import { test } from "node:test";
import assert from "node:assert/strict";
import { syncPlaidItem } from "@/lib/plaid/sync";
import { __setPlaidClientForTests } from "@/lib/plaid/client";
import { encryptSecret } from "@/lib/crypto";
import { __reset, __seed, prisma } from "../mocks/prisma.mjs";

function seedItem({
  id = "pi1",
  clientId = "c1",
  itemId = "item-1",
  status = "Active",
  syncCursor = null,
  accessToken = "test-access-token",
} = {}) {
  __reset();
  __seed("wehowareClient", [{ id: clientId, name: "Acme" }]);
  __seed("wehowarePlaidItem", [
    {
      id,
      clientId,
      itemId,
      institutionName: "TestBank",
      accessTokenEnc: encryptSecret(accessToken),
      status,
      syncCursor,
    },
  ]);
  return { id, clientId, itemId };
}

function fakePlaid({ pages }) {
  let i = 0;
  return {
    async transactionsSync() {
      const page = pages[i] ?? { added: [], modified: [], removed: [], next_cursor: "end", has_more: false };
      i += 1;
      return { data: page };
    },
    async itemRemove() {
      return { data: {} };
    },
  };
}

test("syncPlaidItem inserts added transactions and creates bank accounts", async () => {
  const { id, clientId } = seedItem();
  __setPlaidClientForTests(
    fakePlaid({
      pages: [
        {
          added: [
            {
              transaction_id: "t1",
              account_id: "acc-A",
              date: "2026-01-15",
              amount: 50.25,
              name: "Coffee",
              merchant_name: "Coffee Co",
              iso_currency_code: "USD",
              category: ["Food", "Coffee"],
              pending: false,
            },
          ],
          modified: [],
          removed: [],
          next_cursor: "c2",
          has_more: false,
        },
      ],
    })
  );

  const res = await syncPlaidItem({ plaidItemId: id });
  assert.deepEqual(res, { added: 1, modified: 0, removed: 0 });

  const entries = await prisma.wehowareBankStatementEntry.findMany({});
  assert.equal(entries.length, 1);
  assert.equal(entries[0].externalId, "t1");
  assert.equal(entries[0].clientId, clientId);
  assert.equal(entries[0].source, "Plaid");
  assert.equal(entries[0].amount, 50.25);
  assert.equal(entries[0].category, "Food / Coffee");

  const accounts = await prisma.wehowareBankAccount.findMany({});
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].plaidAccountId, "acc-A");

  const item = await prisma.wehowarePlaidItem.findUnique({ where: { id } });
  assert.equal(item.syncCursor, "c2");
  assert.ok(item.lastSyncAt);

  __setPlaidClientForTests(null);
});

test("syncPlaidItem upserts on re-delivery without duplicating rows", async () => {
  const { id } = seedItem();
  __setPlaidClientForTests(
    fakePlaid({
      pages: [
        {
          added: [
            {
              transaction_id: "t1",
              account_id: "acc-A",
              date: "2026-01-15",
              amount: 10,
              name: "First",
              iso_currency_code: "USD",
            },
          ],
          modified: [],
          removed: [],
          next_cursor: "c1",
          has_more: false,
        },
      ],
    })
  );
  await syncPlaidItem({ plaidItemId: id });

  // Simulate re-delivery as a modification
  __setPlaidClientForTests(
    fakePlaid({
      pages: [
        {
          added: [],
          modified: [
            {
              transaction_id: "t1",
              account_id: "acc-A",
              date: "2026-01-15",
              amount: 12.5,
              name: "First (corrected)",
              iso_currency_code: "USD",
            },
          ],
          removed: [],
          next_cursor: "c2",
          has_more: false,
        },
      ],
    })
  );
  await syncPlaidItem({ plaidItemId: id });

  const entries = await prisma.wehowareBankStatementEntry.findMany({});
  assert.equal(entries.length, 1, "should not duplicate");
  assert.equal(entries[0].amount, 12.5);
  assert.equal(entries[0].description, "First (corrected)");

  __setPlaidClientForTests(null);
});

test("syncPlaidItem voids removed transactions", async () => {
  const { id } = seedItem();
  __setPlaidClientForTests(
    fakePlaid({
      pages: [
        {
          added: [
            { transaction_id: "t1", account_id: "acc-A", date: "2026-01-15", amount: 10, name: "X", iso_currency_code: "USD" },
            { transaction_id: "t2", account_id: "acc-A", date: "2026-01-16", amount: 20, name: "Y", iso_currency_code: "USD" },
          ],
          modified: [],
          removed: [],
          next_cursor: "c1",
          has_more: false,
        },
      ],
    })
  );
  await syncPlaidItem({ plaidItemId: id });

  __setPlaidClientForTests(
    fakePlaid({
      pages: [
        {
          added: [],
          modified: [],
          removed: [{ transaction_id: "t1" }],
          next_cursor: "c2",
          has_more: false,
        },
      ],
    })
  );
  await syncPlaidItem({ plaidItemId: id });

  const t1 = await prisma.wehowareBankStatementEntry.findFirst({ where: { externalId: "t1" } });
  const t2 = await prisma.wehowareBankStatementEntry.findFirst({ where: { externalId: "t2" } });
  assert.equal(t1.reconciliation, "Void");
  assert.equal(t2.reconciliation, "Unreconciled");

  __setPlaidClientForTests(null);
});

test("syncPlaidItem follows pagination via has_more", async () => {
  const { id } = seedItem();
  __setPlaidClientForTests(
    fakePlaid({
      pages: [
        {
          added: [{ transaction_id: "t1", account_id: "a", date: "2026-01-01", amount: 1, name: "n", iso_currency_code: "USD" }],
          modified: [],
          removed: [],
          next_cursor: "c-mid",
          has_more: true,
        },
        {
          added: [{ transaction_id: "t2", account_id: "a", date: "2026-01-02", amount: 2, name: "n", iso_currency_code: "USD" }],
          modified: [],
          removed: [],
          next_cursor: "c-end",
          has_more: false,
        },
      ],
    })
  );
  const res = await syncPlaidItem({ plaidItemId: id });
  assert.equal(res.added, 2);
  const item = await prisma.wehowarePlaidItem.findUnique({ where: { id } });
  assert.equal(item.syncCursor, "c-end");
  __setPlaidClientForTests(null);
});

test("syncPlaidItem skips items not in Active status", async () => {
  const { id } = seedItem({ status: "RequiresReauth" });
  __setPlaidClientForTests(fakePlaid({ pages: [] }));
  const res = await syncPlaidItem({ plaidItemId: id });
  assert.equal(res.skipped, true);
  assert.match(res.reason, /RequiresReauth/);
  __setPlaidClientForTests(null);
});

test("syncPlaidItem rejects unknown plaidItemId", async () => {
  __reset();
  await assert.rejects(
    () => syncPlaidItem({ plaidItemId: "nope" }),
    /not found/
  );
});

test("syncPlaidItem requires plaidItemId arg", async () => {
  await assert.rejects(
    () => syncPlaidItem({}),
    /plaidItemId is required/
  );
});
