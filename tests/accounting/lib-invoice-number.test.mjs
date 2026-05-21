// Unit tests for src/lib/invoiceNumber.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_INVOICE_FORMAT,
  isValidInvoiceFormat,
  formatInvoiceNumber,
} from "@/lib/invoiceNumber";

test("DEFAULT_INVOICE_FORMAT matches documented default", () => {
  assert.equal(DEFAULT_INVOICE_FORMAT, "INV-{YYYY}-{XXXX}");
});

test("isValidInvoiceFormat enforces basic rules", () => {
  assert.equal(isValidInvoiceFormat("INV-{YYYY}-{XXXX}"), true);
  assert.equal(isValidInvoiceFormat("{X}"), true);
  assert.equal(isValidInvoiceFormat(""), false);
  assert.equal(isValidInvoiceFormat("   "), false);
  assert.equal(isValidInvoiceFormat("INV-{YYYY}-"), false); // missing X
  assert.equal(isValidInvoiceFormat(null), false);
  assert.equal(isValidInvoiceFormat(123), false);
  assert.equal(isValidInvoiceFormat("X".repeat(101)), false); // too long
});

test("formatInvoiceNumber substitutes date and sequence tokens", () => {
  const d = new Date(2026, 3, 25); // Apr 25 2026 (local)
  assert.equal(
    formatInvoiceNumber("INV-{YYYY}-{XXXX}", 42, d),
    "INV-2026-0042"
  );
  assert.equal(
    formatInvoiceNumber("{YY}{MM}{DD}-{XXX}", 5, d),
    "260425-005"
  );
  assert.equal(
    formatInvoiceNumber("{X}", 12345, d),
    "12345" // sequence overflows pad -> unpadded
  );
});

test("formatInvoiceNumber falls back to default for invalid format", () => {
  const d = new Date(2026, 0, 1);
  const result = formatInvoiceNumber("bad-format-no-placeholder", 1, d);
  assert.ok(result.startsWith("INV-2026-"));
});

test("formatInvoiceNumber clamps sequence to positive integers", () => {
  const d = new Date(2026, 0, 1);
  assert.equal(formatInvoiceNumber("{XXX}", -1, d), "001");
  assert.equal(formatInvoiceNumber("{XXX}", 0, d), "001");
  assert.equal(formatInvoiceNumber("{XXX}", NaN, d), "001");
  assert.equal(formatInvoiceNumber("{XXX}", 2.9, d), "002");
});
