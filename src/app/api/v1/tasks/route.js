/**
 * /api/v1/tasks
 *
 * Prisma/MySQL-backed replacement for the old Supabase handler.
 *
 * GET  — paginated list of tasks (role-filtered)
 * POST — create a task + log "created" activity
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const SORTABLE_FIELDS = new Set([
  "created_at",
  "title",
  "status",
  "priority",
  "due_date",
]);
const FIELD_MAP = {
  created_at: "createdAt",
  title: "title",
  status: "status",
  priority: "priority",
  due_date: "dueDate",
};

// TaskStatus enum: Prisma JS identifiers use underscores (To_Do, In_Progress)
// but the legacy UI sends / expects the original DB values with spaces
// ("To Do", "In Progress"). These helpers translate in both directions so
// the API accepts either form and always returns the UI-friendly form.
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
  if (STATUS_TO_PRISMA[s]) return STATUS_TO_PRISMA[s];
  // Already in Prisma form (To_Do, In_Progress, …) or an unknown value
  return s;
}
function fromPrismaStatus(s) {
  if (s == null) return s;
  return STATUS_FROM_PRISMA[s] ?? s;
}

// Standard include used across GET endpoints to preserve response shape
// expected by the admin UI (client.company_name / assignee.first_name …).
const TASK_INCLUDE = {
  client: { select: { id: true, companyName: true } },
  assignee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
};

/**
 * Decorates a Prisma task row with snake_case-friendly relation aliases
 * (`client.company_name`, `assignee.first_name`, …) so existing admin
 * pages that consumed the Supabase response keep working.
 */
function shapeTask(task) {
  if (!task) return task;
  const out = { ...task, status: fromPrismaStatus(task.status) };
  if (task.client) {
    out.client = {
      id: task.client.id,
      company_name: task.client.companyName,
    };
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

// -------------------------------------------------------------------
// GET /api/v1/tasks
// -------------------------------------------------------------------
export const GET = withAuth(async (request) => {
  try {
    const { prisma, user } = request;
    const { searchParams } = new URL(request.url);

    const page = Math.max(
      1,
      parseInt(searchParams.get("page") || "1", 10)
    );
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10)
      )
    );

    const sortFieldRaw = searchParams.get("sortField") || "created_at";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const searchQuery = searchParams.get("q");
    const assigneeFilter = searchParams.get("assignee_id");

    const where = {};
    if (status) where.status = toPrismaStatus(status);
    if (priority) where.priority = priority;

    // Role-based scoping
    if (user.role === "employee") {
      // Employees ONLY see tasks assigned to them
      where.assigneeId = user.id;
    } else if (user.role === "client") {
      // Clients see tasks for their own client(s)
      where.clientId = user.clientId;
    } else if (user.role === "admin") {
      // Admin scoped to active client context (if any); optional assignee filter
      if (user.activeClientId) {
        where.clientId = user.activeClientId;
      }
      if (assigneeFilter) where.assigneeId = assigneeFilter;
    }

    if (searchQuery) {
      where.OR = [
        { title: { contains: searchQuery } },
        { description: { contains: searchQuery } },
      ];
    }

    // Sort — "clientName" sorts by the related client's companyName
    let orderBy;
    if (sortFieldRaw === "clientName") {
      orderBy = { client: { companyName: sortOrder } };
    } else {
      const sortField = SORTABLE_FIELDS.has(sortFieldRaw)
        ? FIELD_MAP[sortFieldRaw]
        : "createdAt";
      orderBy = { [sortField]: sortOrder };
    }

    const [items, total] = await Promise.all([
      prisma.wehowareTask.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wehowareTask.count({ where }),
    ]);

    return NextResponse.json({
      tasks: items.map(shapeTask),
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("[GET /api/v1/tasks] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
});

// -------------------------------------------------------------------
// POST /api/v1/tasks
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const body = await request.json();
      const {
        title,
        description,
        due_date,
        priority,
        status,
        client_id,
        assignee_id,
      } = body ?? {};

      if (!title || !client_id) {
        return NextResponse.json(
          { error: "Title and Client are required" },
          { status: 400 }
        );
      }

      const task = await prisma.wehowareTask.create({
        data: {
          title,
          description: description ?? null,
          dueDate: due_date ? new Date(due_date) : null,
          priority: priority ?? null,
          status: status ? toPrismaStatus(status) : null,
          clientId: client_id,
          assigneeId: assignee_id ?? null,
          createdBy: user.id,
        },
        include: TASK_INCLUDE,
      });

      // Log "created" activity (fire-and-forget semantics — don't fail
      // the request if the audit insert fails).
      prisma.wehowareTaskActivity
        .create({
          data: {
            taskId: task.id,
            userId: user.id,
            activityType: "created",
            details: { title: task.title },
          },
        })
        .catch((err) =>
          console.warn("[POST /api/v1/tasks] activity log failed:", err)
        );

      return NextResponse.json(shapeTask(task), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/tasks] error:", err);
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
      return NextResponse.json(
        { error: "Failed to create task" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);
