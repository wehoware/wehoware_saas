import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

export const GET = withAuth(
  async (request) => {
    const { supabase, user } = request;

    try {
      // Build a count-only query for a given status
      const buildCountQuery = (status) => {
        // 1) start with select(..., { head: true, count: 'exact' })
        let q = supabase
          .from("wehoware_tasks")
          .select("*", { count: "exact", head: true });

        // 2) now you can safely chain .eq() filters
        if (user.role === "employee") {
          q = q.eq("assignee_id", user.id);
        }
        if (status) {
          q = q.eq("status", status);
        }

        return q;
      };

      // fire off all four counts in parallel
      const countQueries = [
        buildCountQuery(null),
        buildCountQuery("To Do"),
        buildCountQuery("In Progress"),
        buildCountQuery("Done"),
      ];

      const [totalRes, todoRes, inProgressRes, doneRes] = await Promise.all(countQueries);

      // check for errors
      for (const res of [totalRes, todoRes, inProgressRes, doneRes]) {
        if (res.error) throw res.error;
      }

      // return the counts (defaulting to 0)
      return NextResponse.json({
        total: totalRes.count ?? 0,
        todo: todoRes.count ?? 0,
        inProgress: inProgressRes.count ?? 0,
        done: doneRes.count ?? 0,
      });
    } catch (error) {
      console.error("Error fetching task stats:", error);
      return NextResponse.json(
        { error: "Failed to fetch task statistics" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);
