/**
 * GET /api/v1/reports/employees
 *
 * Returns the list of users that the current user can view in task reports,
 * based on role hierarchy and cross-group isolation rules.
 *
 * Visibility:
 *   admin          → all admin+employee users
 *   client (owner) → all client-side users for their client
 *   client (manager) → editors + viewers for their client
 *   client (editor)  → own only
 *   client (viewer)  → own only
 *   employee         → own only
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../utils/auth-middleware";

export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const clientId = user.activeClientId ?? user.clientId;

      let employees;

      if (user.role === "admin") {
        const users = await prisma.wehowareProfile.findMany({
          where: { role: { in: ["admin", "employee"] } },
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
          where = { clientId, active: true };
        } else if (role === "manager") {
          where = {
            clientId,
            active: true,
            OR: [
              { role: { in: ["editor", "viewer"] } },
              { userId: user.id },
            ],
          };
        } else {
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
          label:
            `${uc.user.firstName || ""} ${uc.user.lastName || ""}`.trim() ||
            uc.user.email,
        }));
      } else {
        return NextResponse.json({ employees: [] }, { status: 200 });
      }

      return NextResponse.json({ employees }, { status: 200 });
    } catch (err) {
      console.error("[GET /api/v1/reports/employees] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch employees" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "client"] }
);
