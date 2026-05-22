/**
 * /api/v1/users
 *
 * GET  — list users; admins/employees see all, client managers see their client's users only
 * POST — create a new user; admins create any role, client managers create client-role users only
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withAuth } from "../../utils/auth-middleware";

const VALID_USER_ROLES = ["admin", "employee", "client"];
const VALID_CLIENT_ROLES = ["client", "manager", "editor", "viewer"];
const MANAGER_ASSIGNABLE_ROLES = ["manager", "editor", "viewer"];

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  role: true,
  clientId: true,
  createdAt: true,
  updatedAt: true,
};

function serializeUser(profile) {
  const userClients = profile.userClients ?? [];
  const primaryClient = userClients.find((uc) => uc.isPrimary) ?? userClients[0];
  return {
    id: profile.id,
    email: profile.email,
    first_name: profile.firstName,
    last_name: profile.lastName,
    avatar_url: profile.avatarUrl,
    role: profile.role,
    client_role: primaryClient?.role ?? null,
    client_id: profile.clientId,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
    wehoware_user_clients: userClients.map((uc) => ({
      client_id: uc.clientId,
      is_primary: uc.isPrimary,
      role: uc.role,
    })),
    client_ids: userClients.map((uc) => uc.clientId),
    primary_client_id:
      userClients.find((uc) => uc.isPrimary)?.clientId ?? profile.clientId,
  };
}

// -------------------------------------------------------------------
// GET /api/v1/users
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const url = new URL(request.url);
      const roles = url.searchParams.getAll("role");
      const where = {};

      if (user.role === "client") {
        if (user.activeClientRole !== "manager") {
          return NextResponse.json(
            { error: "Forbidden - Only client managers can access this" },
            { status: 403 }
          );
        }
        const managerClientId = user.activeClientId ?? user.clientId;
        if (!managerClientId) {
          return NextResponse.json(
            { error: "No active client context found" },
            { status: 400 }
          );
        }
        // Managers only see client-role users belonging to their client
        where.role = "client";
        where.userClients = {
          some: { clientId: managerClientId, active: true },
        };
      } else if (roles.length > 0) {
        where.role = { in: roles };
      }

      const profiles = await prisma.wehowareProfile.findMany({
        where,
        select: {
          ...USER_SELECT,
          userClients: {
            select: { clientId: true, isPrimary: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ users: profiles.map(serializeUser) }, { status: 200 });
    } catch (err) {
      console.error("[GET /api/v1/users] error:", err);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);

// -------------------------------------------------------------------
// POST /api/v1/users
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma, user } = request;
      const body = await request.json();

      const {
        email,
        password,
        role,
        first_name: firstName,
        last_name: lastName,
        avatar_url: avatarUrl,
        client_ids: clientIdsRaw,
        client_role: clientRole,
      } = body ?? {};

      if (!email || !password || !role) {
        return NextResponse.json(
          { error: "Email, password, and role are required" },
          { status: 400 }
        );
      }
      if (!firstName || !lastName) {
        return NextResponse.json(
          { error: "First name and last name are required" },
          { status: 400 }
        );
      }
      if (!VALID_USER_ROLES.includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }

      let clientIds = Array.isArray(clientIdsRaw) ? clientIdsRaw : [];
      let effectiveClientRole = clientRole ?? "viewer";

      if (user.role === "admin") {
        if (role === "client") {
          if (clientIds.length === 0) {
            return NextResponse.json(
              { error: "Client role requires at least one client association" },
              { status: 400 }
            );
          }
          if (!VALID_CLIENT_ROLES.includes(effectiveClientRole)) {
            return NextResponse.json({ error: "Invalid client_role" }, { status: 400 });
          }
        }
      } else if (user.role === "client" && user.activeClientRole === "manager") {
        if (role !== "client") {
          return NextResponse.json(
            { error: "You can only create client users" },
            { status: 403 }
          );
        }
        if (!MANAGER_ASSIGNABLE_ROLES.includes(effectiveClientRole)) {
          return NextResponse.json(
            { error: "You can only assign manager, editor, or viewer roles" },
            { status: 403 }
          );
        }
        const managerClientId = user.activeClientId ?? user.clientId;
        if (!managerClientId) {
          return NextResponse.json(
            { error: "No active client context found" },
            { status: 400 }
          );
        }
        clientIds = [managerClientId];
      } else {
        return NextResponse.json(
          { error: "Insufficient permissions to create users" },
          { status: 403 }
        );
      }

      if (role === "client" && clientIds.length === 0) {
        return NextResponse.json(
          { error: "Client role requires at least one client association" },
          { status: 400 }
        );
      }

      const existing = await prisma.wehowareProfile.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 409 }
        );
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const primaryClientId = role === "client" ? clientIds[0] : null;

      const created = await prisma.$transaction(async (tx) => {
        const profile = await tx.wehowareProfile.create({
          data: {
            email,
            passwordHash,
            firstName,
            lastName,
            avatarUrl: avatarUrl ?? null,
            role,
            clientId: primaryClientId,
          },
          select: USER_SELECT,
        });

        if (clientIds.length > 0) {
          await tx.wehowareUserClient.createMany({
            data: clientIds.map((cid) => ({
              userId: profile.id,
              clientId: cid,
              isPrimary: cid === primaryClientId,
              role: role === "client" ? effectiveClientRole : "client",
            })),
          });
        }

        const userClients = await tx.wehowareUserClient.findMany({
          where: { userId: profile.id },
          select: { clientId: true, isPrimary: true, role: true },
        });

        return { ...profile, userClients };
      });

      return NextResponse.json(
        {
          message: "User created successfully",
          userId: created.id,
          user: serializeUser(created),
        },
        { status: 201 }
      );
    } catch (err) {
      console.error("[POST /api/v1/users] error:", err);
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 409 }
        );
      }
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "One or more client IDs are invalid" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "client"] }
);
