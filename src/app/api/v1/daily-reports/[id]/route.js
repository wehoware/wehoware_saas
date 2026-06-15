/**
 * /api/v1/daily-reports/[id]
 *
 * GET    — single report with items
 * PUT    — update report (draft only) + replace items via $transaction
 * DELETE — delete report
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import {
  loadReport,
  canMutateReport,
  validateReportItems,
  recalcTotalHours,
  shapeReport,
} from "../../../utils/daily-report-access";

function toDateOnly(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function startOfTodayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function _checkEditPermission(user, existing) {
  const mutationCheck = canMutateReport(user, existing);
  if (!mutationCheck.canEdit) {
    return { ok: false, status: 403, error: mutationCheck.reason || "You cannot edit this report" };
  }
  if (existing.status !== "draft") {
    return { ok: false, status: 403, error: "Submitted reports cannot be edited" };
  }
  return { ok: true };
}

function _validateReportDate(reportDateRaw) {
  if (reportDateRaw === undefined) return { ok: true, data: {} };
  const reportDate = toDateOnly(reportDateRaw);
  if (!reportDate) {
    return { ok: false, error: "Invalid report_date" };
  }
  const today = startOfTodayUTC();
  if (reportDate > today) {
    return { ok: false, error: "Future dates are not allowed" };
  }
  return { ok: true, data: { reportDate } };
}

async function _validateAndBuildItems(prisma, user, items) {
  if (!Array.isArray(items)) {
    return { ok: false, error: "items must be an array" };
  }
  if (items.length > 0) {
    const itemValidation = await validateReportItems(prisma, user, items);
    if (!itemValidation.valid) {
      return { ok: false, error: itemValidation.reason };
    }
  }
  const built = _buildItemData(items);
  if (built.error) {
    return { ok: false, error: built.error };
  }
  return { ok: true, itemData: built.itemData };
}

function _buildItemData(items) {
  const itemData = items.map((item, idx) => {
    const start = item.start_time ?? item.startTime ? new Date(item.start_time ?? item.startTime) : null;
    const end = item.end_time ?? item.endTime ? new Date(item.end_time ?? item.endTime) : null;
    let hoursWorked = 0;
    if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const diffMs = end.getTime() - start.getTime();
      hoursWorked = Math.max(0, diffMs / (1000 * 60 * 60));
    }
    if (item.hours_worked !== undefined && item.hours_worked !== null) {
      hoursWorked = Number(item.hours_worked);
    }
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

  const totalHours = itemData.reduce((sum, item) => sum + item.hoursWorked, 0);
  if (totalHours > 24) {
    return { error: "Total hours cannot exceed 24 per report" };
  }
  return { itemData };
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const report = await loadReport(prisma, user, id);
      if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      const out = shapeReport(report);
      out._permissions = canMutateReport(user, report);
      return NextResponse.json(out);
    } catch (err) {
      console.error("[GET /api/v1/daily-reports/[id]] error:", err);
      return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);

// -------------------------------------------------------------------
// PUT
// -------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;
      const body = await request.json();

      const existing = await loadReport(prisma, user, id);
      if (!existing) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      const permCheck = _checkEditPermission(user, existing);
      if (!permCheck.ok) {
        return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
      }

      const dateCheck = _validateReportDate(body.report_date ?? body.reportDate);
      if (!dateCheck.ok) {
        return NextResponse.json({ error: dateCheck.error }, { status: 400 });
      }

      const data = { ...dateCheck.data };
      if (body.summary !== undefined) data.summary = body.summary ?? null;

      // Validate and rebuild items if provided
      let itemData = null;
      const items = body.items;
      if (items !== undefined) {
        const itemCheck = await _validateAndBuildItems(prisma, user, items);
        if (!itemCheck.ok) {
          return NextResponse.json({ error: itemCheck.error }, { status: 400 });
        }
        itemData = itemCheck.itemData;
      }

      // Execute update + item replacement in a transaction
      const updated = await prisma.$transaction(async (tx) => {
        // Delete existing items
        await tx.wehowareDailyWorkReportItem.deleteMany({
          where: { reportId: id },
        });

        // Update report fields
        await tx.wehowareDailyWorkReport.update({
          where: { id },
          data: {
            ...data,
            ...(itemData ? { items: { create: itemData } } : {}),
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            items: { orderBy: { sequence: "asc" } },
          },
        });

        // Recalc totalHours if items were replaced
        if (itemData) {
          await recalcTotalHours(tx, id);
        }

        // Reload to get updated totalHours
        return tx.wehowareDailyWorkReport.findUnique({
          where: { id },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            items: { orderBy: { sequence: "asc" } },
          },
        });
      });

      const out = shapeReport(updated);
      out._permissions = canMutateReport(user, updated);
      return NextResponse.json(out);
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "A report already exists for this date" },
          { status: 409 }
        );
      }
      console.error("[PUT /api/v1/daily-reports/[id]] error:", err);
      return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);

// -------------------------------------------------------------------
// DELETE
// -------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const existing = await loadReport(prisma, user, id);
      if (!existing) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      const mutationCheck = canMutateReport(user, existing);
      if (!mutationCheck.canDelete) {
        return NextResponse.json(
          { error: mutationCheck.reason || "You cannot delete this report" },
          { status: 403 }
        );
      }

      await prisma.wehowareDailyWorkReport.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/daily-reports/[id]] error:", err);
      return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
