/**
 * /api/v1/goals/[id]/link-task
 *
 * POST — Link a task to this goal.
 *        Validates the task belongs to the same client as the goal.
 *        After linking, recalculates the goal's progress_percentage.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

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
// POST /api/v1/goals/[id]/link-task
// ---------------------------------------------------------------------------
export const POST = withAuth(
  async (request, { params }) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
      const { prisma, user } = request;
      const { id: goalId } = await params;
      const { task_id, contribution_pct } = body ?? {};

      if (!task_id || typeof task_id !== "string") {
        return NextResponse.json(
          { error: "task_id is required" },
          { status: 400 }
        );
      }

      // Validate and clamp contribution_pct
      let contributionPct = 100;
      if (contribution_pct != null) {
        contributionPct = parseInt(contribution_pct, 10);
        if (isNaN(contributionPct) || contributionPct < 1 || contributionPct > 100) {
          return NextResponse.json(
            { error: "contribution_pct must be an integer between 1 and 100" },
            { status: 400 }
          );
        }
      }

      // Verify goal exists and belongs to this client
      const goal = await prisma.wehowareGoal.findFirst({
        where: { id: goalId, ...buildClientScope(user) },
        select: { id: true, clientId: true },
      });
      if (!goal) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }

      // Verify task exists and belongs to the same client
      const task = await prisma.wehowareTask.findFirst({
        where: { id: task_id, clientId: goal.clientId },
        select: { id: true, title: true, status: true },
      });
      if (!task) {
        return NextResponse.json(
          {
            error:
              "Task not found or does not belong to the same client as this goal",
          },
          { status: 400 }
        );
      }

      // Check for existing link — return 409 if already linked
      const existing = await prisma.wehowareGoalTaskLink.findUnique({
        where: { goalId_taskId: { goalId: goal.id, taskId: task_id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Task already linked to this goal" },
          { status: 409 }
        );
      }

      // Create the link
      const link = await prisma.wehowareGoalTaskLink.create({
        data: {
          goalId: goal.id,
          taskId: task_id,
          contributionPct,
        },
      });

      // Recalculate goal progress after adding this link (fire-and-forget is
      // not appropriate here — we want the updated percentage reflected immediately)
      await recalculateGoalProgress(prisma, goal.id);

      return NextResponse.json(
        {
          id: link.id,
          goal_id: link.goalId,
          task_id: link.taskId,
          contribution_pct: link.contributionPct,
          created_at: link.createdAt,
          task: { id: task.id, title: task.title, status: task.status },
        },
        { status: 201 }
      );
    } catch (err) {
      console.error("[POST /api/v1/goals/[id]/link-task] error:", err);
      // Prisma unique constraint violation (race condition)
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "Task already linked to this goal" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to link task to goal" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
