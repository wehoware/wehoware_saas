/**
 * GET /api/v1/reports/team-performance
 *
 * Team productivity metrics for admin users.
 * Query params: date_from, date_to (ISO strings)
 * Always scoped to user.activeClientId when set.
 *
 * Returns per-member stats: tasks assigned, tasks completed,
 * completion rate, hours logged, and overdue task count.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const { searchParams } = new URL(request.url);

      const dateFrom = searchParams.get("date_from");
      const dateTo = searchParams.get("date_to");

      const now = new Date();

      // Base task filter scoped to client and optional date range
      const taskWhere = {};
      if (user.activeClientId) taskWhere.clientId = user.activeClientId;
      if (dateFrom || dateTo) {
        taskWhere.createdAt = {};
        if (dateFrom) taskWhere.createdAt.gte = new Date(dateFrom);
        if (dateTo) taskWhere.createdAt.lte = new Date(dateTo);
      }

      // Fetch all tasks in scope (only columns needed for aggregation)
      const [tasks, profiles] = await Promise.all([
        prisma.wehowareTask.findMany({
          where: taskWhere,
          select: {
            assigneeId: true,
            status: true,
            dueDate: true,
            actualHours: true,
          },
        }),

        // Fetch all profiles so we can look up names without N+1 queries
        prisma.wehowareProfile.findMany({
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        }),
      ]);

      // Index profiles by id for O(1) lookup
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      // Aggregate stats per assignee
      const statsMap = new Map();

      for (const task of tasks) {
        if (!task.assigneeId) continue;

        if (!statsMap.has(task.assigneeId)) {
          statsMap.set(task.assigneeId, {
            tasks_assigned: 0,
            tasks_completed: 0,
            hours_logged: 0,
            overdue_tasks: 0,
          });
        }

        const stats = statsMap.get(task.assigneeId);
        stats.tasks_assigned += 1;

        if (task.status === "Done") {
          stats.tasks_completed += 1;
        }

        // Overdue: dueDate is past and task is not Done
        if (task.dueDate && task.dueDate < now && task.status !== "Done") {
          stats.overdue_tasks += 1;
        }

        stats.hours_logged += Number(task.actualHours ?? 0);
      }

      // Build response array — include any assignee found in tasks
      const team = [];
      for (const [userId, stats] of statsMap.entries()) {
        const profile = profileMap.get(userId);
        const completionRate =
          stats.tasks_assigned > 0
            ? Math.round((stats.tasks_completed / stats.tasks_assigned) * 1000) / 10
            : 0;

        team.push({
          user_id: userId,
          first_name: profile?.firstName ?? null,
          last_name: profile?.lastName ?? null,
          avatar_url: profile?.avatarUrl ?? null,
          tasks_assigned: stats.tasks_assigned,
          tasks_completed: stats.tasks_completed,
          completion_rate: completionRate,
          hours_logged: Math.round(stats.hours_logged * 100) / 100,
          overdue_tasks: stats.overdue_tasks,
        });
      }

      // Sort descending by tasks_assigned for a consistent default ordering
      team.sort((a, b) => b.tasks_assigned - a.tasks_assigned);

      return NextResponse.json({ team });
    } catch (err) {
      console.error("[GET /api/v1/reports/team-performance] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch team performance report" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
