import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";

export const GET = withAuth(
  async (request, { params }) => {
    const { supabase } = request;
    // await params before pulling out id
    const { id: taskId } = await params;

    // Fetch activities
    const { data: activities, error: activitiesError } = await supabase
      .from("wehoware_task_activities")
      .select(
        `
        *,
        user:wehoware_profiles(id, first_name, last_name, avatar_url)
      `
      )
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (activitiesError) {
      console.error("Error fetching activities:", activitiesError);
      return NextResponse.json(
        { error: "Failed to fetch activities" },
        { status: 500 }
      );
    }

    // Fetch comments
    const { data: comments, error: commentsError } = await supabase
      .from("wehoware_task_comments")
      .select(
        `
        *,
        user:wehoware_profiles(id, first_name, last_name, avatar_url)
      `
      )
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (commentsError) {
      console.error("Error fetching comments:", commentsError);
      return NextResponse.json(
        { error: "Failed to fetch comments" },
        { status: 500 }
      );
    }

    // Combine, tag and sort
    const combinedFeed = [
      ...activities.map((a) => ({ ...a, feed_type: "activity" })),
      ...comments.map((c) => ({ ...c, feed_type: "comment" })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return NextResponse.json(combinedFeed);
  },
  { allowedRoles: ["admin", "employee"] }
);
