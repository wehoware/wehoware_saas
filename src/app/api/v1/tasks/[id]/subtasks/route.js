/**
 * /api/v1/tasks/[id]/subtasks
 *
 * GET  — List all subtasks for a task, with completion stats.
 * POST — Create a new subtask; increments parent subtaskCount.
 *
 * Access control mirrors /api/v1/tasks/[id]:
 *   admin    — scoped to activeClientId when set; otherwise all clients.
 *   employee — task must be assigned to the requesting user.
 *   client   — blocked (allowedRoles excludes "client").
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

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
// GET /api/v1/tasks/[id]/subtasks
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: taskId } = await params;

      const allowed = await canAccessTask(prisma, user, taskId);
      if (!allowed) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      const subtasks = await prisma.wehowareSubtask.findMany({
        where: { taskId },
        include: SUBTASK_INCLUDE,
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      });

      const total = subtasks.length;
      const completed = subtasks.filter((s) => s.status === "Done").length;
      const completion_percentage =
        total > 0 ? Math.round((completed / total) * 100) : 0;

      return NextResponse.json({
        subtasks: subtasks.map(shapeSubtask),
        total,
        completion_percentage,
      });
    } catch (err) {
      console.error("[GET /api/v1/tasks/[id]/subtasks] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch subtasks" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);

// ---------------------------------------------------------------------------
// POST /api/v1/tasks/[id]/subtasks
// ---------------------------------------------------------------------------
export const POST = withAuth(
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

      // Validate title
      const title =
        typeof body?.title === "string" ? body.title.trim() : null;
      if (!title) {
        return NextResponse.json(
          { error: "title is required" },
          { status: 400 }
        );
      }
      if (title.length > 500) {
        return NextResponse.json(
          { error: "title must be 500 characters or fewer" },
          { status: 400 }
        );
      }

      const allowed = await canAccessTask(prisma, user, taskId);
      if (!allowed) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      // Determine the next orderIndex (append to end)
      const lastSubtask = await prisma.wehowareSubtask.findFirst({
        where: { taskId },
        orderBy: { orderIndex: "desc" },
        select: { orderIndex: true },
      });
      const orderIndex = lastSubtask ? lastSubtask.orderIndex + 1 : 0;

      // Build creation payload
      const data = {
        taskId,
        title,
        orderIndex,
        createdBy: user.id,
      };
      if (body.description !== undefined && body.description !== null) {
        data.description = String(body.description);
      }
      if (body.status != null) {
        data.status = toPrismaStatus(body.status);
      }
      if (body.assignee_id != null || body.assigneeId != null) {
        data.assigneeId = body.assignee_id ?? body.assigneeId;
      }

      // Create subtask and increment parent counter atomically
      const [subtask] = await prisma.$transaction([
        prisma.wehowareSubtask.create({
          data,
          include: SUBTASK_INCLUDE,
        }),
        prisma.wehowareTask.update({
          where: { id: taskId },
          data: { subtaskCount: { increment: 1 } },
        }),
      ]);

      // Fire-and-forget activity log
      prisma.wehowareTaskActivity
        .create({
          data: {
            taskId,
            userId: user.id,
            activityType: "subtask_created",
            details: { subtask_id: subtask.id, title: subtask.title },
          },
        })
        .catch((err) =>
          console.warn(
            "[POST /api/v1/tasks/[id]/subtasks] activity log failed:",
            err
          )
        );

      return NextResponse.json(shapeSubtask(subtask), { status: 201 });
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
      console.error("[POST /api/v1/tasks/[id]/subtasks] error:", err);
      return NextResponse.json(
        { error: "Failed to create subtask" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);
