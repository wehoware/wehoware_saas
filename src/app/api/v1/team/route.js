/**
 * /api/v1/team
 *
 * GET  — List team members for the active client (client_owner/manager/admin/employee)
 * PUT  — Update a team member's per-client role (client_owner/admin/employee)
 * DELETE — Soft-remove a team member from the active client (client_owner/admin/employee)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";

// GET — list team members for active client
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const activeClientId = user.activeClientId;

      if (!activeClientId) {
        return NextResponse.json({ error: "No active client" }, { status: 400 });
      }

      // Authorization: admin/employee can view any; client (owner) and manager can view their own
      if (user.role === "client") {
        const uc = await prisma.wehowareUserClient.findFirst({
          where: { userId: user.id, clientId: activeClientId, active: true },
          select: { role: true },
        });
        if (!uc || !["client", "manager"].includes(uc.role)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      const members = await prisma.wehowareUserClient.findMany({
        where: { clientId: activeClientId, active: true },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const team = members.map((m) => ({
        id: m.user.id,
        userClientId: m.id,
        email: m.user.email,
        first_name: m.user.firstName,
        last_name: m.user.lastName,
        avatar_url: m.user.avatarUrl,
        global_role: m.user.role,
        client_role: m.role,
        is_primary: m.isPrimary,
        created_at: m.createdAt,
      }));

      return NextResponse.json({ team });
    } catch (err) {
      console.error("[GET /api/v1/team] error:", err);
      return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);

// PUT — update a team member's per-client role
export const PUT = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const activeClientId = user.activeClientId;
      const body = await request.json();
      const { user_id: targetUserId, role: newRole } = body ?? {};

      if (!activeClientId) {
        return NextResponse.json({ error: "No active client" }, { status: 400 });
      }
      if (!targetUserId || !newRole || !["client", "manager", "editor", "viewer"].includes(newRole)) {
        return NextResponse.json({ error: "Valid user_id and role required" }, { status: 400 });
      }

      // Authorization: only admin/employee or client_owner can change roles
      // Managers cannot promote to owner or change other managers
      if (user.role === "client") {
        const uc = await prisma.wehowareUserClient.findFirst({
          where: { userId: user.id, clientId: activeClientId, active: true },
          select: { role: true },
        });
        if (uc?.role !== "client") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      // Prevent changing your own role (self-protection)
      if (targetUserId === user.id) {
        return NextResponse.json({ error: "Cannot change your own role" }, { status: 403 });
      }

      const updated = await prisma.wehowareUserClient.updateMany({
        where: { userId: targetUserId, clientId: activeClientId, active: true },
        data: { role: newRole },
      });

      if (updated.count === 0) {
        return NextResponse.json({ error: "Team member not found" }, { status: 404 });
      }

      return NextResponse.json({ message: "Role updated" });
    } catch (err) {
      console.error("[PUT /api/v1/team] error:", err);
      return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);

// DELETE — soft-remove a team member from the active client
export const DELETE = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const activeClientId = user.activeClientId;
      const url = new URL(request.url);
      const targetUserId = url.searchParams.get("user_id");

      if (!activeClientId) {
        return NextResponse.json({ error: "No active client" }, { status: 400 });
      }
      if (!targetUserId) {
        return NextResponse.json({ error: "user_id is required" }, { status: 400 });
      }

      // Authorization
      if (user.role === "client") {
        const uc = await prisma.wehowareUserClient.findFirst({
          where: { userId: user.id, clientId: activeClientId, active: true },
          select: { role: true },
        });
        if (uc?.role !== "client") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      // Prevent self-removal
      if (targetUserId === user.id) {
        return NextResponse.json({ error: "Cannot remove yourself" }, { status: 403 });
      }

      const updated = await prisma.wehowareUserClient.updateMany({
        where: { userId: targetUserId, clientId: activeClientId, active: true },
        data: { active: false, isPrimary: false },
      });

      if (updated.count === 0) {
        return NextResponse.json({ error: "Team member not found" }, { status: 404 });
      }

      return NextResponse.json({ message: "Team member removed" });
    } catch (err) {
      console.error("[DELETE /api/v1/team] error:", err);
      return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);
