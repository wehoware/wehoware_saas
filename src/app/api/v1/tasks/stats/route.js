/**
 * /api/v1/tasks/stats
 *
 * Prisma/MySQL-backed task count summary. Employees see only the counts for
 * tasks assigned to them; admins see counts for their active client context
 * (or all tasks when no active client is set).
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

// Prisma JS enum identifiers (the underscore form, NOT the DB-mapped
// "To Do" / "In Progress" values) must be used when filtering via Prisma.
const STATUSES = {
  todo: "To_Do",
  inProgress: "In_Progress",
  done: "Done",
};

function baseWhere(user) {
  const where = {};
  if (user.role === "employee") {
    where.assigneeId = user.id;
  } else if (user.role === "client") {
    const clientId = user.activeClientId ?? user.clientId ?? "__none__";
    where.clientId = clientId;
    if (user.activeClientRole === "editor") {
      where.assigneeId = user.id;
    }
  } else if (user.role === "admin" && user.activeClientId) {
    where.clientId = user.activeClientId;
  }
  return where;
}

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const where = baseWhere(user);

      const [total, todo, inProgress, done] = await Promise.all([
        prisma.wehowareTask.count({ where }),
        prisma.wehowareTask.count({ where: { ...where, status: STATUSES.todo } }),
        prisma.wehowareTask.count({
          where: { ...where, status: STATUSES.inProgress },
        }),
        prisma.wehowareTask.count({ where: { ...where, status: STATUSES.done } }),
      ]);

      return NextResponse.json({ total, todo, inProgress, done });
    } catch (err) {
      console.error("[GET /api/v1/tasks/stats] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch task statistics" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
