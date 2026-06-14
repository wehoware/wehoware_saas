/**
 * /api/v1/tasks/[id]/time-entries/[entry_id]
 *
 * PUT    — Update an existing time entry (owner or admin only).
 *          Recalculates task.actualHours and task.remainingHours.
 * DELETE — Delete a time entry (owner or admin only).
 *          Subtracts hours from task.actualHours (floor 0).
 *          Recalculates task.remainingHours.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";
import { canAccessTask } from "../../../../../utils/task-access";

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

// ---------------------------------------------------------------------------
// PUT /api/v1/tasks/[id]/time-entries/[entry_id]
// ---------------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: taskId, entry_id: entryId } = await params;

      // Viewers may not update time entries
      if (user.role === "client" && user.activeClientRole === "viewer") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Verify task access.
      const taskAccessible = await canAccessTask(prisma, user, taskId);
      if (!taskAccessible) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      // Load the existing entry.
      const existing = await prisma.wehowareTaskTimeEntry.findFirst({
        where: { id: entryId, taskId },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Time entry not found" },
          { status: 404 }
        );
      }

      // Only the owner, an admin, or a client manager/owner may update.
      const isPrivilegedUser =
        user.role === "admin" ||
        (user.role === "client" && ["client", "manager"].includes(user.activeClientRole));
      if (!isPrivilegedUser && existing.userId !== user.id) {
        return NextResponse.json(
          { error: "Forbidden - You can only update your own time entries" },
          { status: 403 }
        );
      }

      // Parse body.
      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }

      const updateData = {};
      let newHoursNum = Number(existing.hoursSpent);

      // hours_spent — optional, but must be valid if present.
      if (body.hours_spent !== undefined) {
        const h = Number(body.hours_spent);
        if (!Number.isFinite(h) || h < 0.01 || h > 24) {
          return NextResponse.json(
            { error: "hours_spent must be a number between 0.01 and 24" },
            { status: 400 }
          );
        }
        updateData.hoursSpent = h;
        newHoursNum = h;
      }

      // notes — optional, allow null to clear.
      if (body.notes !== undefined) {
        updateData.notes = body.notes ?? null;
      }

      // tracked_date — optional, must be valid YYYY-MM-DD if present.
      if (body.tracked_date !== undefined) {
        const dateObj = new Date(body.tracked_date);
        if (isNaN(dateObj.getTime())) {
          return NextResponse.json(
            { error: "tracked_date is not a valid date (use YYYY-MM-DD)" },
            { status: 400 }
          );
        }
        updateData.trackedDate = dateObj;
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      const oldHoursNum = Number(existing.hoursSpent);
      const hoursDiff = newHoursNum - oldHoursNum;

      // Update entry and recalculate task hours in a transaction.
      const updated = await prisma.$transaction(async (tx) => {
        const updatedEntry = await tx.wehowareTaskTimeEntry.update({
          where: { id: entryId },
          data: updateData,
          include: TIME_ENTRY_INCLUDE,
        });

        if (hoursDiff !== 0) {
          // Fetch task to determine current hours values.
          const task = await tx.wehowareTask.findUnique({
            where: { id: taskId },
            select: { actualHours: true, remainingHours: true },
          });

          const currentActual = Number(task?.actualHours ?? 0);
          const newActual = Math.max(0, currentActual + hoursDiff);

          const taskUpdateData = { actualHours: newActual };

          if (task?.remainingHours != null) {
            const currentRemaining = Number(task.remainingHours);
            // If hours increased, remaining decreases; if decreased, remaining grows.
            const newRemaining = Math.max(0, currentRemaining - hoursDiff);
            taskUpdateData.remainingHours = newRemaining;
          }

          await tx.wehowareTask.update({
            where: { id: taskId },
            data: taskUpdateData,
          });
        }

        return updatedEntry;
      });

      // Fire-and-forget activity log.
      prisma.wehowareTaskActivity
        .create({
          data: {
            taskId,
            userId: user.id,
            activityType: "time_entry_updated",
            details: {
              entry_id: entryId,
              old_hours: oldHoursNum,
              new_hours: newHoursNum,
            },
          },
        })
        .catch((err) =>
          console.warn(
            "[PUT /api/v1/tasks/[id]/time-entries/[entry_id]] activity log failed:",
            err
          )
        );

      return NextResponse.json(shapeEntry(updated));
    } catch (err) {
      console.error(
        "[PUT /api/v1/tasks/[id]/time-entries/[entry_id]] error:",
        err
      );
      return NextResponse.json(
        { error: "Failed to update time entry" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);

// ---------------------------------------------------------------------------
// DELETE /api/v1/tasks/[id]/time-entries/[entry_id]
// ---------------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: taskId, entry_id: entryId } = await params;

      // Viewers may not delete time entries
      if (user.role === "client" && user.activeClientRole === "viewer") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Verify task access.
      const taskAccessible = await canAccessTask(prisma, user, taskId);
      if (!taskAccessible) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      // Load the existing entry.
      const existing = await prisma.wehowareTaskTimeEntry.findFirst({
        where: { id: entryId, taskId },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Time entry not found" },
          { status: 404 }
        );
      }

      // Only the owner, an admin, or a client manager/owner may delete.
      const isPrivilegedUser =
        user.role === "admin" ||
        (user.role === "client" && ["client", "manager"].includes(user.activeClientRole));
      if (!isPrivilegedUser && existing.userId !== user.id) {
        return NextResponse.json(
          { error: "Forbidden - You can only delete your own time entries" },
          { status: 403 }
        );
      }

      const removedHours = Number(existing.hoursSpent);

      // Delete entry and update task hours atomically.
      await prisma.$transaction(async (tx) => {
        await tx.wehowareTaskTimeEntry.delete({ where: { id: entryId } });

        // Fetch current task hours.
        const task = await tx.wehowareTask.findUnique({
          where: { id: taskId },
          select: { actualHours: true, remainingHours: true, estimatedHours: true },
        });

        const currentActual = Number(task?.actualHours ?? 0);
        const newActual = Math.max(0, currentActual - removedHours);

        const taskUpdateData = { actualHours: newActual };

        if (task?.remainingHours != null) {
          // Restoring deleted hours means remaining goes back up, but must
          // not exceed estimatedHours (if set) to avoid inflating past original.
          const currentRemaining = Number(task.remainingHours);
          let newRemaining = currentRemaining + removedHours;
          if (task.estimatedHours != null) {
            const estimated = Number(task.estimatedHours);
            // remaining can be at most (estimated - newActual) after deletion
            newRemaining = Math.min(newRemaining, estimated - newActual);
            newRemaining = Math.max(0, newRemaining);
          }
          taskUpdateData.remainingHours = newRemaining;
        }

        await tx.wehowareTask.update({
          where: { id: taskId },
          data: taskUpdateData,
        });
      });

      // Fire-and-forget activity log.
      prisma.wehowareTaskActivity
        .create({
          data: {
            taskId,
            userId: user.id,
            activityType: "time_entry_deleted",
            details: {
              entry_id: entryId,
              hours_removed: removedHours,
            },
          },
        })
        .catch((err) =>
          console.warn(
            "[DELETE /api/v1/tasks/[id]/time-entries/[entry_id]] activity log failed:",
            err
          )
        );

      return new NextResponse(null, { status: 204 });
    } catch (err) {
      console.error(
        "[DELETE /api/v1/tasks/[id]/time-entries/[entry_id]] error:",
        err
      );
      return NextResponse.json(
        { error: "Failed to delete time entry" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
