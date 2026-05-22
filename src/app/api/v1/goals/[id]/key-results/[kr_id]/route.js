/**
 * /api/v1/goals/[id]/key-results/[kr_id]
 *
 * PUT — Update a key result's fields.
 *       Validates current_value does not exceed target_value when target_value is set.
 *       After update, recalculates the parent goal's progress_percentage from all KRs
 *       using a weighted average of each KR's individual progress.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";

// ---------------------------------------------------------------------------
// Status mapping helpers
// ---------------------------------------------------------------------------
const KR_STATUS_FROM_PRISMA = {
  Not_Started: "Not Started",
  In_Progress: "In Progress",
  Completed: "Completed",
  Failed: "Failed",
};

const KR_STATUS_TO_PRISMA = {
  "Not Started": "Not_Started",
  "In Progress": "In_Progress",
  Completed: "Completed",
  Failed: "Failed",
};

function toPrismaKrStatus(s) {
  if (s == null) return undefined;
  return KR_STATUS_TO_PRISMA[s] ?? s;
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

// ---------------------------------------------------------------------------
// Goal progress recalculation from all KRs (weighted average)
// ---------------------------------------------------------------------------
async function recalculateGoalProgressFromKRs(prisma, goalId) {
  const krs = await prisma.wehowareGoalKeyResult.findMany({
    where: { goalId },
  });

  if (krs.length === 0) return 0;

  const totalWeight = krs.reduce((sum, kr) => sum + kr.weight, 0);
  const weightedProgress = krs.reduce((sum, kr) => {
    const pct =
      kr.targetValue && Number(kr.targetValue) > 0
        ? Math.min(
            100,
            (Number(kr.currentValue) / Number(kr.targetValue)) * 100
          )
        : kr.status === "Completed"
          ? 100
          : 0;
    return sum + pct * kr.weight;
  }, 0);

  const progress =
    totalWeight > 0
      ? Math.min(100, Math.round(weightedProgress / totalWeight))
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
// PUT /api/v1/goals/[id]/key-results/[kr_id]
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
      const { id: goalId, kr_id: krId } = await params;

      // Verify goal exists and belongs to the active client
      const goal = await prisma.wehowareGoal.findFirst({
        where: { id: goalId, ...buildClientScope(user) },
        select: { id: true },
      });
      if (!goal) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }

      // Verify key result exists and belongs to this goal
      const existingKr = await prisma.wehowareGoalKeyResult.findFirst({
        where: { id: krId, goalId: goal.id },
      });
      if (!existingKr) {
        return NextResponse.json(
          { error: "Key result not found" },
          { status: 404 }
        );
      }

      const {
        title,
        current_value,
        status,
        target_value,
        unit,
        weight,
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

      if (unit !== undefined) data.unit = unit ?? null;
      if (weight !== undefined) {
        const w = parseInt(weight, 10);
        if (isNaN(w) || w < 1) {
          return NextResponse.json(
            { error: "weight must be a positive integer" },
            { status: 400 }
          );
        }
        data.weight = w;
      }
      if (status !== undefined) {
        data.status = toPrismaKrStatus(status) ?? status;
      }

      // Resolve the effective target_value and current_value for validation
      // (use updated values if supplied, fall back to existing persisted values)
      const effectiveTargetValue =
        target_value !== undefined
          ? target_value != null
            ? Number(target_value)
            : null
          : existingKr.targetValue != null
            ? Number(existingKr.targetValue)
            : null;

      const effectiveCurrentValue =
        current_value !== undefined
          ? Number(current_value)
          : Number(existingKr.currentValue);

      if (target_value !== undefined) {
        if (target_value != null && isNaN(Number(target_value))) {
          return NextResponse.json(
            { error: "target_value must be a number" },
            { status: 400 }
          );
        }
        data.targetValue = target_value != null ? Number(target_value) : null;
      }

      if (current_value !== undefined) {
        if (isNaN(Number(current_value))) {
          return NextResponse.json(
            { error: "current_value must be a number" },
            { status: 400 }
          );
        }
        if (
          effectiveTargetValue != null &&
          effectiveTargetValue > 0 &&
          Number(current_value) > effectiveTargetValue
        ) {
          return NextResponse.json(
            { error: "current_value cannot exceed target_value" },
            { status: 400 }
          );
        }
        data.currentValue = Number(current_value);
      } else if (
        // Also check the existing current_value against a newly updated target_value
        target_value !== undefined &&
        effectiveTargetValue != null &&
        effectiveTargetValue > 0 &&
        effectiveCurrentValue > effectiveTargetValue
      ) {
        return NextResponse.json(
          {
            error:
              "The new target_value is less than the existing current_value",
          },
          { status: 400 }
        );
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: "No valid fields provided for update" },
          { status: 400 }
        );
      }

      const updatedKr = await prisma.wehowareGoalKeyResult.update({
        where: { id: krId },
        data,
      });

      // Recalculate parent goal progress from all KRs
      await recalculateGoalProgressFromKRs(prisma, goal.id);

      return NextResponse.json(shapeKr(updatedKr));
    } catch (err) {
      console.error(
        "[PUT /api/v1/goals/[id]/key-results/[kr_id]] error:",
        err
      );
      if (err?.name === "PrismaClientValidationError") {
        return NextResponse.json(
          { error: "Invalid key result fields (check status values)" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update key result" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
