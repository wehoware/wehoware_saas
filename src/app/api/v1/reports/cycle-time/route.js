/**
 * GET /api/v1/reports/cycle-time
 *
 * Average time from task creation to completion for admin users.
 * Query params: date_from, date_to (ISO strings, filter on updatedAt)
 *
 * Fetches all Done tasks in the date range, computes cycle_days per task
 * as (updatedAt - createdAt) in days, then returns averages, median, and
 * a breakdown by priority.
 *
 * Tasks where updatedAt is null are skipped.
 * Always scoped to user.activeClientId when set.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

/**
 * Compute the median of a sorted numeric array.
 * Assumes the array is already sorted ascending.
 */
function median(sortedArr) {
  if (sortedArr.length === 0) return 0;
  const mid = Math.floor(sortedArr.length / 2);
  if (sortedArr.length % 2 === 1) {
    return sortedArr[mid];
  }
  return (sortedArr[mid - 1] + sortedArr[mid]) / 2;
}

/**
 * Round to 2 decimal places.
 */
function round2(n) {
  return Math.round(n * 100) / 100;
}

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const { searchParams } = new URL(request.url);

      const dateFrom = searchParams.get("date_from");
      const dateTo = searchParams.get("date_to");

      const where = { status: "Done" };
      if (user.activeClientId) where.clientId = user.activeClientId;
      if (dateFrom || dateTo) {
        where.updatedAt = {};
        if (dateFrom) where.updatedAt.gte = new Date(dateFrom);
        if (dateTo) where.updatedAt.lte = new Date(dateTo);
      }

      const tasks = await prisma.wehowareTask.findMany({
        where,
        select: {
          createdAt: true,
          updatedAt: true,
          priority: true,
        },
      });

      // Build the list of cycle days, skipping tasks with no updatedAt
      const allCycleDays = [];
      // Per-priority buckets: { days: number[] }
      const byPriorityBuckets = {
        High: [],
        Medium: [],
        Low: [],
      };

      for (const task of tasks) {
        if (!task.updatedAt) continue;

        const cycleDays =
          (new Date(task.updatedAt).getTime() - new Date(task.createdAt).getTime()) /
          (1000 * 60 * 60 * 24);

        allCycleDays.push(cycleDays);

        const priority = task.priority;
        if (priority && byPriorityBuckets[priority] !== undefined) {
          byPriorityBuckets[priority].push(cycleDays);
        }
      }

      const sampleSize = allCycleDays.length;

      let avgCycleDays = 0;
      let medianCycleDays = 0;
      if (sampleSize > 0) {
        avgCycleDays = round2(
          allCycleDays.reduce((sum, d) => sum + d, 0) / sampleSize
        );
        const sorted = [...allCycleDays].sort((a, b) => a - b);
        medianCycleDays = round2(median(sorted));
      }

      // Build per-priority stats
      const byPriority = {};
      for (const [priority, days] of Object.entries(byPriorityBuckets)) {
        const count = days.length;
        const avg =
          count > 0
            ? round2(days.reduce((sum, d) => sum + d, 0) / count)
            : 0;
        byPriority[priority] = { avg_days: avg, count };
      }

      return NextResponse.json({
        avg_cycle_days: avgCycleDays,
        median_cycle_days: medianCycleDays,
        by_priority: byPriority,
        sample_size: sampleSize,
      });
    } catch (err) {
      console.error("[GET /api/v1/reports/cycle-time] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch cycle time report" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
