/**
 * GET /api/v1/daily-reports/analytics/employees
 *
 * Returns the list of users that the current user can monitor,
 * based on role hierarchy and cross-group isolation rules.
 *
 * Visibility:
 *   admin          → all admin+employee users for active client
 *   client (owner) → all client-side users for their client
 *   client (manager) → editors + viewers for their client
 *   client (editor)  → own only (no subordinates)
 *   client (viewer)  → own only (no subordinates)
 *   employee         → own only (no subordinates)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../utils/auth-middleware";
import { canViewAnalytics } from "../../../../utils/daily-report-access";

async function getHandler(request) {
  const { prisma, user } = request;

  if (!canViewAnalytics(user)) {
    return NextResponse.json(
      { error: "You do not have permission to view analytics" },
      { status: 403 }
    );
  }

  try {
    const clientId = user.activeClientId ?? user.clientId;

    let employees;

    if (user.role === "admin") {
      // Admin sees all admin+employee users, plus any user who has submitted
      // a report for the active client (covers edge cases where a user's
      // role changed but old reports remain).
      const reportUserWhere = { creatorRole: { in: ["admin", "employee"] } };
      const clientReportUsers = await prisma.wehowareDailyWorkReport.findMany({
        where: reportUserWhere,
        select: { userId: true },
        distinct: ["userId"],
      });
      const reportUserIds = clientReportUsers.map((r) => r.userId);

      const users = await prisma.wehowareProfile.findMany({
        where: {
          OR: [
            { role: { in: ["admin", "employee"] } },
            { id: { in: reportUserIds } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
        orderBy: { firstName: "asc" },
      });

      employees = users.map((u) => ({
        id: u.id,
        first_name: u.firstName,
        last_name: u.lastName,
        email: u.email,
        role: u.role,
        client_role: null,
        label:
          `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
      }));
    } else if (user.role === "client") {
      if (!clientId) {
        return NextResponse.json({ employees: [] }, { status: 200 });
      }
      const role = user.activeClientRole;

      let where;
      if (role === "client") {
        // Owner sees all client-side users
        where = { clientId, active: true };
      } else if (role === "manager") {
        // Manager sees editors + viewers + self
        where = {
          clientId,
          active: true,
          OR: [
            { role: { in: ["editor", "viewer"] } },
            { userId: user.id },
          ],
        };
      } else {
        // Editor/Viewer: only self
        where = { clientId, active: true, userId: user.id };
      }

      const userClients = await prisma.wehowareUserClient.findMany({
        where,
        select: {
          userId: true,
          role: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { user: { firstName: "asc" } },
      });

      employees = userClients.map((uc) => ({
        id: uc.user.id,
        first_name: uc.user.firstName,
        last_name: uc.user.lastName,
        email: uc.user.email,
        role: uc.user.role,
        client_role: uc.role,
        label:
          `${uc.user.firstName || ""} ${uc.user.lastName || ""}`.trim() ||
          uc.user.email,
      }));
    } else {
      return NextResponse.json({ employees: [] }, { status: 200 });
    }

    return NextResponse.json({ employees }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/v1/daily-reports/analytics/employees] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler, {
  allowedRoles: ["admin", "client"],
});
