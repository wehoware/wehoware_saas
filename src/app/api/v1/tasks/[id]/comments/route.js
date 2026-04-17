/**
 * /api/v1/tasks/[id]/comments
 *
 * Prisma/MySQL-backed handler. POSTing a comment also inserts a matching
 * `commented` row into wehoware_task_activities so the combined feed in
 * /activities picks it up.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

function serializeComment(c) {
  return {
    id: c.id,
    task_id: c.taskId,
    user_id: c.userId,
    content: c.content,
    created_at: c.createdAt,
    user: c.user
      ? {
          id: c.user.id,
          first_name: c.user.firstName,
          last_name: c.user.lastName,
          avatar_url: c.user.avatarUrl,
        }
      : null,
  };
}

/**
 * Enforce the same access rules as /api/v1/tasks/[id] before allowing a
 * comment to land. Prevents employees from commenting on tasks they can't
 * even see.
 */
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

// -------------------------------------------------------------------
// POST
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: taskId } = await params;

      const body = await request.json();
      const content = body?.content;
      if (!content || typeof content !== "string" || !content.trim()) {
        return NextResponse.json(
          { error: "Comment content is required" },
          { status: 400 }
        );
      }

      const allowed = await canAccessTask(prisma, user, taskId);
      if (!allowed) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      const comment = await prisma.wehowareTaskComment.create({
        data: {
          taskId,
          userId: user.id,
          content: content.trim(),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Mirror the old behavior: log a "commented" activity entry.
      try {
        await prisma.wehowareTaskActivity.create({
          data: {
            taskId,
            userId: user.id,
            activityType: "commented",
            details: { comment_id: comment.id },
          },
        });
      } catch (activityErr) {
        console.warn(
          "[POST /api/v1/tasks/[id]/comments] activity log failed:",
          activityErr
        );
      }

      return NextResponse.json(serializeComment(comment), { status: 201 });
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }
      console.error("[POST /api/v1/tasks/[id]/comments] error:", err);
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);
