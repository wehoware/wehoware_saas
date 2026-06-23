/**
 * /api/v1/daily-reports
 *
 * GET  — paginated list of daily work reports (role-filtered, with _permissions per row)
 * POST — create a report + items (uses $transaction)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";
import {
  buildReportWhere,
  canMutateReport,
  validateReportItems,
  shapeReport,
} from "../../utils/daily-report-access";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

// Standard include used across GET endpoints
const REPORT_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  items: { orderBy: { sequence: "asc" } },
};

function toDateOnly(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  // Strip time component so Prisma treats it as a @db.Date value
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function startOfTodayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// -------------------------------------------------------------------
// GET /api/v1/daily-reports
// -------------------------------------------------------------------
export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number.parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10))
    );

    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const status = searchParams.get("status");
    const userIdFilter = searchParams.get("user_id");

    const visibilityWhere = await buildReportWhere(prisma, user);
    const filterWhere = {};

    if (startDate || endDate) {
      filterWhere.reportDate = {};
      if (startDate) filterWhere.reportDate.gte = toDateOnly(startDate);
      if (endDate) filterWhere.reportDate.lte = toDateOnly(endDate);
    }
    if (status) {
      filterWhere.status = status;
    }
    if (userIdFilter) {
      // Only admin/owner/manager can filter by other users
      const canFilterByUser =
        user.role === "admin" ||
        (user.role === "client" &&
          (user.activeClientRole === "client" ||
            user.activeClientRole === "manager"));
      if (canFilterByUser) {
        filterWhere.userId = userIdFilter;
      }
    }

    const conditions = [visibilityWhere];
    if (Object.keys(filterWhere).length > 0) {
      conditions.push(filterWhere);
    }
    const where = conditions.length === 1 ? conditions[0] : { AND: conditions };

    const [items, total] = await Promise.all([
      prisma.wehowareDailyWorkReport.findMany({
        where,
        include: REPORT_INCLUDE,
        orderBy: { reportDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wehowareDailyWorkReport.count({ where }),
    ]);

    return NextResponse.json({
      reports: items.map((report) => {
        const shaped = shapeReport(report);
        shaped._permissions = canMutateReport(user, report);
        return shaped;
      }),
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("[GET /api/v1/daily-reports] error:", err);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
});

// -------------------------------------------------------------------
// POST /api/v1/daily-reports
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;

      const body = await request.json();
      const { report_date, summary, items = [], start_time, end_time } = body ?? {};

      if (!report_date) {
        return NextResponse.json({ error: "report_date is required" }, { status: 400 });
      }

      // Parse report-level start/end times (optional)
      let reportStartTime = null;
      let reportEndTime = null;
      if (start_time) {
        reportStartTime = new Date(start_time);
        if (Number.isNaN(reportStartTime.getTime())) {
          return NextResponse.json({ error: "Invalid start_time" }, { status: 400 });
        }
      }
      if (end_time) {
        reportEndTime = new Date(end_time);
        if (Number.isNaN(reportEndTime.getTime())) {
          return NextResponse.json({ error: "Invalid end_time" }, { status: 400 });
        }
      }
      if (reportStartTime && reportEndTime && reportEndTime < reportStartTime) {
        return NextResponse.json({ error: "end_time must be after start_time" }, { status: 400 });
      }

      const reportDate = toDateOnly(report_date);
      if (!reportDate) {
        return NextResponse.json({ error: "Invalid report_date" }, { status: 400 });
      }

      // No future dates
      const today = startOfTodayUTC();
      if (reportDate > today) {
        return NextResponse.json({ error: "Future dates are not allowed" }, { status: 400 });
      }

      // Validate items reference visible tasks (cross-group enforcement)
      if (items.length > 0) {
        const itemValidation = await validateReportItems(prisma, user, items);
        if (!itemValidation.valid) {
          return NextResponse.json({ error: itemValidation.reason }, { status: 400 });
        }
      }

      // Server-assigned identity
      const clientId = user.activeClientId ?? user.clientId;
      if (!clientId) {
        return NextResponse.json({ error: "No active client" }, { status: 400 });
      }

      // Build item data with auto-computed hours
      const itemData = items.map((item, idx) => {
        const start = new Date(item.start_time ?? item.startTime);
        const end = new Date(item.end_time ?? item.endTime);
        const diffMs = end.getTime() - start.getTime();
        const computedHours = Math.max(0, diffMs / (1000 * 60 * 60));
        const hoursWorked =
          item.hours_worked !== undefined && item.hours_worked !== null
            ? Number(item.hours_worked)
            : computedHours;

        return {
          taskId: item.task_id ?? item.taskId,
          subtaskId: item.subtask_id ?? item.subtaskId ?? null,
          startTime: start,
          endTime: end,
          hoursWorked,
          description: item.description ?? null,
          sequence: idx,
        };
      });

      // Compute total hours: prefer item sum, fall back to report-level time diff
      let totalHours = itemData.reduce((sum, item) => sum + item.hoursWorked, 0);
      if (itemData.length === 0 && reportStartTime && reportEndTime) {
        const diffMs = reportEndTime.getTime() - reportStartTime.getTime();
        totalHours = Math.max(0, diffMs / (1000 * 60 * 60));
      }
      if (totalHours > 24) {
        return NextResponse.json(
          { error: "Total hours cannot exceed 24 per report" },
          { status: 400 }
        );
      }

      // Create report + items in a transaction
      const report = await prisma.$transaction(async (tx) => {
        const created = await tx.wehowareDailyWorkReport.create({
          data: {
            userId: user.id,
            clientId,
            creatorRole: user.role,
            reportDate,
            startTime: reportStartTime,
            endTime: reportEndTime,
            summary: summary ?? null,
            totalHours,
            items: {
              create: itemData,
            },
          },
          include: REPORT_INCLUDE,
        });
        return created;
      });

      return NextResponse.json(shapeReport(report), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/daily-reports] error:", err);
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "A report already exists for this date" },
          { status: 409 }
        );
      }
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid task_id or subtask_id" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
