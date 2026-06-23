/**
 * GET /api/v1/daily-reports/analytics/summary
 *
 * Aggregated analytics for daily work reports with:
 *   - Summary metrics (total reports, submitted, drafts, total hours, avg hours)
 *   - Per-employee breakdown (reports count, hours, tasks completed)
 *   - Trend data by granularity (daily/weekly/monthly/yearly)
 *   - Task completion counts per employee
 *
 * Query params:
 *   date_from    — ISO date string (start of range)
 *   date_to      — ISO date string (end of range)
 *   user_id      — filter to specific user
 *   status       — "draft" | "submitted" | (omit for all)
 *   granularity  — "daily" | "weekly" | "monthly" | "yearly" (default: "daily")
 *
 * Strict cross-group isolation enforced via buildReportWhere.
 * Only admin, client owner, and manager can access this endpoint.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";
import {
  buildReportWhere,
  canViewAnalytics,
} from "../../../../utils/daily-report-access";

const VALID_GRANULARITIES = new Set(["daily", "weekly", "monthly", "yearly"]);

function toDateOnly(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function getPeriodKey(date, granularity) {
  const d = new Date(date);
  if (granularity === "daily") {
    return d.toISOString().split("T")[0];
  }
  if (granularity === "weekly") {
    const day = d.getUTCDay();
    const diff = (day + 6) % 7;
    d.setUTCDate(d.getUTCDate() - diff);
    return d.toISOString().split("T")[0];
  }
  if (granularity === "monthly") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "yearly") {
    return String(d.getUTCFullYear());
  }
  return d.toISOString().split("T")[0];
}

async function getHandler(request) {
  const { prisma, user } = request;

  if (!canViewAnalytics(user)) {
    return NextResponse.json(
      { error: "You do not have permission to view analytics" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const userIdFilter = searchParams.get("user_id");
    const statusFilter = searchParams.get("status");
    const granularity = searchParams.get("granularity") || "daily";

    if (!VALID_GRANULARITIES.has(granularity)) {
      return NextResponse.json(
        { error: "Invalid granularity. Use: daily, weekly, monthly, or yearly" },
        { status: 400 }
      );
    }

    // Build visibility-scoped where clause
    const visibilityWhere = await buildReportWhere(prisma, user);
    const filterWhere = {};

    if (dateFrom || dateTo) {
      filterWhere.reportDate = {};
      if (dateFrom) {
        const d = toDateOnly(dateFrom);
        if (d) filterWhere.reportDate.gte = d;
      }
      if (dateTo) {
        const d = toDateOnly(dateTo);
        if (d) filterWhere.reportDate.lte = d;
      }
    }

    if (statusFilter) {
      filterWhere.status = statusFilter;
    }

    if (userIdFilter) {
      filterWhere.userId = userIdFilter;
    }

    const conditions = [visibilityWhere];
    if (Object.keys(filterWhere).length > 0) {
      conditions.push(filterWhere);
    }
    const where =
      conditions.length === 1 ? conditions[0] : { AND: conditions };

    // Fetch all matching reports with items and user info
    const reports = await prisma.wehowareDailyWorkReport.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            taskId: true,
            hoursWorked: true,
            description: true,
            task: {
              select: { id: true, title: true, status: true },
            },
          },
        },
      },
      orderBy: { reportDate: "desc" },
    });

    // ── Summary metrics ─────────────────────────────────────────────
    const totalReports = reports.length;
    const submittedCount = reports.filter((r) => r.status === "submitted").length;
    const draftCount = reports.filter((r) => r.status === "draft").length;
    const totalHours = reports.reduce(
      (sum, r) => sum + Number(r.totalHours || 0),
      0
    );
    const avgHoursPerReport = totalReports > 0 ? totalHours / totalReports : 0;

    // Count unique tasks completed (from items)
    const uniqueTaskIds = new Set();
    reports.forEach((r) => {
      r.items.forEach((it) => {
        if (it.taskId) uniqueTaskIds.add(it.taskId);
      });
    });
    const tasksCompleted = uniqueTaskIds.size;

    // ── Per-employee breakdown ──────────────────────────────────────
    const employeeMap = new Map();

    for (const report of reports) {
      const uid = report.userId;
      if (!employeeMap.has(uid)) {
        employeeMap.set(uid, {
          user_id: uid,
          first_name: report.user?.firstName || "",
          last_name: report.user?.lastName || "",
          email: report.user?.email || "",
          label:
            `${report.user?.firstName || ""} ${report.user?.lastName || ""}`.trim() ||
            report.user?.email ||
            uid,
          reports_count: 0,
          submitted_count: 0,
          draft_count: 0,
          total_hours: 0,
          tasks_completed: 0,
          _taskIds: new Set(),
        });
      }

      const emp = employeeMap.get(uid);
      emp.reports_count += 1;
      if (report.status === "submitted") emp.submitted_count += 1;
      if (report.status === "draft") emp.draft_count += 1;
      emp.total_hours += Number(report.totalHours || 0);

      for (const item of report.items) {
        if (item.taskId) emp._taskIds.add(item.taskId);
      }
    }

    // Finalize tasks_completed and compute avg
    const perEmployee = Array.from(employeeMap.values()).map((emp) => {
      emp.tasks_completed = emp._taskIds.size;
      emp.avg_hours_per_report =
        emp.reports_count > 0 ? emp.total_hours / emp.reports_count : 0;
      delete emp._taskIds;
      return emp;
    });

    // ── Trend data by granularity ───────────────────────────────────
    const trendMap = new Map();

    for (const report of reports) {
      const periodKey = getPeriodKey(report.reportDate, granularity);
      if (!trendMap.has(periodKey)) {
        trendMap.set(periodKey, {
          period: periodKey,
          reports: 0,
          submitted: 0,
          drafts: 0,
          total_hours: 0,
          tasks_completed: new Set(),
        });
      }
      const period = trendMap.get(periodKey);
      period.reports += 1;
      if (report.status === "submitted") period.submitted += 1;
      if (report.status === "draft") period.drafts += 1;
      period.total_hours += Number(report.totalHours || 0);
      report.items.forEach((it) => {
        if (it.taskId) period.tasks_completed.add(it.taskId);
      });
    }

    const trend = Array.from(trendMap.values())
      .map((p) => ({
        period: p.period,
        reports: p.reports,
        submitted: p.submitted,
        drafts: p.drafts,
        total_hours: Number(p.total_hours.toFixed(2)),
        tasks_completed: p.tasks_completed.size,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    // ── Task details per employee (for expandable rows) ─────────────
    const taskDetailsMap = new Map();

    for (const report of reports) {
      const uid = report.userId;
      if (!taskDetailsMap.has(uid)) {
        taskDetailsMap.set(uid, []);
      }
      for (const item of report.items) {
        taskDetailsMap.get(uid).push({
          report_date: report.reportDate.toISOString().split("T")[0],
          task_id: item.taskId,
          task_title: item.task?.title || "Unknown",
          task_status: item.task?.status || "unknown",
          hours_worked: Number(item.hoursWorked || 0),
          description: item.description || "",
        });
      }
    }

    const taskDetails = {};
    for (const [uid, details] of taskDetailsMap) {
      taskDetails[uid] = details.sort((a, b) =>
        b.report_date.localeCompare(a.report_date)
      );
    }

    return NextResponse.json(
      {
        summary: {
          total_reports: totalReports,
          submitted_count: submittedCount,
          draft_count: draftCount,
          total_hours: Number(totalHours.toFixed(2)),
          avg_hours_per_report: Number(avgHoursPerReport.toFixed(2)),
          tasks_completed: tasksCompleted,
        },
        per_employee: perEmployee,
        trend,
        task_details: taskDetails,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/v1/daily-reports/analytics/summary] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler, {
  allowedRoles: ["admin", "client"],
});
