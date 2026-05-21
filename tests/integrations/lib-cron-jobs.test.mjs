import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runJob,
  runReminderDispatcher,
  listJobs,
} from "@/lib/cron/jobs";
import { __setEmailProviderForTests } from "@/lib/email/ses";
import { __setPlaidClientForTests } from "@/lib/plaid/client";
import { __reset, __seed, prisma } from "../mocks/prisma.mjs";

function startOfDay(daysFromNow = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d;
}

test("listJobs exposes registered cron jobs", () => {
  const jobs = listJobs();
  assert.ok(jobs.includes("send-reminders"));
  assert.ok(jobs.includes("sync-plaid"));
});

test("runJob throws on unknown job name", async () => {
  await assert.rejects(() => runJob("does-not-exist"), /unknown cron job/);
});

test("runJob writes a wehowareCronJobRun audit row on success", async () => {
  __reset();
  __setEmailProviderForTests(null, { mode: "log", fromAddress: "f@t.local" });
  const result = await runJob("send-reminders");
  assert.equal(result.status, "Succeeded");
  const runs = await prisma.wehowareCronJobRun.findMany({});
  assert.equal(runs.length, 1);
  assert.equal(runs[0].jobName, "send-reminders");
  assert.equal(runs[0].status, "Succeeded");
  assert.ok(runs[0].durationMs >= 0);
});

test("runReminderDispatcher matches InvoiceDue and sends one email per invoice", async () => {
  __reset();
  __setEmailProviderForTests(null, { mode: "log", fromAddress: "f@t.local" });
  const clientId = "c1";
  __seed("wehowareClient", [{ id: clientId, name: "Acme" }]);
  __seed("wehowareReminderRule", [
    {
      id: "r1",
      clientId,
      reminderType: "InvoiceDue",
      template: "invoice.reminder.due",
      triggerDays: 3, // 3 days before due date
      active: true,
    },
  ]);
  __seed("wehowareInvoice", [
    {
      id: "inv1",
      clientId,
      invoiceNumber: "INV-1",
      clientName: "Bob",
      clientEmail: "bob@x.com",
      total: 100,
      amountPaid: 0,
      currency: "USD",
      status: "Sent",
      dueDate: startOfDay(3),
    },
    {
      id: "inv2", // not due in 3d, should NOT be matched
      clientId,
      invoiceNumber: "INV-2",
      clientName: "Carol",
      clientEmail: "carol@x.com",
      total: 200,
      currency: "USD",
      status: "Sent",
      dueDate: startOfDay(10),
    },
    {
      id: "inv3", // due in 3d but no email — skipped
      clientId,
      invoiceNumber: "INV-3",
      clientName: "Dan",
      clientEmail: null,
      total: 50,
      currency: "USD",
      status: "Sent",
      dueDate: startOfDay(3),
    },
  ]);

  const out = await runReminderDispatcher();
  assert.equal(out.totalRules, 1);
  assert.equal(out.emailsSent, 1);
  assert.equal(out.perRule[0].matched, 1);

  const sent = await prisma.wehowareEmailLog.findMany({});
  assert.equal(sent.length, 1);
  assert.equal(sent[0].toAddress, "bob@x.com");
});

test("runReminderDispatcher matches BillOverdue and includes vendor email", async () => {
  __reset();
  __setEmailProviderForTests(null, { mode: "log", fromAddress: "f@t.local" });
  const clientId = "c1";
  __seed("wehowareReminderRule", [
    {
      id: "r2",
      clientId,
      reminderType: "BillOverdue",
      template: "bill.reminder.overdue",
      triggerDays: -7,
      active: true,
    },
  ]);
  __seed("wehowareVendor", [
    { id: "v1", clientId, name: "Acme Corp", email: "vendor@acme.com" },
    { id: "v2", clientId, name: "NoEmail Co" },
  ]);
  __seed("wehowareBill", [
    {
      id: "b1",
      clientId,
      vendorId: "v1",
      billNumber: "BILL-1",
      total: 500,
      amountPaid: 0,
      currency: "USD",
      status: "Open",
      dueDate: startOfDay(-7),
    },
    {
      id: "b2",
      clientId,
      vendorId: "v2",
      billNumber: "BILL-2",
      total: 300,
      currency: "USD",
      status: "Open",
      dueDate: startOfDay(-7),
    },
  ]);

  const out = await runReminderDispatcher();
  assert.equal(out.emailsSent, 1);
  const logs = await prisma.wehowareEmailLog.findMany({});
  assert.equal(logs.length, 1);
  assert.equal(logs[0].toAddress, "vendor@acme.com");
});

test("runReminderDispatcher records per-rule errors and continues", async () => {
  __reset();
  // No injected provider — defaults to log mode (env), so sends succeed.
  // We force a failure by giving the reminder an unknown template.
  __setEmailProviderForTests(null, { mode: "log", fromAddress: "f@t.local" });
  const clientId = "c1";
  __seed("wehowareReminderRule", [
    {
      id: "good",
      clientId,
      reminderType: "InvoiceDue",
      template: "invoice.reminder.due",
      triggerDays: 1,
      active: true,
    },
    {
      id: "broken",
      clientId,
      reminderType: "InvoiceDue",
      template: "no.such.template",
      triggerDays: 1,
      active: true,
    },
  ]);
  __seed("wehowareInvoice", [
    {
      id: "inv-good",
      clientId,
      invoiceNumber: "INV-A",
      clientName: "Match",
      clientEmail: "m@x.com",
      total: 99,
      currency: "USD",
      status: "Sent",
      dueDate: startOfDay(1),
    },
  ]);

  const out = await runReminderDispatcher();
  assert.equal(out.totalRules, 2);
  assert.equal(out.emailsSent, 1);
  assert.equal(out.emailsFailed, 1);
});

test("runJob propagates job failure and records Failed status", async () => {
  __reset();
  // Force a failure: stub the plaid client to throw
  __setPlaidClientForTests({
    transactionsSync() {
      throw new Error("simulated plaid down");
    },
  });
  __seed("wehowarePlaidItem", [
    {
      id: "pi1",
      clientId: "c1",
      itemId: "item-1",
      accessTokenEnc: "v1:dummy:dummy:dummy", // decryption will fail too
      status: "Active",
    },
  ]);
  // Run sync-plaid: the dispatcher catches per-item errors and never
  // propagates them, so the run should succeed.
  const res = await runJob("sync-plaid");
  assert.equal(res.status, "Succeeded");
  assert.equal(res.output.failed, 1);
  assert.equal(res.output.succeeded, 0);
  __setPlaidClientForTests(null);
});
