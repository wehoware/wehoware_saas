/**
 * /api/v1/tasks/[id]/time-entries
 *
 * GET  — List time entries for a task with optional filters.
 *         Returns { entries, total_hours, by_user }.
 * POST — Log a new time entry against a task (and optionally a subtask).
 *         Atomically updates task.actualHours and task.remainingHours.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TIME_ENTRY_INCLUDE = {
  user: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
};

function shapeEntry(e) {
  return {
    id: e.id,
    task_id: e.taskId,
    subtask_id: e.subtaskId,
    user_id: e.userId,
    hours_spent: Number(e.hoursSpent),
    notes: e.notes,
    tracked_date: e.trackedDate,
    created_at: e.createdAt,
    user: e.user
      ? {
          id: e.user.id,
          first_name: e.user.firstName,
          last_name: e.user.lastName,
          avatar_url: e.user.avatarUrl,
        }
      : null,
  };
}

/**
 * Check whether the requesting user is allowed to access the given task.
 * Employees may only access tasks they are assigned to.
 * Admins are scoped to their active client context when one is set.
 */
async function canAccessTask(prisma, user, taskId) {
  const where = { id: taskId };
  if (user.role === "employee") where.assigneeId = user.id;
  if (user.role === "client") where.clientId = user.clientId ?? "__none__";
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
// GET /api/v1/tasks/[id]/time-entries
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: taskId } = await params;
      const { searchParams } = new URL(request.url);

      // Verify the requesting user can see this task.
      const allowed = await canAccessTask(prisma, user, taskId);
      if (!allowed) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      // Build filter clause.
      const where = { taskId };

      const startDate = searchParams.get("start_date");
      const endDate = searchParams.get("end_date");
      if (startDate || endDate) {
        where.trackedDate = {};
        if (startDate) where.trackedDate.gte = new Date(startDate);
        if (endDate) where.trackedDate.lte = new Date(endDate);
      }

      // Only admins may filter by a specific user; employees always see all
      // entries for the task (not just their own) so the full log is visible.
      const userIdFilter = searchParams.get("user_id");
      if (userIdFilter) {
        if (user.role !== "admin") {
          return NextResponse.json(
            { error: "Forbidden - Only admins may filter by user_id" },
            { status: 403 }
          );
        }
        where.userId = userIdFilter;
      }

      const entries = await prisma.wehowareTaskTimeEntry.findMany({
        where,
        include: TIME_ENTRY_INCLUDE,
        orderBy: [{ trackedDate: "desc" }, { createdAt: "desc" }],
      });

      // Compute totals.
      let totalHours = 0;
      const byUser = {};

      for (const e of entries) {
        const hrs = Number(e.hoursSpent);
        totalHours += hrs;

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

      // Round accumulated floats to 2 dp to avoid IEEE 754 drift.
      totalHours = Math.round(totalHours * 100) / 100;
      for (const uid of Object.keys(byUser)) {
        byUser[uid].total_hours =
          Math.round(byUser[uid].total_hours * 100) / 100;
      }

      return NextResponse.json({
        entries: entries.map(shapeEntry),
        total_hours: totalHours,
        by_user: byUser,
      });
    } catch (err) {
      console.error("[GET /api/v1/tasks/[id]/time-entries] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch time entries" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);

// ---------------------------------------------------------------------------
// POST /api/v1/tasks/[id]/time-entries
// ---------------------------------------------------------------------------
export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: taskId } = await params;

      // Parse and validate body.
      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }

      const { hours_spent, notes, tracked_date, subtask_id } = body ?? {};

      // hours_spent: required, numeric, 0.01–24
      if (hours_spent == null) {
        return NextResponse.json(
          { error: "hours_spent is required" },
          { status: 400 }
        );
      }
      const hoursNum = Number(hours_spent);
      if (!Number.isFinite(hoursNum) || hoursNum < 0.01 || hoursNum > 24) {
        return NextResponse.json(
          { error: "hours_spent must be a number between 0.01 and 24" },
          { status: 400 }
        );
      }

      // tracked_date: required, YYYY-MM-DD
      if (!tracked_date || typeof tracked_date !== "string") {
        return NextResponse.json(
          { error: "tracked_date is required (YYYY-MM-DD)" },
          { status: 400 }
        );
      }
      const dateObj = new Date(tracked_date);
      if (isNaN(dateObj.getTime())) {
        return NextResponse.json(
          { error: "tracked_date is not a valid date (use YYYY-MM-DD)" },
          { status: 400 }
        );
      }

      // Role-based task access check.
      const allowed = await canAccessTask(prisma, user, taskId);
      if (!allowed) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      // Create the time entry and update task hours atomically via a
      // Prisma interactive transaction.
      const entry = await prisma.$transaction(async (tx) => {
        const created = await tx.wehowareTaskTimeEntry.create({
          data: {
            taskId,
            subtaskId: subtask_id ?? null,
            userId: user.id,
            hoursSpent: hoursNum,
            notes: notes ?? null,
            trackedDate: dateObj,
          },
          include: TIME_ENTRY_INCLUDE,
        });

        // Fetch the current task to check remainingHours.
        const task = await tx.wehowareTask.findUnique({
          where: { id: taskId },
          select: { remainingHours: true },
        });

        const updateData = { actualHours: { increment: hoursNum } };

        if (task?.remainingHours != null) {
          const currentRemaining = Number(task.remainingHours);
          const newRemaining = Math.max(0, currentRemaining - hoursNum);
          updateData.remainingHours = newRemaining;
        }

        await tx.wehowareTask.update({
          where: { id: taskId },
          data: updateData,
        });

        return created;
      });

      // Fire-and-forget activity log.
      prisma.wehowareTaskActivity
        .create({
          data: {
            taskId,
            userId: user.id,
            activityType: "time_logged",
            details: {
              entry_id: entry.id,
              hours_spent: hoursNum,
              tracked_date,
            },
          },
        })
        .catch((err) =>
          console.warn(
            "[POST /api/v1/tasks/[id]/time-entries] activity log failed:",
            err
          )
        );

      return NextResponse.json(shapeEntry(entry), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/tasks/[id]/time-entries] error:", err);
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid task_id, subtask_id, or user reference" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to log time entry" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);
