// Integration tests for /api/v1/invoices and /api/v1/invoices/[id]
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET as listInvoices, POST as createInvoice } from "@/app/api/v1/invoices/route";
import {
  GET as getInvoice,
  PUT as updateInvoice,
  DELETE as deleteInvoice,
} from "@/app/api/v1/invoices/[id]/route";
import { makeRequest, seedAdmin, expectStatus, prisma, __seed } from "../harness.mjs";

function baseInvoiceBody(overrides = {}) {
  return {
    client_name: "Bob Buyer",
    client_email: "bob@x.com",
    invoice_date: "2026-04-01",
    due_date: "2026-05-01",
    tax_rate: 10,
    currency: "CAD",
    line_items: [{ description: "Service", quantity: 1, unit_price: 100 }],
    ...overrides,
  };
}

test("invoices POST: requires client_name", async () => {
  seedAdmin();
  const body = baseInvoiceBody();
  delete body.client_name;
  const res = await createInvoice(makeRequest({ method: "POST", body }), {});
  expectStatus(res, 400);
});

test("invoices POST: rejects invalid invoice_date", async () => {
  seedAdmin();
  const res = await createInvoice(
    makeRequest({ method: "POST", body: baseInvoiceBody({ invoice_date: "bad" }) }),
    {}
  );
  expectStatus(res, 400);
});

test("invoices POST: rejects invalid status", async () => {
  seedAdmin();
  const res = await createInvoice(
    makeRequest({ method: "POST", body: baseInvoiceBody({ status: "Bogus" }) }),
    {}
  );
  expectStatus(res, 400);
});

test("invoices POST: computes totals and bumps sequence", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInvoiceSettings", [
    { id: "s1", clientId, invoiceFormat: "INV-{YYYY}-{XXXX}", nextInvoiceNumber: 5 },
  ]);
  const res = await createInvoice(
    makeRequest({ method: "POST", body: baseInvoiceBody() }),
    {}
  );
  expectStatus(res, 201);
  const body = await res.json();
  assert.equal(body.subtotal, 100);
  assert.equal(body.tax_amount, 10);
  assert.equal(body.total, 110);
  assert.match(body.invoice_number, /INV-\d{4}-0005/);
  const settings = await prisma.wehowareInvoiceSettings.findUnique({
    where: { clientId },
  });
  assert.equal(settings.nextInvoiceNumber, 6);
});

test("invoices POST: auto-creates settings row on first invoice", async () => {
  const { clientId } = seedAdmin();
  const res = await createInvoice(
    makeRequest({ method: "POST", body: baseInvoiceBody() }),
    {}
  );
  expectStatus(res, 201);
  const settings = await prisma.wehowareInvoiceSettings.findUnique({
    where: { clientId },
  });
  assert.ok(settings);
  assert.equal(settings.nextInvoiceNumber, 2);
});

test("invoices GET: valid status filter narrows results", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInvoice", [
    { id: "i1", clientId, invoiceNumber: "1", clientName: "A", status: "Draft", total: 100, subtotal: 100, taxAmount: 0, taxRate: 0, invoiceDate: new Date(), dueDate: new Date() },
    { id: "i2", clientId, invoiceNumber: "2", clientName: "B", status: "Paid", total: 100, subtotal: 100, taxAmount: 0, taxRate: 0, invoiceDate: new Date(), dueDate: new Date() },
  ]);
  const res = await listInvoices(
    makeRequest({ url: "http://t/api/v1/invoices?status=Paid" }),
    {}
  );
  const body = await res.json();
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].status, "Paid");
});

test("invoices GET: ignores invalid status value", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInvoice", [
    { id: "i1", clientId, invoiceNumber: "1", clientName: "A", status: "Draft", total: 100, subtotal: 100, taxAmount: 0, taxRate: 0, invoiceDate: new Date(), dueDate: new Date() },
  ]);
  const res = await listInvoices(
    makeRequest({ url: "http://t/api/v1/invoices?status=Bogus" }),
    {}
  );
  // Previously this would error because we passed the string straight to
  // Prisma. With the validated GET handler the bad filter is ignored.
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.data.length, 1);
});

test("invoices PUT: recomputes total when only tax_rate changes", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInvoice", [
    { id: "i1", clientId, invoiceNumber: "1", clientName: "A", status: "Draft", subtotal: 200, taxRate: 0, taxAmount: 0, total: 200, invoiceDate: new Date(), dueDate: new Date() },
  ]);
  const res = await updateInvoice(
    makeRequest({ method: "PUT", body: { tax_rate: 15 } }),
    { params: Promise.resolve({ id: "i1" }) }
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.tax_rate, 15);
  assert.equal(body.tax_amount, 30);
  assert.equal(body.total, 230);
});

test("invoices PUT: replaces line_items when provided", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInvoice", [
    { id: "i1", clientId, invoiceNumber: "1", clientName: "A", status: "Draft", subtotal: 100, taxRate: 0, taxAmount: 0, total: 100, invoiceDate: new Date(), dueDate: new Date() },
  ]);
  __seed("wehowareInvoiceLineItem", [
    { id: "li-old", invoiceId: "i1", clientId, description: "Old", quantity: 1, unitPrice: 100, total: 100, sortOrder: 0 },
  ]);
  const res = await updateInvoice(
    makeRequest({
      method: "PUT",
      body: {
        line_items: [
          { description: "New A", quantity: 2, unit_price: 25 },
          { description: "New B", quantity: 1, unit_price: 50 },
        ],
      },
    }),
    { params: Promise.resolve({ id: "i1" }) }
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.subtotal, 100);
  assert.equal(body.line_items.length, 2);
  assert.equal(body.line_items[0].description, "New A");
});

test("invoices DELETE: cascades line items", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareInvoice", [
    { id: "i1", clientId, invoiceNumber: "1", clientName: "A", status: "Draft", subtotal: 100, taxRate: 0, taxAmount: 0, total: 100, invoiceDate: new Date(), dueDate: new Date() },
  ]);
  __seed("wehowareInvoiceLineItem", [
    { id: "li1", invoiceId: "i1", clientId, description: "X", quantity: 1, unitPrice: 100, total: 100, sortOrder: 0 },
  ]);
  const res = await deleteInvoice(
    makeRequest({ method: "DELETE" }),
    { params: Promise.resolve({ id: "i1" }) }
  );
  expectStatus(res, 200);
  const remaining = await prisma.wehowareInvoiceLineItem.count({
    where: { invoiceId: "i1" },
  });
  assert.equal(remaining, 0);
});

test("invoices GET single: tenant isolation", async () => {
  seedAdmin();
  __seed("wehowareInvoice", [
    { id: "i1", clientId: "other", invoiceNumber: "1", clientName: "A", status: "Draft", subtotal: 0, taxRate: 0, taxAmount: 0, total: 0, invoiceDate: new Date(), dueDate: new Date() },
  ]);
  const res = await getInvoice(
    makeRequest({}),
    { params: Promise.resolve({ id: "i1" }) }
  );
  expectStatus(res, 404);
});
