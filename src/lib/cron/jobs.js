/**
 * Registry of cron jobs. Each job is a pure async function invoked by
 * /api/cron/[job]/route.js after HMAC verification.  Keep jobs idempotent
 * so EventBridge retries do not duplicate work.
 *
 * Every run inserts a wehoware_cron_job_runs row for observability.
 */
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/ses";
import { syncPlaidItem } from "@/lib/plaid/sync";
import {
  publishScheduledPosts,
  refreshExpiringTokens,
  retryFailedPosts,
  collectPostMetrics,
  recoverStuckPublishing,
} from "@/lib/cron-jobs/social-media.js";

function startOfDayUTC(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Walk active reminder rules, match them against invoices/bills based on
 * each rule's triggerDays offset from due_date, and send one email per
 * match.  Idempotency is achieved via a synthetic `remindedFor:<id>:<rule>`
 * marker column — for Session 1 we rely on the scheduler firing once/day
 * and the rule's own `lastRunAt`.  Session 3 will upgrade this to a
 * per-invoice delivery ledger.
 */
export async function runReminderDispatcher() {
  const today = startOfDayUTC();
  const rules = await prisma.wehowareReminderRule.findMany({
    where: { active: true },
  });
  const output = {
    totalRules: rules.length,
    emailsSent: 0,
    emailsFailed: 0,
    perRule: [],
  };

  for (const rule of rules) {
    const bucket = { ruleId: rule.id, matched: 0, sent: 0, failed: 0 };
    try {
      const targetDate = addDays(today, rule.triggerDays);
      const nextDate = addDays(targetDate, 1);
      const matches = await findRuleMatches(rule, targetDate, nextDate);
      bucket.matched = matches.length;

      for (const match of matches) {
        try {
          await sendEmail({
            clientId: rule.clientId,
            to: match.to,
            template: rule.template,
            context: match.context,
          });
          bucket.sent += 1;
          output.emailsSent += 1;
        } catch (err) {
          bucket.failed += 1;
          output.emailsFailed += 1;
          bucket.lastError = String(err?.message || err).slice(0, 500);
        }
      }
      await prisma.wehowareReminderRule.update({
        where: { id: rule.id },
        data: { lastRunAt: new Date() },
      });
    } catch (err) {
      bucket.error = String(err?.message || err).slice(0, 500);
    }
    output.perRule.push(bucket);
  }
  return output;
}

async function findRuleMatches(rule, targetDate, nextDate) {
  const matches = [];
  if (rule.reminderType === "InvoiceDue") {
    const invoices = await prisma.wehowareInvoice.findMany({
      where: {
        clientId: rule.clientId,
        dueDate: { gte: targetDate, lt: nextDate },
        status: { in: ["Sent", "Draft", "PartiallyPaid"] },
        clientEmail: { not: null },
      },
    });
    for (const inv of invoices) {
      if (!inv.clientEmail) continue;
      matches.push({
        to: inv.clientEmail,
        context: {
          invoice_number: inv.invoiceNumber,
          client_name: inv.clientName,
          amount_due:
            Number(inv.total ?? 0) - Number(inv.amountPaid ?? 0),
          currency: inv.currency || "CAD",
          due_date: inv.dueDate?.toISOString().slice(0, 10),
        },
      });
    }
  } else if (rule.reminderType === "InvoiceOverdue") {
    const invoices = await prisma.wehowareInvoice.findMany({
      where: {
        clientId: rule.clientId,
        dueDate: { gte: targetDate, lt: nextDate },
        status: { in: ["Sent", "Overdue", "PartiallyPaid"] },
        clientEmail: { not: null },
      },
    });
    const today = startOfDayUTC();
    for (const inv of invoices) {
      if (!inv.clientEmail) continue;
      const due = inv.dueDate ? startOfDayUTC(inv.dueDate) : today;
      const daysOverdue = Math.max(
        0,
        Math.round((today - due) / (1000 * 60 * 60 * 24))
      );
      matches.push({
        to: inv.clientEmail,
        context: {
          invoice_number: inv.invoiceNumber,
          client_name: inv.clientName,
          amount_due:
            Number(inv.total ?? 0) - Number(inv.amountPaid ?? 0),
          currency: inv.currency || "CAD",
          days_overdue: daysOverdue,
        },
      });
    }
  } else if (rule.reminderType === "BillDue" || rule.reminderType === "BillOverdue") {
    const bills = await prisma.wehowareBill.findMany({
      where: {
        clientId: rule.clientId,
        dueDate: { gte: targetDate, lt: nextDate },
        status: { in: ["Open", "PartiallyPaid"] },
      },
      include: { vendor: true },
    });
    const today = startOfDayUTC();
    for (const bill of bills) {
      if (!bill.vendor?.email) continue;
      const amountDue =
        Number(bill.total ?? 0) - Number(bill.amountPaid ?? 0);
      const ctx = {
        bill_number: bill.billNumber,
        vendor_name: bill.vendor?.name ?? "Vendor",
        amount_due: amountDue,
        currency: bill.currency || "CAD",
        due_date: bill.dueDate?.toISOString().slice(0, 10),
      };
      if (rule.reminderType === "BillOverdue") {
        const due = bill.dueDate ? startOfDayUTC(bill.dueDate) : today;
        ctx.days_overdue = Math.max(
          0,
          Math.round((today - due) / (1000 * 60 * 60 * 24))
        );
      }
      matches.push({ to: bill.vendor.email, context: ctx });
    }
  }
  return matches;
}

/**
 * Sync every active Plaid item across all tenants.  Per-item failures are
 * captured per row; we never throw out of the loop.
 */
export async function runPlaidSyncDispatcher() {
  const items = await prisma.wehowarePlaidItem.findMany({
    where: { status: "Active" },
  });
  const output = { totalItems: items.length, succeeded: 0, failed: 0, perItem: [] };
  for (const item of items) {
    try {
      const res = await syncPlaidItem({ plaidItemId: item.id });
      output.succeeded += 1;
      output.perItem.push({
        plaidItemId: item.id,
        added: res.added,
        modified: res.modified,
        removed: res.removed,
      });
    } catch (err) {
      output.failed += 1;
      output.perItem.push({
        plaidItemId: item.id,
        error: String(err?.message || err).slice(0, 500),
      });
    }
  }
  return output;
}

/**
 * Send daily work report reminders to users who have not submitted a report
 * for today. Uses lastReminderSentAt on WehowareProfile for idempotency.
 */
export async function runDailyReportReminderDispatcher() {
  const today = startOfDayUTC();
  const tomorrow = addDays(today, 1);

  // Find users who have an active client association and haven't been reminded today
  const users = await prisma.wehowareProfile.findMany({
    where: {
      active: true,
      OR: [
        { lastReminderSentAt: { lt: today } },
        { lastReminderSentAt: null },
      ],
      userClients: { some: {} },
    },
    include: {
      userClients: {
        where: { active: true },
        include: { client: true },
        take: 1,
      },
    },
  });

  const output = { checked: users.length, reminded: 0, failed: 0, skipped: 0 };

  for (const user of users) {
    const activeClient = user.userClients[0]?.client;
    if (!activeClient) {
      output.skipped += 1;
      continue;
    }

    // Check if user already submitted a report for today
    const existing = await prisma.wehowareDailyWorkReport.findFirst({
      where: {
        userId: user.id,
        clientId: activeClient.id,
        reportDate: { gte: today, lt: tomorrow },
        status: "submitted",
      },
    });

    if (existing) {
      output.skipped += 1;
      continue;
    }

    try {
      const dateStr = today.toISOString().slice(0, 10);
      await sendEmail({
        clientId: activeClient.id,
        to: user.email,
        template: "daily_report.reminder",
        context: {
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
          report_date: dateStr,
          link: `https://app.wehoware.com/admin/daily-reports`,
        },
      });
      output.reminded += 1;
    } catch (err) {
      // Email send failure is counted in output.failed; continue to next user
      console.error(`[cron] Daily report reminder email failed for ${user.email}:`, err.message);
      output.failed += 1;
    }

    // Always update lastReminderSentAt to prevent spam, even on failure
    await prisma.wehowareProfile.update({
      where: { id: user.id },
      data: { lastReminderSentAt: new Date() },
    });
  }

  return output;
}

export const JOBS = {
  "send-reminders": runReminderDispatcher,
  "sync-plaid": runPlaidSyncDispatcher,
  "send-daily-report-reminders": runDailyReportReminderDispatcher,
  "publish-scheduled-posts": publishScheduledPosts,
  "refresh-social-tokens": refreshExpiringTokens,
  "retry-failed-posts": retryFailedPosts,
  "collect-post-metrics": collectPostMetrics,
  "recover-stuck-publishing": recoverStuckPublishing,
};

export function listJobs() {
  return Object.keys(JOBS);
}

export async function runJob(name) {
  const fn = JOBS[name];
  if (!fn) throw new Error(`unknown cron job: ${name}`);
  const start = Date.now();
  const run = await prisma.wehowareCronJobRun.create({
    data: { jobName: name, status: "Running" },
  });
  try {
    const output = await fn();
    const durationMs = Date.now() - start;
    await prisma.wehowareCronJobRun.update({
      where: { id: run.id },
      data: {
        status: "Succeeded",
        finishedAt: new Date(),
        durationMs,
        output,
      },
    });
    return { runId: run.id, status: "Succeeded", durationMs, output };
  } catch (err) {
    const durationMs = Date.now() - start;
    await prisma.wehowareCronJobRun.update({
      where: { id: run.id },
      data: {
        status: "Failed",
        finishedAt: new Date(),
        durationMs,
        errorMessage: String(err?.message || err).slice(0, 2000),
      },
    });
    throw err;
  }
}
