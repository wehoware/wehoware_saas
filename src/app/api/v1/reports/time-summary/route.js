/**
 * GET /api/v1/reports/time-summary
 *
 * Time entry analysis per employee within a date range.
 * Query params:
 *   date_from    - ISO string (filters on trackedDate)
 *   date_to      - ISO string (filters on trackedDate)
 *   user_id      - filter by specific employee
 *
 * Returns per-employee time entry stats:
 *   total_hours, entry_count, avg_hours_per_entry, by_task breakdown
 *
 * Always scoped to user.activeClientId when set.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const { searchParams } = new URL(request.url);

      const dateFrom = searchParams.get("date_from");
      const dateTo = searchParams.get("date_to");
      const userIdFilter = searchParams.get("user_id");

      // Build where clause for time entries via task relation
      const taskWhere = {};
      if (user.activeClientId) taskWhere.clientId = user.activeClientId;

      const entryWhere = { task: taskWhere };
      if (dateFrom || dateTo) {
        entryWhere.trackedDate = {};
        if (dateFrom) entryWhere.trackedDate.gte = new Date(dateFrom);
        if (dateTo) entryWhere.trackedDate.lte = new Date(dateTo);
      }
      if (userIdFilter) entryWhere.userId = userIdFilter;

      const [entries, profiles] = await Promise.all([
        prisma.wehowareTaskTimeEntry.findMany({
          where: entryWhere,
          select: {
            id: true,
            userId: true,
            taskId: true,
            hoursSpent: true,
            trackedDate: true,
            notes: true,
            task: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
          orderBy: { trackedDate: "desc" },
        }),
        prisma.wehowareProfile.findMany({
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        }),
      ]);

      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      // Aggregate per user
      const userMap = new Map();

      for (const entry of entries) {
        const uid = entry.userId;
        if (!userMap.has(uid)) {
          const profile = profileMap.get(uid);
          userMap.set(uid, {
            user_id: uid,
            first_name: profile?.firstName ?? "",
            last_name: profile?.lastName ?? "",
            email: profile?.email ?? "",
            label:
              `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() ||
              profile?.email ||
              uid,
            total_hours: 0,
            entry_count: 0,
            task_count: new Set(),
            by_date: new Map(),
          });
        }

        const emp = userMap.get(uid);
        emp.total_hours += Number(entry.hoursSpent);
        emp.entry_count += 1;
        emp.task_count.add(entry.taskId);

        const dateKey = new Date(entry.trackedDate).toISOString().split("T")[0];
        emp.by_date.set(dateKey, (emp.by_date.get(dateKey) ?? 0) + Number(entry.hoursSpent));
      }

      const summary = Array.from(userMap.values()).map((emp) => {
        const byDateArray = Array.from(emp.by_date.entries())
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([date, hours]) => ({ date, hours: Math.round(hours * 100) / 100 }));

        return {
          user_id: emp.user_id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          email: emp.email,
          label: emp.label,
          total_hours: Math.round(emp.total_hours * 100) / 100,
          entry_count: emp.entry_count,
          task_count: emp.task_count.size,
          avg_hours_per_entry:
            emp.entry_count > 0
              ? Math.round((emp.total_hours / emp.entry_count) * 100) / 100
              : 0,
          by_date: byDateArray,
        };
      });

      summary.sort((a, b) => b.total_hours - a.total_hours);

      const grandTotal = summary.reduce((sum, e) => sum + e.total_hours, 0);
      const totalEntries = entries.length;

      return NextResponse.json({
        summary,
        grand_total_hours: Math.round(grandTotal * 100) / 100,
        total_entries: totalEntries,
        unique_users: summary.length,
      });
    } catch (err) {
      console.error("[GET /api/v1/reports/time-summary] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch time summary" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "client"] }
);
