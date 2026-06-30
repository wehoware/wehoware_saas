import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/daily-reports/assignable-tasks
 *
 * Returns tasks assigned to the current user across all clients they
 * have access to (for admin/employee), or scoped to the active client
 * (for client-side roles).
 *
 * Used to populate the Work Items task dropdown in daily reports.
 */
async function getHandler(request) {
  const user = request.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let tasks;

    if (user.role === "admin" || user.role === "employee") {
      // Fetch all active client associations for this user
      const userClients = await prisma.wehowareUserClient.findMany({
        where: { userId: user.id, active: true },
        select: { clientId: true },
      });
      const clientIds = userClients.map((uc) => uc.clientId);

      if (clientIds.length === 0) {
        return NextResponse.json({ tasks: [] }, { status: 200 });
      }

      // All tasks assigned to this user across all their clients (excluding Done)
      tasks = await prisma.wehowareTask.findMany({
        where: {
          clientId: { in: clientIds },
          assigneeId: user.id,
          status: { not: "Done" },
        },
        select: {
          id: true,
          title: true,
          clientId: true,
          client: { select: { companyName: true } },
        },
        orderBy: { title: "asc" },
      });
    } else if (user.role === "client") {
      const clientId = user.activeClientId ?? user.clientId;
      if (!clientId) {
        return NextResponse.json({ tasks: [] }, { status: 200 });
      }

      const role = user.activeClientRole;
      let where = { clientId, status: { not: "Done" } };

      if (role === "client") {
        // Owner sees all client tasks
        const clientUsers = await prisma.wehowareUserClient.findMany({
          where: { clientId, active: true },
          select: { userId: true },
        });
        const clientUserIds = clientUsers.map((u) => u.userId);
        where.OR = [
          { assigneeId: null },
          { assigneeId: { in: clientUserIds } },
        ];
      } else if (role === "manager" || role === "editor") {
        where.OR = [{ assigneeId: user.id }, { createdBy: user.id }];
      } else if (role === "viewer") {
        where.assigneeId = user.id;
      }

      tasks = await prisma.wehowareTask.findMany({
        where,
        select: {
          id: true,
          title: true,
          clientId: true,
          client: { select: { companyName: true } },
        },
        orderBy: { title: "asc" },
      });
    } else {
      return NextResponse.json({ tasks: [] }, { status: 200 });
    }

    return NextResponse.json({ tasks: tasks ?? [] }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/v1/daily-reports/assignable-tasks] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch assignable tasks" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
