/**
 * /api/v1/tasks/[id]/activities
 *
 * Prisma/MySQL-backed handler. Returns a merged, reverse-chronological feed
 * of audit activities and user-authored comments for the task.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
};

function shapeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    first_name: u.firstName,
    last_name: u.lastName,
    avatar_url: u.avatarUrl,
  };
}

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

export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: taskId } = await params;

      const allowed = await canAccessTask(prisma, user, taskId);
      if (!allowed) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      const [activities, comments] = await Promise.all([
        prisma.wehowareTaskActivity.findMany({
          where: { taskId },
          include: { user: { select: USER_SELECT } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.wehowareTaskComment.findMany({
          where: { taskId },
          include: { user: { select: USER_SELECT } },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const feed = [
        ...activities.map((a) => ({
          id: a.id,
          task_id: a.taskId,
          user_id: a.userId,
          activity_type: a.activityType,
          details: a.details,
          created_at: a.createdAt,
          user: shapeUser(a.user),
          feed_type: "activity",
        })),
        ...comments.map((c) => ({
          id: c.id,
          task_id: c.taskId,
          user_id: c.userId,
          content: c.content,
          created_at: c.createdAt,
          user: shapeUser(c.user),
          feed_type: "comment",
        })),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return NextResponse.json(feed);
    } catch (err) {
      console.error("[GET /api/v1/tasks/[id]/activities] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch activities" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);
