/**
 * /api/v1/tasks/[id]/time-summary
 *
 * GET — Returns a comprehensive time summary for a single task:
 *   estimated_hours, actual_hours, remaining_hours, story_points,
 *   hours_variance (actual - estimated), completion_percentage,
 *   and a per-user breakdown (by_user).
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

/**
 * Check whether the requesting user is allowed to access the given task.
 */
async function canAccessTask(prisma, user, taskId) {
  const where = { id: taskId };
  if (user.role === "employee") where.assigneeId = user.id;
  if (user.role === "client") {
    const clientId = user.activeClientId ?? user.clientId ?? "__none__";
    where.clientId = clientId;
    if (user.activeClientRole === "editor") where.assigneeId = user.id;
  }
  if (user.role === "admin" && user.activeClientId) {
    where.clientId = user.activeClientId;
  }
  const hit = await prisma.wehowareTask.findFirst({
    where,
    select: { id: true },
  });
  return Boolean(hit);
}

// ---------------------------------------------------------------------------
// GET /api/v1/tasks/[id]/time-summary
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: taskId } = await params;

      // Verify task access first.
      const taskAccessible = await canAccessTask(prisma, user, taskId);
      if (!taskAccessible) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      // Load task fields relevant to time tracking alongside all time entries
      // in a single round trip.
      const [task, entries] = await Promise.all([
        prisma.wehowareTask.findUnique({
          where: { id: taskId },
          select: {
            estimatedHours: true,
            actualHours: true,
            remainingHours: true,
            storyPoints: true,
          },
        }),
        prisma.wehowareTaskTimeEntry.findMany({
          where: { taskId },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { trackedDate: "asc" },
        }),
      ]);

      if (!task) {
        // Race condition guard — task was deleted between access check and fetch.
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      const estimatedHours =
        task.estimatedHours != null ? Number(task.estimatedHours) : null;
      const actualHours = Number(task.actualHours ?? 0);
      const remainingHours =
        task.remainingHours != null ? Number(task.remainingHours) : null;
      const storyPoints = task.storyPoints ?? null;

      // hours_variance: positive means under estimate, negative means over.
      // Only computed when estimatedHours is known.
      const hoursVariance =
        estimatedHours != null
          ? Math.round((estimatedHours - actualHours) * 100) / 100
          : null;

      // completion_percentage: percentage of estimated hours consumed.
      // Capped at 100 for over-budget tasks; 0 when no estimate.
      let completionPercentage = null;
      if (estimatedHours != null && estimatedHours > 0) {
        completionPercentage = Math.min(
          100,
          Math.round((actualHours / estimatedHours) * 100)
        );
      } else if (estimatedHours === 0) {
        completionPercentage = actualHours > 0 ? 100 : 0;
      }

      // Build per-user aggregation from raw time entries.
      const byUser = {};
      for (const e of entries) {
        const hrs = Number(e.hoursSpent);
        if (!byUser[e.userId]) {
          byUser[e.userId] = {
            user_id: e.userId,
            first_name: e.user?.firstName ?? null,
            last_name: e.user?.lastName ?? null,
            total_hours: 0,
            entry_count: 0,
          };
        }
        byUser[e.userId].total_hours += hrs;
        byUser[e.userId].entry_count += 1;
      }

      // Round per-user totals to avoid IEEE 754 drift.
      for (const uid of Object.keys(byUser)) {
        byUser[uid].total_hours =
          Math.round(byUser[uid].total_hours * 100) / 100;
      }

      return NextResponse.json({
        estimated_hours: estimatedHours,
        actual_hours: Math.round(actualHours * 100) / 100,
        remaining_hours:
          remainingHours != null
            ? Math.round(remainingHours * 100) / 100
            : null,
        story_points: storyPoints,
        hours_variance: hoursVariance,
        completion_percentage: completionPercentage,
        by_user: byUser,
      });
    } catch (err) {
      console.error("[GET /api/v1/tasks/[id]/time-summary] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch time summary" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
