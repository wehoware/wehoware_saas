/**
 * /api/v1/achievements
 *
 * GET  — Paginated list of achievements, filtered by activeClientId.
 *         Optional query params: user_id, client_id, page, limit.
 * POST — Award an achievement (admin only).
 *         Body: { user_id, title, description?, badge_type?, achieved_at? }
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

// ---------------------------------------------------------------------------
// Response shaping
// ---------------------------------------------------------------------------
function shapeAchievement(a) {
  return {
    id: a.id,
    client_id: a.clientId,
    user_id: a.userId,
    title: a.title,
    description: a.description,
    badge_type: a.badgeType,
    achieved_at: a.achievedAt,
    created_at: a.createdAt,
    user: a.user
      ? {
          id: a.user.id,
          first_name: a.user.firstName,
          last_name: a.user.lastName,
          email: a.user.email,
          avatar_url: a.user.avatarUrl,
        }
      : null,
  };
}

const USER_INCLUDE = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatarUrl: true,
  },
};

// ---------------------------------------------------------------------------
// GET /api/v1/achievements
// ---------------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const { searchParams } = new URL(request.url);

      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
      const limit = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
      );
      const userIdFilter = searchParams.get("user_id");
      const clientIdFilter = searchParams.get("client_id");

      const where = {};

      // Scope by active client context
      const scopedClientId =
        user.activeClientId ??
        (user.role === "client" ? user.clientId : null);

      if (scopedClientId) {
        where.clientId = scopedClientId;
      }

      // Allow further filtering by specific user_id or client_id in query params
      if (userIdFilter) {
        where.userId = userIdFilter;
      }
      // Allow a more specific client_id filter (must still be within the
      // scoped client for non-admin users who have a scoped context)
      if (clientIdFilter) {
        if (scopedClientId && clientIdFilter !== scopedClientId) {
          // The requested client is outside the user's allowed scope
          return NextResponse.json(
            { error: "Access to the requested client_id is not permitted" },
            { status: 403 }
          );
        }
        where.clientId = clientIdFilter;
      }

      const [achievements, total] = await Promise.all([
        prisma.wehowareAchievement.findMany({
          where,
          include: { user: USER_INCLUDE },
          orderBy: { achievedAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.wehowareAchievement.count({ where }),
      ]);

      return NextResponse.json({
        achievements: achievements.map(shapeAchievement),
        total,
        page,
        limit,
      });
    } catch (err) {
      console.error("[GET /api/v1/achievements] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch achievements" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);

// ---------------------------------------------------------------------------
// POST /api/v1/achievements
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
        user_id,
        title,
        description,
        badge_type,
        achieved_at,
      } = body ?? {};

      // Validation
      if (!user_id || typeof user_id !== "string") {
        return NextResponse.json(
          { error: "user_id is required" },
          { status: 400 }
        );
      }
      if (!title || typeof title !== "string" || !title.trim()) {
        return NextResponse.json(
          { error: "title is required" },
          { status: 400 }
        );
      }

      // Validate achieved_at if provided
      let achievedAtDate = new Date();
      if (achieved_at != null) {
        achievedAtDate = new Date(achieved_at);
        if (isNaN(achievedAtDate.getTime())) {
          return NextResponse.json(
            { error: "achieved_at is not a valid date" },
            { status: 400 }
          );
        }
      }

      // Verify the target user exists
      const targetUser = await prisma.wehowareProfile.findUnique({
        where: { id: user_id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      });
      if (!targetUser) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 400 }
        );
      }

      // Determine client_id from admin's active context
      const clientId =
        user.activeClientId ?? user.clientId ?? null;

      const achievement = await prisma.wehowareAchievement.create({
        data: {
          clientId,
          userId: user_id,
          title: title.trim(),
          description: description ?? null,
          badgeType: badge_type ?? "custom",
          achievedAt: achievedAtDate,
        },
        include: { user: USER_INCLUDE },
      });

      return NextResponse.json(shapeAchievement(achievement), { status: 201 });
    } catch (err) {
      console.error("[POST /api/v1/achievements] error:", err);
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid user_id or client reference" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create achievement" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
