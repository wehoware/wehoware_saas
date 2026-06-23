/**
 * GET /api/v1/reports/completion-history
 *
 * Tasks completed over time, grouped by granularity.
 * Query params:
 *   date_from    - ISO string (start of range)
 *   date_to      - ISO string (end of range)
 *   granularity  - "daily" | "weekly" | "monthly" (default: "weekly")
 *
 * Always scoped to user.activeClientId when set.
 * Groups by completion date (updatedAt) using JS date math — no raw SQL.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

const VALID_GRANULARITIES = new Set(["daily", "weekly", "monthly", "yearly"]);

/**
 * Returns the ISO date string representing the period bucket for a given date.
 *   daily   → "YYYY-MM-DD"
 *   weekly  → "YYYY-MM-DD" of the Monday of that week
 *   monthly → "YYYY-MM"
 */
function getPeriodKey(date, granularity) {
  const d = new Date(date);

  if (granularity === "daily") {
    return d.toISOString().split("T")[0];
  }

  if (granularity === "weekly") {
    // ISO week starts on Monday (day 1). getDay() returns 0=Sun…6=Sat.
    const dayOfWeek = d.getUTCDay(); // 0 = Sunday
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - daysToMonday);
    return monday.toISOString().split("T")[0];
  }

  if (granularity === "yearly") {
    return String(d.getUTCFullYear());
  }

  // monthly
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const { searchParams } = new URL(request.url);

      const dateFrom = searchParams.get("date_from");
      const dateTo = searchParams.get("date_to");
      const granularityParam = searchParams.get("granularity") ?? "weekly";
      const granularity = VALID_GRANULARITIES.has(granularityParam)
        ? granularityParam
        : "weekly";

      // Filter: status = Done, updatedAt in range, scoped to client
      const where = { status: "Done" };
      if (user.activeClientId) where.clientId = user.activeClientId;
      if (dateFrom || dateTo) {
        where.updatedAt = {};
        if (dateFrom) where.updatedAt.gte = new Date(dateFrom);
        if (dateTo) where.updatedAt.lte = new Date(dateTo);
      }

      // Optional employee filter
      const userIdFilter = searchParams.get("user_id");
      if (userIdFilter) where.assigneeId = userIdFilter;

      const tasks = await prisma.wehowareTask.findMany({
        where,
        select: { updatedAt: true },
        orderBy: { updatedAt: "asc" },
      });

      // Group tasks by their period key
      const buckets = new Map();
      for (const task of tasks) {
        if (!task.updatedAt) continue;
        const key = getPeriodKey(task.updatedAt, granularity);
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }

      // Sort period keys chronologically and build response array
      const history = Array.from(buckets.entries())
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([period, completed_count]) => ({ period, completed_count }));

      return NextResponse.json({ history });
    } catch (err) {
      console.error("[GET /api/v1/reports/completion-history] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch completion history report" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "client"] }
);
