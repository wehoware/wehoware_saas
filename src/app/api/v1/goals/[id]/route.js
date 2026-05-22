/**
 * /api/v1/goals/[id]
 *
 * GET    — Fetch a single goal with key results, task links, and owner profile.
 * PUT    — Update goal fields; auto-recalculate progress from linked tasks.
 * DELETE — Delete goal (cascade handles key results + task links). Returns 204.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

// ---------------------------------------------------------------------------
// Status mapping helpers
// ---------------------------------------------------------------------------
const GOAL_STATUS_FROM_PRISMA = {
  Not_Started: "Not Started",
  In_Progress: "In Progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

const GOAL_STATUS_TO_PRISMA = {
  "Not Started": "Not_Started",
  "In Progress": "In_Progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

const KR_STATUS_FROM_PRISMA = {
  Not_Started: "Not Started",
  In_Progress: "In Progress",
  Completed: "Completed",
  Failed: "Failed",
};

function toPrismaGoalStatus(s) {
  if (s == null) return undefined;
  return GOAL_STATUS_TO_PRISMA[s] ?? s;
}

// ---------------------------------------------------------------------------
// Response shaping
// ---------------------------------------------------------------------------
function shapeKr(kr) {
  return {
    id: kr.id,
    goal_id: kr.goalId,
    title: kr.title,
    target_value: kr.targetValue !== null ? Number(kr.targetValue) : null,
    current_value: Number(kr.currentValue),
    unit: kr.unit,
    weight: kr.weight,
    status: KR_STATUS_FROM_PRISMA[kr.status] ?? kr.status,
    created_at: kr.createdAt,
    progress_percentage:
      kr.targetValue && Number(kr.targetValue) > 0
        ? Math.min(
            100,
            Math.round(
              (Number(kr.currentValue) / Number(kr.targetValue)) * 100
            )
          )
        : 0,
  };
}

function shapeGoal(g) {
  return {
    id: g.id,
    client_id: g.clientId,
    title: g.title,
    description: g.description,
    type: g.type,
    status: GOAL_STATUS_FROM_PRISMA[g.status] ?? g.status,
    start_date: g.startDate,
    end_date: g.endDate,
    progress_percentage: g.progressPercentage,
    owner_id: g.ownerId,
    created_by: g.createdBy,
    created_at: g.createdAt,
    updated_at: g.updatedAt,
    owner: g.owner
      ? {
          id: g.owner.id,
          first_name: g.owner.firstName,
          last_name: g.owner.lastName,
          avatar_url: g.owner.avatarUrl,
        }
      : null,
    key_results: g.keyResults?.map(shapeKr) ?? [],
    task_links:
      g.taskLinks?.map((tl) => ({
        id: tl.id,
        task_id: tl.taskId,
        contribution_pct: tl.contributionPct,
        created_at: tl.createdAt,
        task: tl.task
          ? { id: tl.task.id, title: tl.task.title, status: tl.task.status }
          : null,
      })) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Shared include block
// ---------------------------------------------------------------------------
const GOAL_INCLUDE = {
  owner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
  keyResults: true,
  taskLinks: {
    include: {
      task: { select: { id: true, title: true, status: true } },
    },
  },
};

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
// Client scope helper — builds where clause based on user role
// ---------------------------------------------------------------------------
function buildClientScope(user) {
  if (user.activeClientId) return { clientId: user.activeClientId };
  if (user.role === "client" && user.clientId)
    return { clientId: user.clientId };
  return {};
}

// ---------------------------------------------------------------------------
// GET /api/v1/goals/[id]
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const goal = await prisma.wehowareGoal.findFirst({
        where: { id, ...buildClientScope(user) },
        include: GOAL_INCLUDE,
      });

      if (!goal) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }

      return NextResponse.json(shapeGoal(goal));
    } catch (err) {
      console.error("[GET /api/v1/goals/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch goal" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);

// ---------------------------------------------------------------------------
// PUT /api/v1/goals/[id]
// ---------------------------------------------------------------------------
export const PUT = withAuth(
  async (request, { params }) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
      const { prisma, user } = request;
      const { id } = await params;

      // Verify the goal exists and belongs to the active client
      const existing = await prisma.wehowareGoal.findFirst({
        where: { id, ...buildClientScope(user) },
      });
      if (!existing) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }

      const {
        title,
        description,
        status,
        type,
        start_date,
        end_date,
        owner_id,
      } = body ?? {};

      const data = {};

      if (title !== undefined) {
        if (!title || typeof title !== "string" || !title.trim()) {
          return NextResponse.json(
            { error: "title cannot be empty" },
            { status: 400 }
          );
        }
        data.title = title.trim();
      }
      if (description !== undefined) data.description = description ?? null;
      if (type !== undefined) data.type = type;
      if (status !== undefined) {
        data.status = toPrismaGoalStatus(status) ?? status;
      }
      if (owner_id !== undefined) data.ownerId = owner_id ?? null;

      // Date handling with validation
      const resolvedStartDate =
        start_date !== undefined ? new Date(start_date) : existing.startDate;
      const resolvedEndDate =
        end_date !== undefined ? new Date(end_date) : existing.endDate;

      if (start_date !== undefined) {
        if (isNaN(resolvedStartDate.getTime())) {
          return NextResponse.json(
            { error: "start_date is not a valid date" },
            { status: 400 }
          );
        }
        data.startDate = resolvedStartDate;
      }
      if (end_date !== undefined) {
        if (isNaN(resolvedEndDate.getTime())) {
          return NextResponse.json(
            { error: "end_date is not a valid date" },
            { status: 400 }
          );
        }
        data.endDate = resolvedEndDate;
      }

      if (resolvedEndDate < resolvedStartDate) {
        return NextResponse.json(
          { error: "end_date must be on or after start_date" },
          { status: 400 }
        );
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      // Persist the updated fields first
      await prisma.wehowareGoal.update({ where: { id }, data });

      // Recalculate progress based on linked tasks
      await recalculateGoalProgress(prisma, id);

      // Re-fetch with all relations for the response
      const updated = await prisma.wehowareGoal.findUnique({
        where: { id },
        include: GOAL_INCLUDE,
      });

      return NextResponse.json(shapeGoal(updated));
    } catch (err) {
      console.error("[PUT /api/v1/goals/[id]] error:", err);
      if (err?.name === "PrismaClientValidationError") {
        return NextResponse.json(
          { error: "Invalid goal fields (check type/status values)" },
          { status: 400 }
        );
      }
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid owner_id reference" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update goal" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);

// ---------------------------------------------------------------------------
// DELETE /api/v1/goals/[id]
// ---------------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { id } = await params;

      const existing = await prisma.wehowareGoal.findFirst({
        where: { id, ...buildClientScope(user) },
      });
      if (!existing) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }

      // CASCADE on the DB handles WehowareGoalKeyResult and WehowareGoalTaskLink
      await prisma.wehowareGoal.delete({ where: { id } });

      return new NextResponse(null, { status: 204 });
    } catch (err) {
      console.error("[DELETE /api/v1/goals/[id]] error:", err);
      return NextResponse.json(
        { error: "Failed to delete goal" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
