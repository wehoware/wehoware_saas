/**
 * GET /api/v1/reports/export
 *
 * Export tasks as a CSV file for admin users.
 * Query params:
 *   format      - "csv" (only supported value; defaults to csv)
 *   date_from   - ISO string (filters on createdAt)
 *   date_to     - ISO string (filters on createdAt)
 *   status      - TaskStatus enum value (To_Do | In_Progress | Done | Backlog)
 *   priority    - TaskPriority enum value (Low | Medium | High)
 *
 * Always scoped to user.activeClientId when set.
 * Max 1000 rows per export.
 * Returns CSV with Content-Disposition: attachment.
 */
import { withAuth } from "../../../utils/auth-middleware";

const MAX_ROWS = 1000;

// Map Prisma TaskStatus enum values to UI-friendly display strings
const STATUS_DISPLAY = {
  To_Do: "To Do",
  In_Progress: "In Progress",
  Done: "Done",
  Backlog: "Backlog",
};

/**
 * Escape a single CSV field value.
 * All fields are wrapped in double-quotes; internal double-quotes are
 * escaped by doubling them ("").
 */
function escapeCsvField(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  // Escape internal quotes by doubling
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Convert an array of field values to a single CSV row string.
 */
function toCsvRow(fields) {
  return fields.map(escapeCsvField).join(",");
}

/**
 * Format a Date (or null) to an ISO date string ("YYYY-MM-DD") or empty.
 */
function formatDate(date) {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const { searchParams } = new URL(request.url);

      // Only CSV is supported; reject other formats explicitly
      const format = searchParams.get("format") ?? "csv";
      if (format !== "csv") {
        return new Response(
          JSON.stringify({ error: `Unsupported format: "${format}". Use format=csv.` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const dateFrom = searchParams.get("date_from");
      const dateTo = searchParams.get("date_to");
      const statusParam = searchParams.get("status");
      const priorityParam = searchParams.get("priority");

      // Valid enum values for guard checks
      const validStatuses = new Set(["To_Do", "In_Progress", "Done", "Backlog"]);
      const validPriorities = new Set(["Low", "Medium", "High"]);

      const where = {};
      if (user.activeClientId) where.clientId = user.activeClientId;

      // Optional employee filter
      const userIdFilter = searchParams.get("user_id");
      if (userIdFilter) where.assigneeId = userIdFilter;

      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo);
      }

      if (statusParam) {
        if (!validStatuses.has(statusParam)) {
          return new Response(
            JSON.stringify({
              error: `Invalid status "${statusParam}". Valid values: To_Do, In_Progress, Done, Backlog.`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        where.status = statusParam;
      }

      if (priorityParam) {
        if (!validPriorities.has(priorityParam)) {
          return new Response(
            JSON.stringify({
              error: `Invalid priority "${priorityParam}". Valid values: Low, Medium, High.`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        where.priority = priorityParam;
      }

      const tasks = await prisma.wehowareTask.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          estimatedHours: true,
          actualHours: true,
          assignee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: MAX_ROWS,
      });

      // Build CSV content
      const csvHeader = toCsvRow([
        "ID",
        "Title",
        "Status",
        "Priority",
        "Assignee",
        "Due Date",
        "Created At",
        "Estimated Hours",
        "Actual Hours",
      ]);

      const csvRows = tasks.map((task) => {
        const statusLabel = task.status
          ? (STATUS_DISPLAY[task.status] ?? task.status)
          : "";

        const assigneeName = task.assignee
          ? [task.assignee.firstName, task.assignee.lastName]
              .filter(Boolean)
              .join(" ")
          : "";

        return toCsvRow([
          task.id,
          task.title,
          statusLabel,
          task.priority ?? "",
          assigneeName,
          formatDate(task.dueDate),
          formatDate(task.createdAt),
          task.estimatedHours !== null && task.estimatedHours !== undefined
            ? Number(task.estimatedHours)
            : "",
          task.actualHours !== null && task.actualHours !== undefined
            ? Number(task.actualHours)
            : "",
        ]);
      });

      const csvContent = [csvHeader, ...csvRows].join("\r\n");

      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="tasks-export.csv"',
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      console.error("[GET /api/v1/reports/export] error:", err);
      return new Response(
        JSON.stringify({ error: "Failed to export tasks" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
  { allowedRoles: ["admin", "client"] }
);
