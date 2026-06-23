/**
 * GET /api/v1/reports/task-list
 *
 * Detailed task list with filtering, sorting, and pagination.
 * Query params:
 *   date_from    - ISO string (filters on createdAt)
 *   date_to      - ISO string (filters on createdAt)
 *   status       - TaskStatus enum value (To_Do | In_Progress | Done | Backlog)
 *   priority     - TaskPriority enum value (Low | Medium | High)
 *   user_id      - filter by assignee
 *   search       - free-text search on task title
 *   sort_by      - "created_at" | "due_date" | "priority" | "status" | "title" (default: created_at)
 *   sort_dir     - "asc" | "desc" (default: desc)
 *   page         - page number (default: 1)
 *   page_size    - items per page (default: 20, max: 100)
 *
 * Always scoped to user.activeClientId when set.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

const STATUS_DISPLAY = {
  To_Do: "To Do",
  In_Progress: "In Progress",
  Done: "Done",
  Backlog: "Backlog",
};

const VALID_SORT_FIELDS = new Set([
  "created_at",
  "due_date",
  "priority",
  "status",
  "title",
]);

const PRIORITY_ORDER = { High: 3, Medium: 2, Low: 1 };
const STATUS_ORDER = { Backlog: 0, To_Do: 1, In_Progress: 2, Done: 3 };

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const { searchParams } = new URL(request.url);

      const dateFrom = searchParams.get("date_from");
      const dateTo = searchParams.get("date_to");
      const statusFilter = searchParams.get("status");
      const priorityFilter = searchParams.get("priority");
      const userIdFilter = searchParams.get("user_id");
      const search = searchParams.get("search");
      const sortBy = searchParams.get("sort_by") || "created_at";
      const sortDir = searchParams.get("sort_dir") === "asc" ? "asc" : "desc";
      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get("page_size") || "20", 10) || 20)
      );

      const validStatuses = new Set(["To_Do", "In_Progress", "Done", "Backlog"]);
      const validPriorities = new Set(["Low", "Medium", "High"]);

      if (statusFilter && !validStatuses.has(statusFilter)) {
        return NextResponse.json(
          { error: `Invalid status "${statusFilter}"` },
          { status: 400 }
        );
      }
      if (priorityFilter && !validPriorities.has(priorityFilter)) {
        return NextResponse.json(
          { error: `Invalid priority "${priorityFilter}"` },
          { status: 400 }
        );
      }

      const where = {};
      if (user.activeClientId) where.clientId = user.activeClientId;
      if (statusFilter) where.status = statusFilter;
      if (priorityFilter) where.priority = priorityFilter;
      if (userIdFilter) where.assigneeId = userIdFilter;
      if (search) {
        where.title = { contains: search };
      }
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo);
      }

      // Map sort fields to Prisma orderBy
      const sortFieldMap = {
        created_at: { createdAt: sortDir },
        due_date: { dueDate: sortDir },
        title: { title: sortDir },
        priority: { priority: sortDir },
        status: { status: sortDir },
      };
      const orderBy = VALID_SORT_FIELDS.has(sortBy)
        ? sortFieldMap[sortBy]
        : { createdAt: "desc" };

      const [tasks, total] = await Promise.all([
        prisma.wehowareTask.findMany({
          where,
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            createdAt: true,
            updatedAt: true,
            estimatedHours: true,
            actualHours: true,
            subtaskCount: true,
            subtaskCompleted: true,
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.wehowareTask.count({ where }),
      ]);

      const serialized = tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status
          ? (STATUS_DISPLAY[task.status] ?? task.status)
          : null,
        status_raw: task.status,
        priority: task.priority ?? null,
        due_date: task.dueDate
          ? new Date(task.dueDate).toISOString().split("T")[0]
          : null,
        created_at: task.createdAt
          ? new Date(task.createdAt).toISOString().split("T")[0]
          : null,
        updated_at: task.updatedAt
          ? new Date(task.updatedAt).toISOString().split("T")[0]
          : null,
        estimated_hours: task.estimatedHours !== null
          ? Number(task.estimatedHours)
          : null,
        actual_hours: Number(task.actualHours ?? 0),
        subtask_count: task.subtaskCount,
        subtask_completed: task.subtaskCompleted,
        assignee: task.assignee
          ? {
              id: task.assignee.id,
              first_name: task.assignee.firstName,
              last_name: task.assignee.lastName,
              label:
                `${task.assignee.firstName || ""} ${task.assignee.lastName || ""}`.trim(),
            }
          : null,
      }));

      return NextResponse.json({
        tasks: serialized,
        total,
        page,
        page_size: pageSize,
        total_pages: Math.ceil(total / pageSize),
      });
    } catch (err) {
      console.error("[GET /api/v1/reports/task-list] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch task list" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "client"] }
);
