/**
 * /api/v1/tasks/stats
 *
 * Prisma/MySQL-backed task count summary. Employees see only the counts for
 * tasks assigned to them; admins see counts for their active client context
 * (or all tasks when no active client is set).
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import { buildTaskWhere } from "../../../utils/task-access";

// Prisma JS enum identifiers (the underscore form, NOT the DB-mapped
// "To Do" / "In Progress" values) must be used when filtering via Prisma.
const STATUSES = {
  todo: "To_Do",
  inProgress: "In_Progress",
  done: "Done",
};

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const where = await buildTaskWhere(prisma, user);

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
