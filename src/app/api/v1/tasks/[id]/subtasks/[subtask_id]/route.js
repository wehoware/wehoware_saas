/**
 * /api/v1/tasks/[id]/subtasks/[subtask_id]
 *
 * GET    — Fetch a single subtask (same task access rules apply).
 * PUT    — Update subtask fields; maintains completedAt and parent counters
 *          when status transitions to/from "Done".
 * DELETE — Remove subtask; adjusts parent subtaskCount and subtaskCompleted.
 *
 * Access control mirrors /api/v1/tasks/[id]:
 *   admin    — scoped to activeClientId when set; otherwise all clients.
 *   employee — task must be assigned to the requesting user.
 *   client   — blocked (allowedRoles excludes "client").
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";

// ---------------------------------------------------------------------------
// Status translation (keep in sync with tasks/[id]/route.js)
// ---------------------------------------------------------------------------
const STATUS_TO_PRISMA = {
  "To Do": "To_Do",
  "In Progress": "In_Progress",
  Done: "Done",
  Backlog: "Backlog",
};
const STATUS_FROM_PRISMA = {
  To_Do: "To Do",
  In_Progress: "In Progress",
  Done: "Done",
  Backlog: "Backlog",
};
function toPrismaStatus(s) {
  if (s == null) return s;
  return STATUS_TO_PRISMA[s] ?? s;
}
function fromPrismaStatus(s) {
  if (s == null) return s;
  return STATUS_FROM_PRISMA[s] ?? s;
}

// ---------------------------------------------------------------------------
// Prisma include for subtask queries
// ---------------------------------------------------------------------------
const SUBTASK_INCLUDE = {
  assignee: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
};

// ---------------------------------------------------------------------------
// Shape a Prisma subtask row into a snake_case response object
// ---------------------------------------------------------------------------
function shapeSubtask(s) {
  return {
    id: s.id,
    task_id: s.taskId,
    title: s.title,
    description: s.description ?? null,
    status: fromPrismaStatus(s.status),
    assignee_id: s.assigneeId ?? null,
    order_index: s.orderIndex,
    completed_at: s.completedAt ?? null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    created_by: s.createdBy ?? null,
    assignee: s.assignee
      ? {
          id: s.assignee.id,
          first_name: s.assignee.firstName,
          last_name: s.assignee.lastName,
          avatar_url: s.assignee.avatarUrl ?? null,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Role-aware task access check (same logic as comments/activities routes)
// ---------------------------------------------------------------------------
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
// Load a subtask belonging to the given task, or null if not found
// ---------------------------------------------------------------------------
async function loadSubtask(prisma, taskId, subtaskId) {
  return prisma.wehowareSubtask.findFirst({
    where: { id: subtaskId, taskId },
    include: SUBTASK_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/tasks/[id]/subtasks/[subtask_id]
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: taskId, subtask_id: subtaskId } = await params;

      const allowed = await canAccessTask(prisma, user, taskId);
      if (!allowed) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      const subtask = await loadSubtask(prisma, taskId, subtaskId);
      if (!subtask) {
        return NextResponse.json(
          { error: "Subtask not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(shapeSubtask(subtask));
    } catch (err) {
      console.error(
        "[GET /api/v1/tasks/[id]/subtasks/[subtask_id]] error:",
        err
      );
      return NextResponse.json(
        { error: "Failed to fetch subtask" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);

// ---------------------------------------------------------------------------
// PUT /api/v1/tasks/[id]/subtasks/[subtask_id]
// ---------------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    try {
      const { prisma, user } = request;
      const { id: taskId, subtask_id: subtaskId } = await params;

      const allowed = await canAccessTask(prisma, user, taskId);
      if (!allowed) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      const existing = await loadSubtask(prisma, taskId, subtaskId);
      if (!existing) {
        return NextResponse.json(
          { error: "Subtask not found" },
          { status: 404 }
        );
      }

      // Build update data
      const data = {};
      const changedFields = {};

      if (body.title !== undefined) {
        const title =
          typeof body.title === "string" ? body.title.trim() : null;
        if (!title) {
          return NextResponse.json(
            { error: "title cannot be empty" },
            { status: 400 }
          );
        }
        if (title.length > 500) {
          return NextResponse.json(
            { error: "title must be 500 characters or fewer" },
            { status: 400 }
          );
        }
        data.title = title;
        if (title !== existing.title) {
          changedFields.title = { from: existing.title, to: title };
        }
      }

      if (body.description !== undefined) {
        const desc =
          body.description === null ? null : String(body.description);
        data.description = desc;
        if (desc !== (existing.description ?? null)) {
          changedFields.description = {
            from: existing.description ?? null,
            to: desc,
          };
        }
      }

      if (body.assignee_id !== undefined || body.assigneeId !== undefined) {
        const assigneeId =
          body.assignee_id !== undefined
            ? body.assignee_id
            : body.assigneeId;
        data.assigneeId = assigneeId ?? null;
        if ((assigneeId ?? null) !== (existing.assigneeId ?? null)) {
          changedFields.assignee_id = {
            from: existing.assigneeId ?? null,
            to: assigneeId ?? null,
          };
        }
      }

      if (body.order_index !== undefined || body.orderIndex !== undefined) {
        const orderIndex = body.order_index ?? body.orderIndex;
        if (typeof orderIndex === "number") {
          data.orderIndex = orderIndex;
        }
      }

      // Status transition — handle completedAt and parent counters
      let completedDelta = 0; // +1 if newly Done, -1 if leaving Done
      if (body.status !== undefined) {
        const newPrismaStatus = toPrismaStatus(body.status);
        const oldPrismaStatus = existing.status;

        if (newPrismaStatus !== oldPrismaStatus) {
          changedFields.status = {
            from: fromPrismaStatus(oldPrismaStatus),
            to: fromPrismaStatus(newPrismaStatus),
          };

          data.status = newPrismaStatus;

          if (newPrismaStatus === "Done") {
            // Transitioning TO Done
            data.completedAt = new Date();
            completedDelta = 1;
          } else if (oldPrismaStatus === "Done") {
            // Transitioning FROM Done
            data.completedAt = null;
            completedDelta = -1;
          }
        }
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      // Build the transaction operations
      const ops = [
        prisma.wehowareSubtask.update({
          where: { id: subtaskId },
          data,
          include: SUBTASK_INCLUDE,
        }),
      ];

      if (completedDelta === 1) {
        ops.push(
          prisma.wehowareTask.update({
            where: { id: taskId },
            data: { subtaskCompleted: { increment: 1 } },
          })
        );
      } else if (completedDelta === -1) {
        // Decrement but never go below 0: read current value and clamp
        ops.push(
          prisma.$executeRaw`
            UPDATE wehoware_tasks
            SET subtask_completed = GREATEST(0, subtask_completed - 1)
            WHERE id = ${taskId}
          `
        );
      }

      const [updated] = await prisma.$transaction(ops);

      // Fire-and-forget activity log (only when something actually changed)
      if (Object.keys(changedFields).length > 0) {
        prisma.wehowareTaskActivity
          .create({
            data: {
              taskId,
              userId: user.id,
              activityType: "subtask_updated",
              details: { subtask_id: subtaskId, changes: changedFields },
            },
          })
          .catch((err) =>
            console.warn(
              "[PUT /api/v1/tasks/[id]/subtasks/[subtask_id]] activity log failed:",
              err
            )
          );
      }

      return NextResponse.json(shapeSubtask(updated));
    } catch (err) {
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid assignee_id" },
          { status: 400 }
        );
      }
      if (err?.name === "PrismaClientValidationError") {
        return NextResponse.json(
          { error: "Invalid subtask fields (check status value)" },
          { status: 400 }
        );
      }
      console.error(
        "[PUT /api/v1/tasks/[id]/subtasks/[subtask_id]] error:",
        err
      );
      return NextResponse.json(
        { error: "Failed to update subtask" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);

// ---------------------------------------------------------------------------
// DELETE /api/v1/tasks/[id]/subtasks/[subtask_id]
// ---------------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: taskId, subtask_id: subtaskId } = await params;

      const allowed = await canAccessTask(prisma, user, taskId);
      if (!allowed) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      const existing = await loadSubtask(prisma, taskId, subtaskId);
      if (!existing) {
        return NextResponse.json(
          { error: "Subtask not found" },
          { status: 404 }
        );
      }

      const wasDone = existing.status === "Done";

      // Build atomic transaction: delete subtask + update parent counters
      const ops = [
        prisma.wehowareSubtask.delete({ where: { id: subtaskId } }),
        // Always decrement subtaskCount (min 0)
        prisma.$executeRaw`
          UPDATE wehoware_tasks
          SET subtask_count = GREATEST(0, subtask_count - 1)
          WHERE id = ${taskId}
        `,
      ];

      if (wasDone) {
        // Also decrement subtaskCompleted (min 0)
        ops.push(
          prisma.$executeRaw`
            UPDATE wehoware_tasks
            SET subtask_completed = GREATEST(0, subtask_completed - 1)
            WHERE id = ${taskId}
          `
        );
      }

      await prisma.$transaction(ops);

      // Fire-and-forget activity log
      prisma.wehowareTaskActivity
        .create({
          data: {
            taskId,
            userId: user.id,
            activityType: "subtask_deleted",
            details: { subtask_id: subtaskId, title: existing.title },
          },
        })
        .catch((err) =>
          console.warn(
            "[DELETE /api/v1/tasks/[id]/subtasks/[subtask_id]] activity log failed:",
            err
          )
        );

      return new NextResponse(null, { status: 204 });
    } catch (err) {
      console.error(
        "[DELETE /api/v1/tasks/[id]/subtasks/[subtask_id]] error:",
        err
      );
      return NextResponse.json(
        { error: "Failed to delete subtask" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);
