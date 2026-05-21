import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderTemplate,
  hasTemplate,
  listTemplates,
} from "@/lib/email/templates";

test("listTemplates exposes all known templates", () => {
  const names = listTemplates();
  for (const expected of [
    "invoice.created",
    "invoice.reminder.due",
    "invoice.reminder.overdue",
    "bill.reminder.due",
    "bill.reminder.overdue",
    "generic",
  ]) {
    assert.ok(names.includes(expected), `missing template ${expected}`);
  }
});

test("hasTemplate returns false for unknown templates", () => {
  assert.equal(hasTemplate("does.not.exist"), false);
  assert.equal(hasTemplate("invoice.created"), true);
});

test("renderTemplate throws on unknown template", () => {
  assert.throws(() => renderTemplate("nope"), /Unknown email template/);
});

test("invoice.created renders subject + html + text and formats money", () => {
  const r = renderTemplate("invoice.created", {
    invoice_number: "INV-2026-0001",
    client_name: "Bob",
    total: 1234.5,
    currency: "USD",
    due_date: "2026-05-30",
    portal_url: "https://example.com/inv/1",
  });
  assert.match(r.subject, /INV-2026-0001/);
  assert.match(r.subject, /\$1,234\.50/);
  assert.match(r.html, /Bob/);
  assert.match(r.html, /https:\/\/example\.com\/inv\/1/);
  assert.match(r.text, /INV-2026-0001/);
});

test("invoice.created escapes hostile HTML in client_name", () => {
  const r = renderTemplate("invoice.created", {
    invoice_number: "INV-1",
    client_name: '<script>alert("xss")</script>',
    total: 100,
    currency: "USD",
    due_date: "2026-01-01",
  });
  assert.doesNotMatch(r.html, /<script>/);
  assert.match(r.html, /&lt;script&gt;/);
});

test("invoice.reminder.overdue includes day count + amount due", () => {
  const r = renderTemplate("invoice.reminder.overdue", {
    invoice_number: "INV-2",
    client_name: "Carol",
    amount_due: 500,
    currency: "CAD",
    days_overdue: 14,
  });
  assert.match(r.subject, /14 days past due/);
  assert.match(r.html, /14 days overdue/);
});

test("bill.reminder.due renders vendor name and due date", () => {
  const r = renderTemplate("bill.reminder.due", {
    bill_number: "BILL-1",
    vendor_name: "Acme Corp",
    amount_due: 250,
    currency: "USD",
    due_date: "2026-02-01",
  });
  assert.match(r.subject, /Acme Corp/);
  assert.match(r.html, /Acme Corp/);
  assert.match(r.html, /2026-02-01/);
});

test("generic template uses provided subject + text", () => {
  const r = renderTemplate("generic", {
    subject: "Test",
    text: "Hello\nWorld",
  });
  assert.equal(r.subject, "Test");
  assert.match(r.html, /Hello<br>World/);
});

test("money() falls back to em-dash for non-numeric values", () => {
  const r = renderTemplate("invoice.created", {
    invoice_number: "X",
    client_name: "Y",
    total: "not-a-number",
    currency: "USD",
    due_date: "2026-01-01",
  });
  assert.match(r.subject, /—/);
});
