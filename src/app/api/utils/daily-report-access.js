/**
 * src/app/api/utils/daily-report-access.js
 *
 * Centralized daily work report access-control helpers implementing strict
 * cross-group separation (Admin/Employee vs Client-side users).
 *
 * Visibility is determined by creatorRole SNAPSHOT on the report, not the
 * user's live role. This preserves audit history when users change roles.
 */

import { buildTaskWhere } from "./task-access";

// Group 1 = admin + employee. Group 2 = client-side users.
const GROUP_1_ROLES = ["admin", "employee"];
const GROUP_2_ROLES = ["client"]; // client-side creatorRole is always "client"

/**
 * Build a Prisma `where` clause that restricts daily work reports to what
 * the user may see, based on the report's creatorRole snapshot.
 */
async function buildReportWhere(prisma, user, extraWhere = {}) {
  const where = { ...extraWhere };

  // Cross-group isolation: filter by creatorRole group
  if (user.role === "admin" || user.role === "employee") {
    where.creatorRole = { in: GROUP_1_ROLES };
  } else if (user.role === "client") {
    where.creatorRole = "client";
  }

  // Client scoping — only for client roles; admin/employee see across all clients
  if (user.role === "client") {
    const clientId = user.activeClientId ?? user.clientId;
    if (clientId) {
      where.clientId = clientId;
    }
  }

  // Role-specific visibility within the group
  if (user.role === "admin") {
    // Admin sees all Group 1 reports for the active client
    return where;
  }

  if (user.role === "employee") {
    // Employee sees only their own reports
    where.userId = user.id;
    return where;
  }

  if (user.role === "client") {
    const role = user.activeClientRole;
    if (role === "client") {
      // Owner sees all Group 2 reports for their client
      return where;
    }
    if (role === "manager") {
      // Manager sees own + editor + viewer reports for this client
      const subordinateUserIds = await _getSubordinateUserIds(prisma, user, clientId, role);
      where.userId = { in: [user.id, ...subordinateUserIds] };
      return where;
    }
    if (role === "editor") {
      // Editor sees only their own reports
      where.userId = user.id;
      return where;
    }
    if (role === "viewer") {
      // Viewer sees only their own reports
      where.userId = user.id;
      return where;
    }
  }

  return where;
}

/**
 * Check whether the user may access a specific report by ID.
 */
async function canAccessReport(prisma, user, reportId) {
  const where = await buildReportWhere(prisma, user);
  where.id = reportId;
  const hit = await prisma.wehowareDailyWorkReport.findFirst({
    where,
    select: { id: true },
  });
  return Boolean(hit);
}

/**
 * Load a report the user is allowed to access.
 * Returns the Prisma report (with items), or null when not found / not accessible.
 */
