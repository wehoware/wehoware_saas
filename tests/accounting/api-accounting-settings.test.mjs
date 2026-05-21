// Integration tests for /api/v1/accounting-settings and /api/v1/invoice-settings
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GET as getAccountingSettings,
  PUT as putAccountingSettings,
} from "@/app/api/v1/accounting-settings/route";
import {
  GET as getInvoiceSettings,
  PUT as putInvoiceSettings,
} from "@/app/api/v1/invoice-settings/route";
import { makeRequest, seedAdmin, expectStatus } from "../harness.mjs";

test("accounting-settings GET: auto-creates defaults", async () => {
  seedAdmin();
  const res = await getAccountingSettings(makeRequest({}), {});
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.default_currency, "CAD");
  assert.equal(body.bill_number_format, "BILL-{YYYY}-{XXXX}");
  assert.equal(body.next_bill_number, 1);
});

test("accounting-settings PUT: rejects tax rate > 100", async () => {
  seedAdmin();
  const res = await putAccountingSettings(
    makeRequest({ method: "PUT", body: { default_tax_rate: 150 } }),
    {}
  );
  expectStatus(res, 400);
});

test("accounting-settings PUT: rejects invalid fiscal year", async () => {
  seedAdmin();
  const res = await putAccountingSettings(
    makeRequest({ method: "PUT", body: { fiscal_year_start: 13 } }),
    {}
  );
  expectStatus(res, 400);
});

test("accounting-settings PUT: rejects bill_number_format missing {X+}", async () => {
  seedAdmin();
  const res = await putAccountingSettings(
    makeRequest({ method: "PUT", body: { bill_number_format: "BILL-{YYYY}" } }),
    {}
  );
  expectStatus(res, 400);
});

test("accounting-settings PUT: accepts valid update", async () => {
  seedAdmin();
  const res = await putAccountingSettings(
    makeRequest({
      method: "PUT",
      body: {
        default_currency: "USD",
        default_tax_rate: 5,
        fiscal_year_start: 4,
        reminder_enabled: true,
        reminder_days_before: 14,
      },
    }),
    {}
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.default_currency, "USD");
  assert.equal(Number(body.default_tax_rate), 5);
  assert.equal(body.fiscal_year_start, 4);
  assert.equal(body.reminder_enabled, true);
  assert.equal(body.reminder_days_before, 14);
});

test("invoice-settings GET: auto-creates and returns defaults", async () => {
  seedAdmin();
  const res = await getInvoiceSettings(makeRequest({}), {});
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.invoice_format, "INV-{YYYY}-{XXXX}");
  assert.equal(body.next_invoice_number, 1);
  assert.equal(body.default_currency, "CAD");
});

test("invoice-settings PUT: rejects invalid template_id", async () => {
  seedAdmin();
  const res = await putInvoiceSettings(
    makeRequest({ method: "PUT", body: { template_id: "bogus" } }),
    {}
  );
  expectStatus(res, 400);
});

test("invoice-settings PUT: rejects invalid invoice_format", async () => {
  seedAdmin();
  const res = await putInvoiceSettings(
    makeRequest({
      method: "PUT",
      body: { invoice_format: "bad-format-no-placeholder" },
    }),
    {}
  );
  expectStatus(res, 400);
});

test("invoice-settings PUT: rejects tax_rate > 100", async () => {
  seedAdmin();
  const res = await putInvoiceSettings(
    makeRequest({ method: "PUT", body: { default_tax_rate: 150 } }),
    {}
  );
  expectStatus(res, 400);
});

test("invoice-settings PUT: rejects next_invoice_number < 1", async () => {
  seedAdmin();
  const res = await putInvoiceSettings(
    makeRequest({ method: "PUT", body: { next_invoice_number: 0 } }),
    {}
  );
  expectStatus(res, 400);
});

test("invoice-settings PUT: accepts valid partial update", async () => {
  seedAdmin();
  const res = await putInvoiceSettings(
    makeRequest({
      method: "PUT",
      body: {
        company_name: "Acme Inc",
        default_currency: "USD",
        template_id: "modern",
      },
    }),
    {}
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.company_name, "Acme Inc");
  assert.equal(body.default_currency, "USD");
  assert.equal(body.template_id, "modern");
});
