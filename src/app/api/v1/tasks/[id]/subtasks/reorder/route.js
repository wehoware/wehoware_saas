/**
 * /api/v1/tasks/[id]/subtasks/reorder
 *
 * PATCH — Reorder subtasks by setting each subtask's orderIndex to its
 *         position in the provided subtask_ids array.
 *
 * Body: { subtask_ids: string[] }
 *
 * Validates:
 *   - subtask_ids is a non-empty array of strings
 *   - every ID in the array belongs to the parent task
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
const STATUS_FROM_PRISMA = {
  To_Do: "To Do",
  In_Progress: "In Progress",
  Done: "Done",
  Backlog: "Backlog",
};
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
// PATCH /api/v1/tasks/[id]/subtasks/reorder
// ---------------------------------------------------------------------------
export const PATCH = withAuth(
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
      const { id: taskId } = await params;

      // Validate subtask_ids
      const { subtask_ids } = body ?? {};
      if (
        !Array.isArray(subtask_ids) ||
        subtask_ids.length === 0 ||
        !subtask_ids.every((x) => typeof x === "string" && x.trim().length > 0)
      ) {
        return NextResponse.json(
          {
            error:
              "subtask_ids must be a non-empty array of non-empty strings",
          },
          { status: 400 }
        );
      }

      // Deduplicate while preserving order (first occurrence wins)
      const seen = new Set();
      const orderedIds = [];
      for (const id of subtask_ids) {
        if (!seen.has(id)) {
          seen.add(id);
          orderedIds.push(id);
        }
      }

      const allowed = await canAccessTask(prisma, user, taskId);
      if (!allowed) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      // Verify every supplied ID belongs to this task
      const existing = await prisma.wehowareSubtask.findMany({
        where: { taskId },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((s) => s.id));

      const invalidIds = orderedIds.filter((id) => !existingIds.has(id));
      if (invalidIds.length > 0) {
        return NextResponse.json(
          {
            error: "Some subtask_ids do not belong to this task",
            invalid_ids: invalidIds,
          },
          { status: 400 }
        );
      }

      // Update each subtask's orderIndex to its position in the supplied array.
      // Use a transaction so a partial failure rolls back cleanly.
      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.wehowareSubtask.update({
            where: { id },
            data: { orderIndex: index },
          })
        )
      );

      // Fetch and return subtasks in the new order (include any subtasks not
      // present in the supplied list, appended at the end by their current
      // orderIndex so the caller always gets the full list).
      const updatedSubtasks = await prisma.wehowareSubtask.findMany({
        where: { taskId },
        include: SUBTASK_INCLUDE,
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      });

      return NextResponse.json({
        subtasks: updatedSubtasks.map(shapeSubtask),
      });
    } catch (err) {
      console.error(
        "[PATCH /api/v1/tasks/[id]/subtasks/reorder] error:",
        err
      );
      return NextResponse.json(
        { error: "Failed to reorder subtasks" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);
