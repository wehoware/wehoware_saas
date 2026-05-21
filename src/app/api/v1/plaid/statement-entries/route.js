/**
 * GET /api/v1/plaid/statement-entries
 *
 * Paginated list of bank statement entries (the staging table that holds
 * Plaid/CSV transactions before reconciliation).  Phase 2 reconciliation
 * engine consumes this same data.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const VALID_RECON = ["Unreconciled", "Reconciled", "Partial", "Void"];

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

function serialize(entry) {
  return {
    id: entry.id,
    plaid_item_id: entry.plaidItemId,
    bank_account_id: entry.bankAccountId,
    source: entry.source,
    external_id: entry.externalId,
    posted_at: entry.postedAt,
    amount: Number(entry.amount),
    currency: entry.currency,
    description: entry.description,
    merchant_name: entry.merchantName,
    category: entry.category,
    pending: entry.pending,
    reconciliation: entry.reconciliation,
    matched_transaction_id: entry.matchedTransactionId,
    imported_at: entry.importedAt,
  };
}

export const GET = withAuth(async (request, _context) => {
  const { user } = request;
  const clientId = resolveClientId(user);
  if (!clientId) {
    return NextResponse.json(
      { error: "No active client resolved" },
      { status: 400 }
    );
  }
  const url = new URL(request.url);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(url.searchParams.get("page_size") || DEFAULT_PAGE_SIZE, 10))
  );
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10));
  const where = { clientId };
  const recon = url.searchParams.get("reconciliation");
  if (recon && VALID_RECON.includes(recon)) {
    where.reconciliation = recon;
  }
  const source = url.searchParams.get("source");
  if (source && ["Plaid", "CSV", "Manual"].includes(source)) {
    where.source = source;
  }

  const [total, rows] = await Promise.all([
    prisma.wehowareBankStatementEntry.count({ where }),
    prisma.wehowareBankStatementEntry.findMany({
      where,
      orderBy: [{ postedAt: "desc" }, { importedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json(
    {
      data: rows.map(serialize),
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
      },
    },
    { status: 200 }
  );
});
