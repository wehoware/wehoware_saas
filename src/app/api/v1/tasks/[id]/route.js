/**
 * /api/v1/tasks/[id]
 *
 * Prisma/MySQL-backed handlers for a single task.
 *
 * Role rules (kept compatible with the pre-migration behavior):
 *  - admin     — full access; scoped to active client context when set.
 *  - employee  — can only see / mutate tasks they're assigned to.
 *  - client    — read-only in other routes; this route is admin/employee.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import {
  buildTaskWhere,
  canMutateTask,
  validateAssignee,
} from "../../../utils/task-access";

// Fields whose changes we audit in wehoware_task_activities. The left side
// is the snake_case body key; the right side is the Prisma/camelCase column.
const TRACKED_FIELDS = [
  { body: "status", col: "status" },
  { body: "priority", col: "priority" },
  { body: "assignee_id", col: "assigneeId" },
  { body: "title", col: "title" },
  { body: "description", col: "description" },
  { body: "due_date", col: "dueDate" },
];

// Keep these in sync with src/app/api/v1/tasks/route.js — see that file
// for the rationale behind the To Do / To_Do translation.
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

const TASK_INCLUDE = {
  client: { select: { id: true, companyName: true } },
  assignee: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
};

function shapeTask(task) {
  if (!task) return task;
  const out = { ...task, status: fromPrismaStatus(task.status) };
  if (task.client) {
    out.client = { id: task.client.id, company_name: task.client.companyName };
  }
  if (task.assignee) {
    out.assignee = {
      id: task.assignee.id,
      first_name: task.assignee.firstName,
      last_name: task.assignee.lastName,
      avatar_url: task.assignee.avatarUrl,
    };
  }
  return out;
}

/**
 * Load a task the user is allowed to access.
 * Returns the Prisma task (with relations), or null when not found / not accessible.
 */
async function loadTask(prisma, user, id) {
  const visibilityWhere = await buildTaskWhere(prisma, user);
  visibilityWhere.id = id;
  return prisma.wehowareTask.findFirst({
    where: visibilityWhere,
    include: TASK_INCLUDE,
  });
}

// -------------------------------------------------------------------
// GET
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const task = await loadTask(prisma, user, id);
      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      // Attach mutation permission flag for the UI
      const out = shapeTask(task);
      out._permissions = canMutateTask(user, task);
      return NextResponse.json(out);
    } catch (err) {
      console.error("[GET /api/v1/tasks/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch task" },
        { status: 500 }
      );
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

      const existing = await loadTask(prisma, user, id);
      if (!existing) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      // Check edit permission
      const mutationCheck = canMutateTask(user, existing);
      if (!mutationCheck.allowed) {
        return NextResponse.json({ error: mutationCheck.reason }, { status: 403 });
      }

      // Validate assignee change if present
      const assigneeVal = body.assignee_id ?? body.assigneeId ?? undefined;
      if (assigneeVal !== undefined) {
        const clientId = existing.clientId;
        const isValid = await validateAssignee(
          prisma,
          user,
          clientId,
          assigneeVal || null
        );
        if (!isValid) {
          return NextResponse.json(
            { error: "Invalid assignee for this client" },
            { status: 400 }
          );
        }
      }
      const data = {};

      // Accept both snake_case and camelCase from callers.
      if (body.title !== undefined) data.title = body.title;
      if (body.description !== undefined) data.description = body.description;
      if (body.priority !== undefined) data.priority = body.priority;
      if (body.status !== undefined) data.status = toPrismaStatus(body.status);

      if (body.due_date !== undefined || body.dueDate !== undefined) {
        const raw = body.due_date ?? body.dueDate;
        data.dueDate = raw ? new Date(raw) : null;
      }
      if (body.assignee_id !== undefined || body.assigneeId !== undefined) {
        data.assigneeId = body.assignee_id ?? body.assigneeId ?? null;
      }
      if (body.client_id !== undefined || body.clientId !== undefined) {
        data.clientId = body.client_id ?? body.clientId;
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      const updated = await prisma.wehowareTask.update({
        where: { id },
        data,
        include: TASK_INCLUDE,
      });

      // Build activity log entries for any tracked field that changed.
      const activities = [];
      for (const { body: bodyKey, col } of TRACKED_FIELDS) {
        const camelKey =
          bodyKey === "assignee_id"
            ? "assigneeId"
            : bodyKey === "due_date"
              ? "dueDate"
              : bodyKey;
        const hasKey =
          Object.prototype.hasOwnProperty.call(body, bodyKey) ||
          Object.prototype.hasOwnProperty.call(body, camelKey);
        if (!hasKey) continue;

        const from = existing[col] ?? null;
        const to = updated[col] ?? null;
        // Normalize Dates for comparison so timezone reshuffling doesn't
        // cause a phantom "changed" entry.
        const fromComp = from instanceof Date ? from.toISOString() : from;
        const toComp = to instanceof Date ? to.toISOString() : to;
        if (fromComp === toComp) continue;

        activities.push({
          taskId: id,
          userId: user.id,
          activityType: `${bodyKey}_change`,
          details: { from: fromComp, to: toComp },
        });
      }

      if (activities.length > 0) {
        try {
          await prisma.wehowareTaskActivity.createMany({ data: activities });
        } catch (activityErr) {
          // Audit failure shouldn't fail the request.
          console.warn(
            "[PUT /api/v1/tasks/[id]] activity log failed:",
            activityErr
          );
        }
      }

      return NextResponse.json(shapeTask(updated));
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid client_id or assignee_id" },
          { status: 400 }
        );
      }
      if (err?.name === "PrismaClientValidationError") {
        return NextResponse.json(
          { error: "Invalid task fields (check status/priority values)" },
          { status: 400 }
        );
      }
      console.error("[PUT /api/v1/tasks/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to update task" },
        { status: 500 }
      );
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

      const existing = await loadTask(prisma, user, id);
      if (!existing) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      // Check delete permission
      const mutationCheck = canMutateTask(user, existing);
      if (!mutationCheck.allowed) {
        return NextResponse.json({ error: mutationCheck.reason }, { status: 403 });
      }

      // Log deletion BEFORE deleting, so if the activity insert fails we
      // still have the task row. The activity will be orphaned if the
      // cascade removes task activities; schema should relax that FK if
      // audit retention matters. For now, we keep the pre-migration
      // behavior of inserting a "deleted" activity.
      try {
        await prisma.wehowareTaskActivity.create({
          data: {
            taskId: id,
            userId: user.id,
            activityType: "deleted",
            details: { title: existing.title },
          },
        });
      } catch (activityErr) {
        console.warn(
          "[DELETE /api/v1/tasks/[id]] activity log failed:",
          activityErr
        );
      }

      await prisma.wehowareTask.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[DELETE /api/v1/tasks/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to delete task" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
