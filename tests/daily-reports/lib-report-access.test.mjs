// tests/daily-reports/lib-report-access.test.mjs
// Unit tests for the same-day unsubmit rule in canMutateReport /
// isSameDayAsReportDate / todayInTimezone — pure permission logic, no
// prisma needed. "businessToday" is the calendar day in the report
// client's business timezone, resolved server-side by the routes.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canMutateReport,
  isSameDayAsReportDate,
  todayInTimezone,
} from "../../src/app/api/utils/daily-report-access.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * DAY_MS);
}

function utcISO(date) {
  return date.toISOString().slice(0, 10);
}

function makeReport({ userId = "u-1", creatorRole = "employee", status = "submitted", reportDate } = {}) {
  return {
    id: "r-1",
    userId,
    clientId: "c-1",
    creatorRole,
    status,
    reportDate: reportDate ?? utcDate(0),
    submittedBy: userId,
    submittedAt: new Date(),
  };
}

const admin = { id: "u-admin", role: "admin" };
const employee = { id: "u-emp", role: "employee" };
const clientOwner = { id: "u-owner", role: "client", activeClientRole: "client", activeClientId: "c-1" };
const clientManager = { id: "u-mgr", role: "client", activeClientRole: "manager", activeClientId: "c-1" };
const clientEditor = { id: "u-ed", role: "client", activeClientRole: "editor", activeClientId: "c-1" };
const clientViewer = { id: "u-vw", role: "client", activeClientRole: "viewer", activeClientId: "c-1" };

test("employee creator can unsubmit own report on the report's date", () => {
  const report = makeReport({ userId: employee.id });
  const perms = canMutateReport(employee, report, utcISO(utcDate(0)));
  assert.equal(perms.canUnsubmit, true);
  assert.equal(perms.canEdit, false);
  assert.equal(perms.canSubmit, false);
});

test("employee creator cannot unsubmit own report after the report's date", () => {
  const report = makeReport({ userId: employee.id });
  const perms = canMutateReport(employee, report, utcISO(utcDate(1)));
  assert.equal(perms.canUnsubmit, false);
  assert.match(perms.reason, /report's date/);
});

test("employee cannot unsubmit someone else's report even on its date", () => {
  const report = makeReport({ userId: "someone-else" });
  const perms = canMutateReport(employee, report, utcISO(utcDate(0)));
  assert.equal(perms.canUnsubmit, false);
});

test("admin can unsubmit any submitted report regardless of the day", () => {
  const report = makeReport({ userId: employee.id, reportDate: utcDate(-30) });
  const perms = canMutateReport(admin, report, utcISO(utcDate(0)));
  assert.equal(perms.canUnsubmit, true);
});

test("client owner can unsubmit any client-side report regardless of the day", () => {
  const report = makeReport({ userId: clientEditor.id, creatorRole: "client", reportDate: utcDate(-30) });
  const perms = canMutateReport(clientOwner, report, utcISO(utcDate(0)));
  assert.equal(perms.canUnsubmit, true);
});

test("client staff (manager/editor) can unsubmit own report only on its date", () => {
  const report = makeReport({ userId: clientEditor.id, creatorRole: "client" });
  assert.equal(canMutateReport(clientEditor, report, utcISO(utcDate(0))).canUnsubmit, true);
  assert.equal(canMutateReport(clientEditor, report, utcISO(utcDate(1))).canUnsubmit, false);

  const mgrReport = makeReport({ userId: clientManager.id, creatorRole: "client" });
  assert.equal(canMutateReport(clientManager, mgrReport, utcISO(utcDate(0))).canUnsubmit, true);
});

test("client manager cannot unsubmit a subordinate's report", () => {
  const report = makeReport({ userId: clientEditor.id, creatorRole: "client" });
  const perms = canMutateReport(clientManager, report, utcISO(utcDate(0)));
  assert.equal(perms.canUnsubmit, false);
});

test("client viewer cannot unsubmit even own report", () => {
  const report = makeReport({ userId: clientViewer.id, creatorRole: "client" });
  const perms = canMutateReport(clientViewer, report, utcISO(utcDate(0)));
  assert.equal(perms.canUnsubmit, false);
});

test("employee cannot unsubmit a report from another role group", () => {
  const report = makeReport({ userId: employee.id, creatorRole: "client" });
  const perms = canMutateReport(employee, report, utcISO(utcDate(0)));
  assert.equal(perms.canUnsubmit, false);
});

test("without businessToday, falls back to the server's UTC date", () => {
  const todayReport = makeReport({ userId: employee.id, reportDate: utcDate(0) });
  assert.equal(canMutateReport(employee, todayReport).canUnsubmit, true);

  const oldReport = makeReport({ userId: employee.id, reportDate: utcDate(-5) });
  assert.equal(canMutateReport(employee, oldReport).canUnsubmit, false);
});

test("an invalid businessToday string falls back to the UTC date", () => {
  const report = makeReport({ userId: employee.id, reportDate: utcDate(0) });
  assert.equal(canMutateReport(employee, report, "not-a-date").canUnsubmit, true);

  const oldReport = makeReport({ userId: employee.id, reportDate: utcDate(-5) });
  assert.equal(canMutateReport(employee, oldReport, "not-a-date").canUnsubmit, false);
});

test("draft reports keep their existing edit permissions", () => {
  const draft = makeReport({ userId: employee.id, status: "draft" });
  const perms = canMutateReport(employee, draft, utcISO(utcDate(0)));
  assert.equal(perms.canEdit, true);
  assert.equal(perms.canSubmit, true);
  assert.equal(perms.canUnsubmit, false);
});

test("isSameDayAsReportDate compares the report date to business today", () => {
  const report = { reportDate: utcDate(0) };
  assert.equal(isSameDayAsReportDate(report, utcISO(utcDate(0))), true);
  assert.equal(isSameDayAsReportDate(report, utcISO(utcDate(1))), false);
  assert.equal(isSameDayAsReportDate({ reportDate: null }, utcISO(utcDate(0))), false);
});

test("todayInTimezone returns YYYY-MM-DD in the given zone", () => {
  assert.match(todayInTimezone("America/Toronto"), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(todayInTimezone("Asia/Kolkata"), /^\d{4}-\d{2}-\d{2}$/);
});

test("todayInTimezone falls back to UTC for invalid zones", () => {
  assert.equal(todayInTimezone("Bogus/Zone"), utcISO(utcDate(0)));
  assert.equal(todayInTimezone(""), todayInTimezone("America/Toronto"));
});

test("overnight-shift scenario: 6 AM IST submit still counts as the Canadian day", () => {
  // Report for the Oct 1 Canadian workday, submitted at 6 AM IST Oct 2 —
  // which is still Oct 1 in Toronto. businessToday is resolved server-side
  // in the client timezone, so the creator can still revert.
  const report = makeReport({
    userId: employee.id,
    reportDate: new Date(`${utcISO(utcDate(0))}T00:00:00.000Z`),
  });
  // Toronto "today" = same calendar date as the report
  assert.equal(canMutateReport(employee, report, utcISO(utcDate(0))).canUnsubmit, true);
  // Once Toronto rolls to the next day, the window closes
  assert.equal(canMutateReport(employee, report, utcISO(utcDate(1))).canUnsubmit, false);
});