async function loadReport(prisma, user, reportId) {
  const where = await buildReportWhere(prisma, user);
  where.id = reportId;
  return prisma.wehowareDailyWorkReport.findFirst({
    where,
    include: {
      items: { orderBy: { sequence: "asc" } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}

function _checkAdminMutations(user, report, isCreator, isDraft, isSubmitted) {
  if (!GROUP_1_ROLES.includes(report.creatorRole)) {
    return { allowed: false, reason: "You cannot mutate reports from another role group", canEdit: false, canDelete: false, canSubmit: false, canUnsubmit: false };
  }
  const canEdit = isDraft;
  const canDelete = true;
  const canSubmit = isDraft && isCreator;
  const canUnsubmit = isSubmitted;
  return { allowed: canEdit || canDelete || canSubmit || canUnsubmit, reason: "", canEdit, canDelete, canSubmit, canUnsubmit };
}

function _checkEmployeeMutations(user, report, isCreator, isDraft, isSubmitted, sameDay) {
  if (!isCreator) {
    return { allowed: false, reason: "You can only mutate your own reports", canEdit: false, canDelete: false, canSubmit: false, canUnsubmit: false };
  }
  if (!GROUP_1_ROLES.includes(report.creatorRole)) {
    return { allowed: false, reason: "You cannot mutate reports from another role group", canEdit: false, canDelete: false, canSubmit: false, canUnsubmit: false };
  }
  const canUnsubmit = isSubmitted && sameDay;
  const reason = isSubmitted && !sameDay
    ? "Submitted reports can only be reverted on the report's date"
    : "";
  return {
    allowed: isDraft || canUnsubmit,
    reason,
    canEdit: isDraft,
    canDelete: isDraft,
    canSubmit: isDraft,
    canUnsubmit,
  };
}

function _checkClientOwnerMutations(report, isCreator, isDraft, isSubmitted) {
  const canEdit = isDraft;
  const canDelete = true;
  const canSubmit = isDraft && isCreator;
  const canUnsubmit = isSubmitted;
  return { allowed: canEdit || canDelete || canSubmit || canUnsubmit, reason: "", canEdit, canDelete, canSubmit, canUnsubmit };
}

function _checkClientStaffMutations(report, isCreator, isDraft, isSubmitted, sameDay) {
  if (!isCreator) {
    return { allowed: false, reason: "You can only mutate your own reports", canEdit: false, canDelete: false, canSubmit: false, canUnsubmit: false };
  }
  const canUnsubmit = isSubmitted && sameDay;
  const reason = isSubmitted && !sameDay
    ? "Submitted reports can only be reverted on the report's date"
    : "";
  return {
    allowed: isDraft || canUnsubmit,
    reason,
    canEdit: isDraft,
    canDelete: isDraft,
    canSubmit: isDraft,
    canUnsubmit,
  };
}

function _checkClientMutations(user, report, isCreator, isDraft, isSubmitted, sameDay) {
  const role = user.activeClientRole;
  if (report.creatorRole !== "client") {
    return { allowed: false, reason: "You cannot mutate reports from another role group", canEdit: false, canDelete: false, canSubmit: false, canUnsubmit: false };
  }
  if (role === "viewer") {
    return { allowed: false, reason: "Viewers cannot edit or delete reports", canEdit: false, canDelete: false, canSubmit: false, canUnsubmit: false };
  }
  if (role === "client") {
    return _checkClientOwnerMutations(report, isCreator, isDraft, isSubmitted);
  }
  return _checkClientStaffMutations(report, isCreator, isDraft, isSubmitted, sameDay);
}

/**
 * Normalize a value to a "YYYY-MM-DD" date part.
 * @db.Date columns come back as Date objects at UTC midnight, so the ISO
 * prefix is the stored calendar day. Strings keep their leading date part.
 */
function _toDatePart(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Default business timezone when a client hasn't configured one.
 * The platform operates on Canadian business hours by default; clients can
 * override via the "timezone" key in wehoware_settings (General Settings).
 */
const DEFAULT_BUSINESS_TIMEZONE = "America/Toronto";

function isValidTimezone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * "Today" (YYYY-MM-DD) in an IANA timezone. Falls back to the server's
 * UTC date when the timezone is missing or invalid.
 */
function todayInTimezone(timeZone) {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || DEFAULT_BUSINESS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const p = Object.fromEntries(
      fmt.formatToParts(new Date()).map((part) => [part.type, part.value])
    );
    return `${p.year}-${p.month}-${p.day}`;
  } catch {
    return _toDatePart(new Date());
  }
}

/**
 * Resolve configured business timezones for a set of clients from
 * wehoware_settings (setting_key = "timezone"). Returns Map<clientId, tz>
 * containing only valid IANA timezones.
 */
async function getBusinessTimezones(prisma, clientIds) {
  const map = new Map();
  const ids = [...new Set((clientIds || []).filter(Boolean))];
  if (ids.length === 0) return map;
  const rows = await prisma.wehowareSetting.findMany({
    where: { clientId: { in: ids }, settingKey: "timezone" },
    select: { clientId: true, settingValue: true },
  });
  for (const row of rows) {
    const tz = row.settingValue?.trim();
    if (tz && isValidTimezone(tz)) map.set(row.clientId, tz);
  }
  return map;
}

/**
 * The client's business "today" (YYYY-MM-DD) — the calendar day that
 * defines the same-day unsubmit window. Defaults to the platform
 * business timezone when the client hasn't configured one.
 */
async function businessDateToday(prisma, clientId) {
  const map = await getBusinessTimezones(prisma, [clientId]);
  return todayInTimezone(map.get(clientId));
}

/**
 * True when the report's date equals the business "today" — i.e. the
 * calendar day in the report's client timezone. `businessToday` is a
 * "YYYY-MM-DD" value resolved server-side; when omitted we fall back to
 * the server's UTC date.
 */
function isSameDayAsReportDate(report, businessToday) {
  const reportDay = _toDatePart(report?.reportDate);
  const today = _toDatePart(businessToday) ?? _toDatePart(new Date());
  return Boolean(reportDay && today) && reportDay === today;
}

/**
 * Enforce mutation permissions on a single report.
 * `businessToday` — the business "today" ("YYYY-MM-DD") in the report
 * client's timezone, resolved via businessDateToday(); used for the
 * same-day unsubmit rule for non-privileged roles.
 * Returns `{ allowed, reason, canEdit, canDelete, canSubmit, canUnsubmit }`.
 */
function canMutateReport(user, report, businessToday) {
  const isCreator = report.userId === user.id;
  const isDraft = report.status === "draft";
  const isSubmitted = report.status === "submitted";
  const sameDay = isSameDayAsReportDate(report, businessToday);

  if (user.role === "admin") {
    return _checkAdminMutations(user, report, isCreator, isDraft, isSubmitted);
  }
  if (user.role === "employee") {
    return _checkEmployeeMutations(user, report, isCreator, isDraft, isSubmitted, sameDay);
  }
  if (user.role === "client") {
    return _checkClientMutations(user, report, isCreator, isDraft, isSubmitted, sameDay);
  }
  return { allowed: false, reason: "Insufficient permissions", canEdit: false, canDelete: false, canSubmit: false, canUnsubmit: false };
}

/**
 * Validate that each taskId in report items references a task visible to the user.
 * For admin/employee, allows tasks assigned to them across any accessible client.
 * For client-side roles, scoped to the active client with existing visibility rules.
 * Returns `{ valid, reason }`.
 */
async function validateReportItems(prisma, user, items) {
  if (!Array.isArray(items)) {
    return { valid: false, reason: "items must be an array" };
  }

  const taskIds = items
    .map((item) => item.taskId ?? item.task_id)
    .filter(Boolean);

  if (taskIds.length === 0) {
    return { valid: true, reason: "" };
  }

  let visibleTasks;

  if (user.role === "admin" || user.role === "employee") {
    // Admin/employee may reference any task assigned to them across
    // any client they have access to (matches assignable-tasks endpoint)
    const userClients = await prisma.wehowareUserClient.findMany({
      where: { userId: user.id, active: true },
      select: { clientId: true },
    });
    const clientIds = userClients.map((uc) => uc.clientId);

    visibleTasks = await prisma.wehowareTask.findMany({
      where: {
        id: { in: taskIds },
        clientId: { in: clientIds },
        assigneeId: user.id,
      },
      select: { id: true },
    });
  } else {
    // Client-side roles: use standard task visibility rules
    const visibilityWhere = await buildTaskWhere(prisma, user);
    visibilityWhere.id = { in: taskIds };

    visibleTasks = await prisma.wehowareTask.findMany({
      where: visibilityWhere,
      select: { id: true },
    });
  }

  const visibleIds = new Set(visibleTasks.map((t) => t.id));

  for (const item of items) {
    const taskId = item.taskId ?? item.task_id;
    if (taskId && !visibleIds.has(taskId)) {
      return {
        valid: false,
        reason: `Task ${taskId} is not visible to you or does not exist`,
      };
    }
  }

  return { valid: true, reason: "" };
}

/**
 * Compute a report's totalHours from its own start/end times.
 * Report-level times are independent of per-item hours — item times
 * never feed into the report total.
 */
function computeReportTotalHours(startTime, endTime) {
  if (startTime && endTime) {
    const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    if (diffMs > 0) return diffMs / (1000 * 60 * 60);
  }
  return 0;
}

/**
 * Recalculate totalHours from the report-level start/end times and
 * update the parent report. Must be called inside a transaction.
 */
async function recalcTotalHours(tx, reportId) {
  const report = await tx.wehowareDailyWorkReport.findUnique({
    where: { id: reportId },
    select: { startTime: true, endTime: true },
  });
  const total = computeReportTotalHours(report?.startTime, report?.endTime);
  await tx.wehowareDailyWorkReport.update({
    where: { id: reportId },
    data: { totalHours: total },
  });
  return total;
}

/**
 * Check if the user can create daily work reports.
 */
function canCreateReport(user) {
  // Any authenticated user can create
  return true;
}

/**
 * Shape a report row for API response (snake_case aliases).
 */
function shapeReport(report) {
  if (!report) return report;
  const out = { ...report };
  out.start_time = report.startTime?.toISOString() ?? null;
  out.end_time = report.endTime?.toISOString() ?? null;
  if (report.user) {
    out.user = {
      id: report.user.id,
      first_name: report.user.firstName,
      last_name: report.user.lastName,
      email: report.user.email,
    };
  }
  if (report.items) {
    out.items = report.items.map((item) => ({
      ...item,
      task_id: item.taskId,
      subtask_id: item.subtaskId,
      start_time: item.startTime?.toISOString(),
      end_time: item.endTime?.toISOString(),
      hours_worked: item.hoursWorked,
    }));
  }
  return out;
}

/**
 * Get user IDs that the current user can monitor based on client role hierarchy.
 * - client (owner): all client-side users for this client
 * - manager: own + editors + viewers for this client
 * - editor: own only
 * - viewer: own only
 * Returns array of userIds (excluding the current user).
 */
async function getMonitoredUserIds(prisma, user) {
  if (user.role === "admin") {
    // Admin can see all admin+employee users across all clients
    const userClients = await prisma.wehowareUserClient.findMany({
      where: { active: true, user: { role: { in: ["admin", "employee"] } } },
      select: {
        userId: true,
      },
    });
    return userClients
      .map((uc) => uc.userId)
      .filter((uid) => uid !== user.id);
  }

  if (user.role === "client") {
    const clientId = user.activeClientId ?? user.clientId;
    const role = user.activeClientRole;

    if (role === "client") {
      // Owner sees all client-side users
      const userClients = await prisma.wehowareUserClient.findMany({
        where: { clientId, active: true },
        select: { userId: true },
      });
      return userClients.map((uc) => uc.userId).filter((uid) => uid !== user.id);
    }

    if (role === "manager") {
      // Manager sees editors + viewers
      const userClients = await prisma.wehowareUserClient.findMany({
        where: { clientId, active: true, role: { in: ["editor", "viewer"] } },
        select: { userId: true },
      });
      return userClients.map((uc) => uc.userId).filter((uid) => uid !== user.id);
    }
  }

  return [];
}

/**
 * Check if the user can access analytics (admin, client owner, or manager).
 */
function canViewAnalytics(user) {
  if (user.role === "admin") return true;
  if (user.role === "client") {
    return user.activeClientRole === "client" || user.activeClientRole === "manager";
  }
  return false;
}

async function _getSubordinateUserIds(prisma, user, clientId, role) {
  if (role === "manager") {
    const subordinates = await prisma.wehowareUserClient.findMany({
      where: { clientId, active: true, role: { in: ["editor", "viewer"] } },
      select: { userId: true },
    });
    return subordinates.map((s) => s.userId);
  }
  return [];
}

export {
  buildReportWhere,
  canAccessReport,
  loadReport,
  canMutateReport,
  isSameDayAsReportDate,
  todayInTimezone,
  getBusinessTimezones,
  businessDateToday,
  validateReportItems,
  computeReportTotalHours,
  recalcTotalHours,
  canCreateReport,
  shapeReport,
  getMonitoredUserIds,
  canViewAnalytics,
};
