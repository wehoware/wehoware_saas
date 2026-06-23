/**
 * GET /api/v1/reports/overdue-tasks
 *
 * Returns all overdue tasks for admin users.
 * Query params:
 *   days_overdue  - number (default 0). Only return tasks overdue by at
 *                   least this many days.
 *
 * Filters: dueDate < (now - days_overdue) AND status != Done
 * Always scoped to user.activeClientId when set.
 * Results sorted by dueDate ASC (most overdue first).
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

      const daysOverdue = Math.max(
        0,
        parseInt(searchParams.get("days_overdue") || "0", 10) || 0
      );

      const now = new Date();
      // Cutoff date: tasks must be overdue by at least daysOverdue days
      const cutoff = new Date(now.getTime() - daysOverdue * 24 * 60 * 60 * 1000);

      const where = {
        dueDate: { lt: cutoff },
        NOT: { status: "Done" },
      };
      if (user.activeClientId) where.clientId = user.activeClientId;

      // Optional filters
      const userIdFilter = searchParams.get("user_id");
      const priorityFilter = searchParams.get("priority");
      if (userIdFilter) where.assigneeId = userIdFilter;
      if (priorityFilter) where.priority = priorityFilter;

      const tasks = await prisma.wehowareTask.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          assigneeId: true,
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { dueDate: "asc" },
      });

      const serialized = tasks.map((task) => {
        const dueDateObj = task.dueDate ? new Date(task.dueDate) : null;
        const daysOverdueCalc = dueDateObj
          ? Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          id: task.id,
          title: task.title,
          status: task.status ? (STATUS_DISPLAY[task.status] ?? task.status) : null,
          priority: task.priority ?? null,
          due_date: dueDateObj ? dueDateObj.toISOString().split("T")[0] : null,
          days_overdue: daysOverdueCalc,
          assignee: task.assignee
            ? {
                id: task.assignee.id,
                first_name: task.assignee.firstName ?? null,
                last_name: task.assignee.lastName ?? null,
              }
            : null,
        };
      });

      return NextResponse.json({
        tasks: serialized,
        total: serialized.length,
      });
    } catch (err) {
      console.error("[GET /api/v1/reports/overdue-tasks] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch overdue tasks report" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "client"] }
);
