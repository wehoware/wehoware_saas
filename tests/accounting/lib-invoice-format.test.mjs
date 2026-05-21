// Unit tests for src/lib/invoiceFormat.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatInvoiceDate,
  toIsoDateOnly,
  formatCurrency,
} from "@/lib/invoiceFormat";

test("formatInvoiceDate renders ISO date-only as local date without TZ shift", () => {
  // The same ISO date string should render identically in any timezone.
  assert.equal(formatInvoiceDate("2026-04-25"), "4/25/2026");
});

test("formatInvoiceDate accepts full ISO timestamps and Date objects", () => {
  assert.equal(formatInvoiceDate("2026-04-25T00:00:00Z"), "4/25/2026");
  assert.equal(
    formatInvoiceDate(new Date(Date.UTC(2026, 3, 25))),
    "4/25/2026"
  );
});

test("formatInvoiceDate returns placeholder for empty/invalid", () => {
  assert.equal(formatInvoiceDate(""), "—");
  assert.equal(formatInvoiceDate(null), "—");
  assert.equal(formatInvoiceDate(undefined), "—");
  assert.equal(formatInvoiceDate("not-a-date"), "—");
  assert.equal(formatInvoiceDate(42), "—"); // numeric rejected
});

test("toIsoDateOnly normalises input", () => {
  assert.equal(toIsoDateOnly("2026-04-25"), "2026-04-25"); // already
  assert.equal(toIsoDateOnly("2026-04-25T10:30:00Z"), "2026-04-25");
  assert.equal(
    toIsoDateOnly(new Date(Date.UTC(2026, 3, 25))),
    "2026-04-25"
  );
  assert.equal(toIsoDateOnly(""), "");
  assert.equal(toIsoDateOnly("junk"), "");
});

test("formatCurrency trims when currency is empty", () => {
  assert.equal(formatCurrency(100, "USD"), "USD 100.00");
  assert.equal(formatCurrency(100), "100.00");
  assert.equal(formatCurrency("abc", "USD"), "USD 0.00");
});
