/**
 * /api/v1/goals/[id]/link-task/[task_id]
 *
 * DELETE — Unlink a task from this goal.
 *          After removing the link, recalculates the goal's progress_percentage.
 *          Returns 204 No Content on success.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";

// ---------------------------------------------------------------------------
// Progress recalculation from linked tasks
// ---------------------------------------------------------------------------
async function recalculateGoalProgress(prisma, goalId) {
  const links = await prisma.wehowareGoalTaskLink.findMany({
    where: { goalId },
    include: { task: { select: { status: true } } },
  });

  if (links.length === 0) {
    await prisma.wehowareGoal.update({
      where: { id: goalId },
      data: { progressPercentage: 0 },
    });
    return 0;
  }

  const totalPct = links.reduce((sum, l) => sum + l.contributionPct, 0);
  const completedPct = links
    .filter((l) => l.task?.status === "Done")
    .reduce((sum, l) => sum + l.contributionPct, 0);

  const progress =
    totalPct > 0
      ? Math.min(100, Math.round((completedPct / totalPct) * 100))
      : 0;

  await prisma.wehowareGoal.update({
    where: { id: goalId },
    data: { progressPercentage: progress },
  });

  return progress;
}

// ---------------------------------------------------------------------------
// Client scope helper
// ---------------------------------------------------------------------------
function buildClientScope(user) {
  if (user.activeClientId) return { clientId: user.activeClientId };
  if (user.role === "client" && user.clientId)
    return { clientId: user.clientId };
  return {};
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/goals/[id]/link-task/[task_id]
// ---------------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id: goalId, task_id: taskId } = await params;

      // Verify goal exists and belongs to the active client
      const goal = await prisma.wehowareGoal.findFirst({
        where: { id: goalId, ...buildClientScope(user) },
        select: { id: true },
      });
      if (!goal) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }

      // Verify the link exists
      const link = await prisma.wehowareGoalTaskLink.findUnique({
        where: { goalId_taskId: { goalId: goal.id, taskId } },
      });
      if (!link) {
        return NextResponse.json(
          { error: "Task link not found" },
          { status: 404 }
        );
      }

      // Delete the link
      await prisma.wehowareGoalTaskLink.delete({
        where: { goalId_taskId: { goalId: goal.id, taskId } },
      });

      // Recalculate goal progress after removing this link
      await recalculateGoalProgress(prisma, goal.id);

      return new NextResponse(null, { status: 204 });
    } catch (err) {
      console.error(
        "[DELETE /api/v1/goals/[id]/link-task/[task_id]] error:",
        err
      );
      return NextResponse.json(
        { error: "Failed to unlink task from goal" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
