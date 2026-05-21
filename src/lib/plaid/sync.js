/**
 * Plaid /transactions/sync driver.
 *
 * Flow per Plaid item:
 *   1. Decrypt access_token.
 *   2. Call transactions/sync with the stored cursor (or empty on first run).
 *   3. For each `added` or `modified` tx, upsert a WehowareBankStatementEntry
 *      keyed on (clientId, source="Plaid", externalId=tx.transaction_id).
 *   4. For each `removed` tx, mark the statement entry as Void (soft delete
 *      via reconciliation status, so we preserve history for reconciliation).
 *   5. Persist `next_cursor` and `lastSyncAt`.  Do this last so a retry re-
 *      runs from the last durable cursor.
 *
 * This function is idempotent:  Plaid guarantees a transaction_id is stable
 * within an item; our unique index on (clientId, source, externalId) means
 * re-delivery of the same tx results in an upsert, not a duplicate.
 */
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { getPlaidClient } from "./client";

/**
 * Run `transactions/sync` for a single Plaid item. Returns counters.
 * @param {object} opts
 * @param {string} opts.plaidItemId  row id of WehowarePlaidItem
 * @param {boolean} [opts.upsertBankAccounts=true] create bank account rows for new accounts
 */
export async function syncPlaidItem({ plaidItemId, upsertBankAccounts = true }) {
  if (!plaidItemId) throw new Error("syncPlaidItem: plaidItemId is required");

  const item = await prisma.wehowarePlaidItem.findUnique({
    where: { id: plaidItemId },
  });
  if (!item) throw new Error(`plaid item ${plaidItemId} not found`);
  if (item.status !== "Active") {
    return {
      skipped: true,
      reason: `status=${item.status}`,
      added: 0,
      modified: 0,
      removed: 0,
    };
  }

  const accessToken = decryptSecret(item.accessTokenEnc);
  if (!accessToken) {
    throw new Error(`plaid item ${plaidItemId}: missing access token`);
  }

  const plaid = await getPlaidClient();
  let cursor = item.syncCursor || undefined;
  let added = [];
  let modified = [];
  let removed = [];
  let hasMore = true;

  // Plaid returns at most 500 per call; keep paging until has_more=false
  while (hasMore) {
    const resp = await plaid.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500,
    });
    const data = resp.data || resp; // mock support (mock returns plain object)
    added = added.concat(data.added || []);
    modified = modified.concat(data.modified || []);
    removed = removed.concat(data.removed || []);
    cursor = data.next_cursor;
    hasMore = Boolean(data.has_more);
  }

  // Optionally auto-create bank account rows for new accounts
  if (upsertBankAccounts) {
    await upsertBankAccountsFromTransactions(item, [...added, ...modified]);
  }

  // Persist added/modified entries
  for (const tx of [...added, ...modified]) {
    await upsertStatementEntry(item, tx);
  }

  // Remove entries that Plaid marked as removed
  for (const r of removed) {
    await prisma.wehowareBankStatementEntry.updateMany({
      where: {
        clientId: item.clientId,
        source: "Plaid",
        externalId: r.transaction_id,
      },
      data: { reconciliation: "Void" },
    });
  }

  await prisma.wehowarePlaidItem.update({
    where: { id: item.id },
    data: {
      syncCursor: cursor ?? null,
      lastSyncAt: new Date(),
      errorCode: null,
      errorMessage: null,
    },
  });

  return {
    added: added.length,
    modified: modified.length,
    removed: removed.length,
  };
}

async function upsertBankAccountsFromTransactions(item, txs) {
  const byAccountId = new Map();
  for (const t of txs) {
    if (t.account_id && !byAccountId.has(t.account_id)) {
      byAccountId.set(t.account_id, t);
    }
  }
  for (const [accountId, sample] of byAccountId) {
    const existing = await prisma.wehowareBankAccount.findUnique({
      where: { plaidAccountId: accountId },
    });
    if (existing) continue;
    await prisma.wehowareBankAccount.create({
      data: {
        clientId: item.clientId,
        name:
          sample.account_name ||
          sample.merchant_name ||
          `Plaid ${accountId.slice(-4)}`,
        institutionName: item.institutionName,
        mask: sample.account_mask || null,
        currency: sample.iso_currency_code || "CAD",
        plaidItemId: item.itemId,
        plaidAccountId: accountId,
        isActive: true,
      },
    });
  }
}

async function upsertStatementEntry(item, tx) {
  // Plaid signs `amount` positive for outflows, negative for inflows.
  // We keep the same convention in the staging table for clarity.
  const amount = Number(tx.amount ?? 0);
  const postedAt = tx.date ? new Date(tx.date) : new Date();
  const bankAccount = tx.account_id
    ? await prisma.wehowareBankAccount.findUnique({
        where: { plaidAccountId: tx.account_id },
      })
    : null;

  const data = {
    clientId: item.clientId,
    plaidItemId: item.itemId,
    bankAccountId: bankAccount?.id ?? null,
    source: "Plaid",
    externalId: tx.transaction_id,
    postedAt,
    amount,
    currency: tx.iso_currency_code || "CAD",
    description: (tx.name || tx.merchant_name || "").slice(0, 500) || "—",
    merchantName: tx.merchant_name || null,
    category: Array.isArray(tx.category) ? tx.category.join(" / ") : tx.category || null,
    pending: Boolean(tx.pending),
    rawJson: tx,
  };

  // Manual upsert — can't use prisma.upsert cleanly because the uniqueness
  // is a compound index and the test mock handles updateMany/create.
  const existing = await prisma.wehowareBankStatementEntry.findFirst({
    where: {
      clientId: item.clientId,
      source: "Plaid",
      externalId: tx.transaction_id,
    },
  });
  if (existing) {
    await prisma.wehowareBankStatementEntry.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.wehowareBankStatementEntry.create({ data });
  }
}
