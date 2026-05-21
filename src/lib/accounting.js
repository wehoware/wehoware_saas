/**
 * Shared accounting utilities used by API routes and UI.
 *
 * Keep this module pure (no I/O) so it can be imported safely from
 * both server and client code.
 */

export const ACCOUNTING_DEFAULT_CURRENCY = "CAD";

export const BILL_STATUSES = [
  "Draft",
  "Open",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Void",
];

// DB enum value -> display label (Prisma maps "PartiallyPaid" -> "Partially Paid")
export const BILL_STATUS_DB_TO_LABEL = {
  Draft: "Draft",
  Open: "Open",
  PartiallyPaid: "Partially Paid",
  Paid: "Paid",
  Overdue: "Overdue",
  Void: "Void",
};

export const BILL_STATUS_LABEL_TO_DB = Object.fromEntries(
  Object.entries(BILL_STATUS_DB_TO_LABEL).map(([db, label]) => [label, db])
);

export const EXPENSE_CATEGORIES = [
  "Travel",
  "Meals",
  "Office Supplies",
  "Software",
  "Hardware",
  "Marketing",
  "Professional Services",
  "Utilities",
  "Rent",
  "Other",
];

export const EXPENSE_CATEGORY_DB_TO_LABEL = {
  Travel: "Travel",
  Meals: "Meals",
  OfficeSupplies: "Office Supplies",
  Software: "Software",
  Hardware: "Hardware",
  Marketing: "Marketing",
  ProfessionalServices: "Professional Services",
  Utilities: "Utilities",
  Rent: "Rent",
  Other: "Other",
};

export const EXPENSE_CATEGORY_LABEL_TO_DB = Object.fromEntries(
  Object.entries(EXPENSE_CATEGORY_DB_TO_LABEL).map(([db, label]) => [label, db])
);

export const EXPENSE_STATUSES = ["Pending", "Approved", "Rejected", "Reimbursed"];

export const PAYMENT_METHODS = [
  "Bank Transfer",
  "Credit Card",
  "Cheque",
  "Cash",
  "E-Transfer",
  "Other",
];

export const TRANSACTION_DIRECTIONS = ["Incoming", "Outgoing"];
export const TRANSACTION_SOURCES = ["Manual", "BankFeed", "Stripe", "Import", "Other"];
export const RECONCILIATION_STATUSES = [
  "Unreconciled",
  "PartiallyMatched",
  "Reconciled",
];

/**
 * Format a money number for display.
 */
export function formatMoney(amount, currency = ACCOUNTING_DEFAULT_CURRENCY) {
  const value = Number(amount) || 0;
  return `${currency} ${value.toFixed(2)}`;
}

/**
 * Compute totals for a list of line items with quantity + unit_price.
 * Same algorithm used by invoices and bills so behaviour stays consistent.
 */
export function computeLineItemTotals(lineItems, taxRate) {
  const subtotal = (lineItems || []).reduce((sum, li) => {
    const quantity = Number(li.quantity) || 0;
    const unitPrice = Number(li.unit_price ?? li.unitPrice) || 0;
    return sum + quantity * unitPrice;
  }, 0);
  const taxAmount = (subtotal * (Number(taxRate) || 0)) / 100;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

/**
 * Build the line-item create-many payload with positional sort_order.
 */
export function buildLineItemRows(lineItems, parentId, parentForeignKey, clientId) {
  return (lineItems || []).map((li, idx) => {
    const qty = Number(li.quantity) || 1;
    const unitPrice = Number(li.unit_price ?? li.unitPrice) || 0;
    return {
      [parentForeignKey]: parentId,
      clientId,
      description: li.description ?? "",
      quantity: qty,
      unitPrice,
      total: qty * unitPrice,
      sortOrder: idx,
    };
  });
}

/**
 * Format a bill number using a tokenised pattern.
 *   {YYYY} -> 4-digit year
 *   {MM}   -> 2-digit month
 *   {XXXX} -> zero-padded sequence number (length = number of X's)
 */
export function formatBillNumber(format, sequence, date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return (format || "BILL-{YYYY}-{XXXX}")
    .replace("{YYYY}", year)
    .replace("{MM}", month)
    .replace(/\{X+\}/, (match) => {
      const padLength = match.length - 2;
      return String(sequence).padStart(padLength, "0");
    });
}

/**
 * Decide bill status from current totals + payments.
 * Centralised so reconciliation logic stays consistent.
 */
export function deriveBillStatus({ total, amountPaid, dueDate, currentStatus }) {
  if (currentStatus === "Void" || currentStatus === "Draft") {
    return currentStatus;
  }
  const totalNum = Number(total) || 0;
  const paidNum = Number(amountPaid) || 0;
  if (paidNum <= 0) {
    if (dueDate && new Date(dueDate) < startOfToday()) return "Overdue";
    return "Open";
  }
  if (paidNum >= totalNum) return "Paid";
  return "PartiallyPaid";
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Parse an ISO/yyyy-mm-dd date string to a Date, returns null if invalid.
 */
export function parseDateInput(dateStr) {
  if (!dateStr) return null;
  const normalized = String(dateStr).includes("T")
    ? dateStr
    : `${dateStr}T00:00:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getUTCFullYear() < 1000) return null;
  return parsed;
}
