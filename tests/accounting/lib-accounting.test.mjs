// Unit tests for src/lib/accounting.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNTING_DEFAULT_CURRENCY,
  BILL_STATUSES,
  BILL_STATUS_DB_TO_LABEL,
  BILL_STATUS_LABEL_TO_DB,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_DB_TO_LABEL,
  EXPENSE_CATEGORY_LABEL_TO_DB,
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
  formatMoney,
  computeLineItemTotals,
  buildLineItemRows,
  formatBillNumber,
  deriveBillStatus,
  parseDateInput,
} from "@/lib/accounting";

test("accounting constants are shaped as expected", () => {
  assert.equal(ACCOUNTING_DEFAULT_CURRENCY, "CAD");
  assert.deepEqual(BILL_STATUSES, [
    "Draft",
    "Open",
    "Partially Paid",
    "Paid",
    "Overdue",
    "Void",
  ]);
  assert.equal(BILL_STATUS_DB_TO_LABEL.PartiallyPaid, "Partially Paid");
  assert.equal(BILL_STATUS_LABEL_TO_DB["Partially Paid"], "PartiallyPaid");
  assert.equal(EXPENSE_CATEGORY_DB_TO_LABEL.OfficeSupplies, "Office Supplies");
  assert.equal(EXPENSE_CATEGORY_LABEL_TO_DB["Office Supplies"], "OfficeSupplies");
  assert.deepEqual(EXPENSE_STATUSES, ["Pending", "Approved", "Rejected", "Reimbursed"]);
  assert.ok(EXPENSE_CATEGORIES.includes("Other"));
  assert.ok(PAYMENT_METHODS.includes("Bank Transfer"));
});

test("formatMoney formats positive, zero, negative, and strings", () => {
  assert.equal(formatMoney(100), "CAD 100.00");
  assert.equal(formatMoney(1234.5), "CAD 1234.50");
  assert.equal(formatMoney(0), "CAD 0.00");
  assert.equal(formatMoney(-50.25), "CAD -50.25");
  assert.equal(formatMoney("42.7"), "CAD 42.70");
  assert.equal(formatMoney(null), "CAD 0.00");
  assert.equal(formatMoney(undefined), "CAD 0.00");
  assert.equal(formatMoney(NaN), "CAD 0.00");
  assert.equal(formatMoney(100, "USD"), "USD 100.00");
});

test("computeLineItemTotals handles empty, zero-tax, multi-line, decimals", () => {
  assert.deepEqual(computeLineItemTotals([], 0), {
    subtotal: 0,
    taxAmount: 0,
    total: 0,
  });

  assert.deepEqual(
    computeLineItemTotals(
      [
        { quantity: 2, unit_price: 10 },
        { quantity: 1, unit_price: 5 },
      ],
      10
    ),
    { subtotal: 25, taxAmount: 2.5, total: 27.5 }
  );

  // supports camelCase
  assert.deepEqual(
    computeLineItemTotals([{ quantity: 3, unitPrice: 7 }], 0),
    { subtotal: 21, taxAmount: 0, total: 21 }
  );

  // coerces string numbers
  assert.deepEqual(
    computeLineItemTotals([{ quantity: "2", unit_price: "5" }], "10"),
    { subtotal: 10, taxAmount: 1, total: 11 }
  );

  // null/undefined lineItems default to empty
  assert.deepEqual(computeLineItemTotals(null, 0), {
    subtotal: 0,
    taxAmount: 0,
    total: 0,
  });
  assert.deepEqual(computeLineItemTotals(undefined, 0), {
    subtotal: 0,
    taxAmount: 0,
    total: 0,
  });
});

test("buildLineItemRows generates positional sort_order", () => {
  const rows = buildLineItemRows(
    [
      { description: "A", quantity: 1, unit_price: 10 },
      { description: "B", quantity: 2, unit_price: 5 },
    ],
    "bill-1",
    "billId",
    "client-1"
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    billId: "bill-1",
    clientId: "client-1",
    description: "A",
    quantity: 1,
    unitPrice: 10,
    total: 10,
    sortOrder: 0,
  });
  assert.equal(rows[1].sortOrder, 1);
  assert.equal(rows[1].total, 10);
});

test("buildLineItemRows defaults missing fields sensibly", () => {
  const rows = buildLineItemRows(
    [{}, { quantity: "3", unit_price: "2.5" }],
    "parent",
    "billId",
    "client"
  );
  assert.equal(rows[0].quantity, 1); // default
  assert.equal(rows[0].unitPrice, 0);
  assert.equal(rows[0].description, "");
  assert.equal(rows[1].total, 7.5);
});

test("formatBillNumber substitutes tokens and pads sequence", () => {
  const d = new Date("2026-04-25T00:00:00Z");
  assert.equal(formatBillNumber("BILL-{YYYY}-{XXXX}", 7, d), "BILL-2026-0007");
  assert.equal(formatBillNumber("B{MM}-{XXX}", 42, d), "B04-042");
  assert.equal(formatBillNumber("{YYYY}-{MM}-{XXXXXX}", 1, d), "2026-04-000001");
  // falls back to default if format is empty
  assert.ok(formatBillNumber("", 5, d).includes("BILL-"));
});

test("deriveBillStatus preserves Draft/Void and calculates from totals", () => {
  assert.equal(
    deriveBillStatus({ total: 100, amountPaid: 0, dueDate: null, currentStatus: "Draft" }),
    "Draft"
  );
  assert.equal(
    deriveBillStatus({ total: 100, amountPaid: 100, dueDate: null, currentStatus: "Void" }),
    "Void"
  );
  // Unpaid, not overdue -> Open
  assert.equal(
    deriveBillStatus({
      total: 100,
      amountPaid: 0,
      dueDate: new Date(Date.now() + 86_400_000),
      currentStatus: "Open",
    }),
    "Open"
  );
  // Unpaid, overdue -> Overdue
  assert.equal(
    deriveBillStatus({
      total: 100,
      amountPaid: 0,
      dueDate: new Date(Date.now() - 86_400_000),
      currentStatus: "Open",
    }),
    "Overdue"
  );
  // Partially paid -> PartiallyPaid
  assert.equal(
    deriveBillStatus({
      total: 100,
      amountPaid: 40,
      dueDate: null,
      currentStatus: "Open",
    }),
    "PartiallyPaid"
  );
  // Fully paid -> Paid
  assert.equal(
    deriveBillStatus({
      total: 100,
      amountPaid: 100,
      dueDate: null,
      currentStatus: "Open",
    }),
    "Paid"
  );
  // Paid over — still Paid
  assert.equal(
    deriveBillStatus({
      total: 100,
      amountPaid: 150,
      dueDate: null,
      currentStatus: "Open",
    }),
    "Paid"
  );
});

test("parseDateInput handles ISO-date, ISO-datetime, rejects bad input", () => {
  const d1 = parseDateInput("2026-04-25");
  assert.ok(d1 instanceof Date && !Number.isNaN(d1.getTime()));
  const d2 = parseDateInput("2026-04-25T10:30:00Z");
  assert.ok(d2 instanceof Date && !Number.isNaN(d2.getTime()));
  assert.equal(parseDateInput(""), null);
  assert.equal(parseDateInput(null), null);
  assert.equal(parseDateInput(undefined), null);
  assert.equal(parseDateInput("not-a-date"), null);
  assert.equal(parseDateInput("0001-01-01"), null); // year < 1000 rejected
});
