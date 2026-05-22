/**
 * /api/v1/goals
 *
 * GET  — Paginated list of goals for the active client.
 * POST — Create a goal (with optional key results) in a transaction.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

// ---------------------------------------------------------------------------
// Status / type mapping helpers
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
    key_result_count: g._count?.keyResults ?? (g.keyResults?.length ?? 0),
    task_link_count: g._count?.taskLinks ?? (g.taskLinks?.length ?? 0),
  };
}

// ---------------------------------------------------------------------------
// GET /api/v1/goals
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const { searchParams } = new URL(request.url);

      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
      const limit = Math.min(
        50,
        Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
      );
      const statusParam = searchParams.get("status");
      const typeParam = searchParams.get("type");

      const where = {};

      // Scope to active client
      if (user.activeClientId) {
        where.clientId = user.activeClientId;
      } else if (user.role === "client" && user.clientId) {
        where.clientId = user.clientId;
      }

      if (statusParam) {
        where.status = toPrismaGoalStatus(statusParam) ?? statusParam;
      }
      if (typeParam) {
        where.type = typeParam;
      }

      const [goals, total] = await Promise.all([
        prisma.wehowareGoal.findMany({
          where,
          include: {
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
            _count: {
              select: { keyResults: true, taskLinks: true },
            },
          },
          orderBy: { endDate: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareGoal.count({ where }),
      ]);

      return NextResponse.json({
        goals: goals.map(shapeGoal),
        total,
        page,
        limit,
      });
    } catch (err) {
      console.error("[GET /api/v1/goals] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch goals" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);

// ---------------------------------------------------------------------------
// POST /api/v1/goals
// ---------------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
      const { prisma, user } = request;
      const {
        title,
        description,
        type,
        status,
        start_date,
        end_date,
        owner_id,
        key_results,
      } = body ?? {};

      // Validation
      if (!title || typeof title !== "string" || !title.trim()) {
        return NextResponse.json(
          { error: "title is required" },
          { status: 400 }
        );
      }
      if (!start_date) {
        return NextResponse.json(
          { error: "start_date is required" },
          { status: 400 }
        );
      }
      if (!end_date) {
        return NextResponse.json(
          { error: "end_date is required" },
          { status: 400 }
        );
      }

      const startDateObj = new Date(start_date);
      const endDateObj = new Date(end_date);

      if (isNaN(startDateObj.getTime())) {
        return NextResponse.json(
          { error: "start_date is not a valid date" },
          { status: 400 }
        );
      }
      if (isNaN(endDateObj.getTime())) {
        return NextResponse.json(
          { error: "end_date is not a valid date" },
          { status: 400 }
        );
      }
      if (endDateObj < startDateObj) {
        return NextResponse.json(
          { error: "end_date must be on or after start_date" },
          { status: 400 }
        );
      }

      // Determine client scope
      const clientId =
        user.activeClientId ?? user.clientId ?? null;
      if (!clientId) {
        return NextResponse.json(
          { error: "No active client context found" },
          { status: 400 }
        );
      }

      // Build goal data
      const goalData = {
        clientId,
        title: title.trim(),
        description: description ?? null,
        type: type ?? "Goal",
        status: status ? toPrismaGoalStatus(status) : "Not_Started",
        startDate: startDateObj,
        endDate: endDateObj,
        ownerId: owner_id ?? null,
        createdBy: user.id,
      };

      // Build key results create data
      const krData = Array.isArray(key_results)
        ? key_results
            .filter((kr) => kr && typeof kr.title === "string" && kr.title.trim())
            .map((kr) => ({
              title: kr.title.trim(),
              targetValue:
                kr.target_value != null ? Number(kr.target_value) : null,
              unit: kr.unit ?? null,
              weight: kr.weight != null ? parseInt(kr.weight, 10) : 25,
            }))
        : [];

      // Use transaction for atomic goal + key results creation
      const [goal] = await prisma.$transaction([
        prisma.wehowareGoal.create({
          data: {
            ...goalData,
            ...(krData.length > 0
              ? {
                  keyResults: {
                    create: krData,
                  },
                }
              : {}),
          },
          include: {
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
          },
        }),
      ]);

      return NextResponse.json(shapeGoal(goal), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/goals] error:", err);
      if (err?.name === "PrismaClientValidationError") {
        return NextResponse.json(
          { error: "Invalid goal fields (check type/status values)" },
          { status: 400 }
        );
      }
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid owner_id or client reference" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create goal" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);
