/**
 * GET /api/v1/reports/dashboard
 *
 * Summary dashboard metrics for admin users.
 * Query params: date_from, date_to (ISO strings)
 * Always scoped to user.activeClientId when set.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

// Map Prisma TaskStatus enum values to UI-friendly display strings
const STATUS_DISPLAY = {
  To_Do: "To Do",
  In_Progress: "In Progress",
  Done: "Done",
  Backlog: "Backlog",
};

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const { searchParams } = new URL(request.url);

      const dateFrom = searchParams.get("date_from");
      const dateTo = searchParams.get("date_to");

      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Base where clause — always scope to activeClientId when present
      const baseWhere = {};
      if (user.activeClientId) baseWhere.clientId = user.activeClientId;
      if (dateFrom || dateTo) {
        baseWhere.createdAt = {};
        if (dateFrom) baseWhere.createdAt.gte = new Date(dateFrom);
        if (dateTo) baseWhere.createdAt.lte = new Date(dateTo);
      }

      // All status enum values to iterate
      const allStatuses = ["To_Do", "In_Progress", "Done", "Backlog"];
      const allPriorities = ["High", "Medium", "Low"];

      // Run independent queries in parallel for performance
      const [
        allTasks,
        overdueCount,
        dueSoonCount,
        hoursAggregate,
        noEstimateCount,
      ] = await Promise.all([
        // Fetch all tasks with status and priority for grouping
        prisma.wehowareTask.findMany({
          where: baseWhere,
          select: {
            status: true,
            priority: true,
          },
        }),

        // Overdue: dueDate < now AND status != Done
        prisma.wehowareTask.count({
          where: {
            ...baseWhere,
            dueDate: { lt: now },
            NOT: { status: "Done" },
          },
        }),

        // Due soon: dueDate between now and now+3 days AND status != Done
        prisma.wehowareTask.count({
          where: {
            ...baseWhere,
            dueDate: { gte: now, lte: threeDaysFromNow },
            NOT: { status: "Done" },
          },
        }),

        // Aggregate hours tracked and estimated
        prisma.wehowareTask.aggregate({
          where: baseWhere,
          _sum: {
            actualHours: true,
            estimatedHours: true,
          },
        }),

        // Tasks with no estimate
        prisma.wehowareTask.count({
          where: {
            ...baseWhere,
            estimatedHours: null,
          },
        }),
      ]);

      const totalTasks = allTasks.length;

      // Group by status
      const byStatus = {};
      for (const s of allStatuses) {
        byStatus[STATUS_DISPLAY[s]] = 0;
      }
      for (const task of allTasks) {
        if (task.status) {
          const label = STATUS_DISPLAY[task.status] ?? task.status;
          byStatus[label] = (byStatus[label] ?? 0) + 1;
        }
      }

      // Group by priority
      const byPriority = {};
      for (const p of allPriorities) {
        byPriority[p] = 0;
      }
      for (const task of allTasks) {
        if (task.priority) {
          byPriority[task.priority] = (byPriority[task.priority] ?? 0) + 1;
        }
      }

      const doneCount = byStatus["Done"] ?? 0;
      const completionRate =
        totalTasks > 0
          ? Math.round((doneCount / totalTasks) * 1000) / 10
          : 0;

      const totalHoursTracked = Number(hoursAggregate._sum.actualHours ?? 0);
      const totalEstimatedHours = Number(hoursAggregate._sum.estimatedHours ?? 0);

      return NextResponse.json({
        total_tasks: totalTasks,
        by_status: byStatus,
        by_priority: byPriority,
        overdue_count: overdueCount,
        due_soon_count: dueSoonCount,
        completion_rate: completionRate,
        total_hours_tracked: totalHoursTracked,
        total_estimated_hours: totalEstimatedHours,
        tasks_with_no_estimate: noEstimateCount,
      });
    } catch (err) {
      console.error("[GET /api/v1/reports/dashboard] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch dashboard report" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
