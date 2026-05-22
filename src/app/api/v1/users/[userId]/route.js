/**
 * /api/v1/users/[userId]
 *
 * GET    — fetch user (admin/employee/client-manager scoped to their client)
 * PUT    — update user (admin: full; client-manager: name + client_role only)
 * DELETE — delete user (admin: any; client-manager: client users in their client only)
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withAuth } from "../../../utils/auth-middleware";

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
// GET
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { userId } = await params;

      if (!userId) {
        return NextResponse.json({ error: "User ID is required" }, { status: 400 });
      }

      if (user.role === "client") {
        if (user.activeClientRole !== "manager") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const managerClientId = user.activeClientId ?? user.clientId;
        const memberRecord = await prisma.wehowareUserClient.findFirst({
          where: { userId, clientId: managerClientId, active: true },
          select: { userId: true },
        });
        if (!memberRecord) {
          return NextResponse.json(
            { error: "User not found in your client" },
            { status: 403 }
          );
        }
      }

      const profile = await prisma.wehowareProfile.findUnique({
        where: { id: userId },
        select: {
          ...USER_SELECT,
          userClients: {
            select: { clientId: true, isPrimary: true, role: true },
          },
        },
      });

      if (!profile) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({ user: serializeUser(profile) }, { status: 200 });
    } catch (err) {
      console.error("[GET /api/v1/users/[userId]] error:", err);
      return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);

// -------------------------------------------------------------------
// PUT
// -------------------------------------------------------------------
async function buildProfileUpdateData(body, existing) {
  const {
    email,
    first_name,
    last_name,
    avatar_url,
    role,
    password,
    client_ids: clientIdsRaw,
    primary_client_id: primaryClientIdRaw,
  } = body ?? {};

  const profileData = {};
  const updates = [];

  if (email !== undefined) profileData.email = String(email).trim().toLowerCase();
  if (first_name !== undefined) profileData.firstName = String(first_name).trim() || null;
  if (last_name !== undefined) profileData.lastName = String(last_name).trim() || null;
  if (avatar_url !== undefined) profileData.avatarUrl = avatar_url || null;
  if (role !== undefined) profileData.role = role;
  if (password !== undefined && String(password).length >= 6) {
    profileData.passwordHash = await bcrypt.hash(String(password), 10);
    updates.push("password");
  }

  const effectiveRole = role ?? existing.role;
  const shouldUpdateClients = Array.isArray(clientIdsRaw);
  let primaryClientIdForProfile = null;

  if (shouldUpdateClients) {
    if (effectiveRole === "client") {
      primaryClientIdForProfile = primaryClientIdRaw || clientIdsRaw[0] || null;
      profileData.clientId = primaryClientIdForProfile;
    } else {
      profileData.clientId = null;
    }
  }

  return {
    profileData,
    updates,
    effectiveRole,
    shouldUpdateClients,
    primaryClientIdForProfile,
    email,
    firstName: first_name,
    lastName: last_name,
    avatarUrl: avatar_url,
    role,
  };
}

async function runUpdateTransaction(tx, userId, payload) {
  const {
    profileData,
    updates,
    shouldUpdateClients,
    primaryClientIdForProfile,
    clientIdsRaw,
    email,
    firstName,
    lastName,
    avatarUrl,
    role,
    clientRoleOverride,
  } = payload;

  if (Object.keys(profileData).length > 0) {
    await tx.wehowareProfile.update({ where: { id: userId }, data: profileData });
    if (email !== undefined) updates.push("email");
    if (firstName !== undefined || lastName !== undefined || avatarUrl !== undefined || role !== undefined) {
      updates.push("profile");
    }
  }

  if (shouldUpdateClients) {
    await tx.wehowareUserClient.deleteMany({ where: { userId } });
    if (clientIdsRaw.length > 0) {
      await tx.wehowareUserClient.createMany({
        data: clientIdsRaw.map((cid) => ({
          userId,
          clientId: cid,
          isPrimary: cid === primaryClientIdForProfile,
          role: clientRoleOverride ?? "client",
        })),
      });
    }
    updates.push("client_associations");
  }

  return tx.wehowareProfile.findUnique({
    where: { id: userId },
    select: {
      ...USER_SELECT,
      userClients: { select: { clientId: true, isPrimary: true, role: true } },
    },
  });
}

export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { userId } = await params;

      if (!userId) {
        return NextResponse.json({ error: "User ID is required" }, { status: 400 });
      }

      const body = await request.json();
      const { role, client_ids: clientIdsRaw, client_role: clientRole } = body ?? {};

      const existing = await prisma.wehowareProfile.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true, passwordHash: true, clientId: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // --- Client manager path ---
      if (user.role === "client") {
        if (user.activeClientRole !== "manager") {
          return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const managerClientId = user.activeClientId ?? user.clientId;
        const targetUserClient = await prisma.wehowareUserClient.findFirst({
          where: { userId, clientId: managerClientId, active: true },
          select: { role: true },
        });
        if (!targetUserClient) {
          return NextResponse.json(
            { error: "User not found in your client" },
            { status: 403 }
          );
        }
        if (existing.role !== "client") {
          return NextResponse.json(
            { error: "You can only edit client users" },
            { status: 403 }
          );
        }
        if (role && role !== "client") {
          return NextResponse.json(
            { error: "You cannot change the system role of this user" },
            { status: 403 }
          );
        }
        if (clientRole !== undefined && !MANAGER_ASSIGNABLE_ROLES.includes(clientRole)) {
          return NextResponse.json({ error: "Invalid client_role" }, { status: 400 });
        }

        const { first_name, last_name, avatar_url, password } = body ?? {};
        const profileData = {};
        if (first_name !== undefined) profileData.firstName = String(first_name).trim() || null;
        if (last_name !== undefined) profileData.lastName = String(last_name).trim() || null;
        if (avatar_url !== undefined) profileData.avatarUrl = avatar_url || null;
        if (password && String(password).length >= 6) {
          profileData.passwordHash = await bcrypt.hash(String(password), 10);
        }

        await prisma.$transaction(async (tx) => {
          if (Object.keys(profileData).length > 0) {
            await tx.wehowareProfile.update({ where: { id: userId }, data: profileData });
          }
          if (clientRole !== undefined) {
            await tx.wehowareUserClient.updateMany({
              where: { userId, clientId: managerClientId },
              data: { role: clientRole },
            });
          }
        });

        const updated = await prisma.wehowareProfile.findUnique({
          where: { id: userId },
          select: {
            ...USER_SELECT,
            userClients: { select: { clientId: true, isPrimary: true, role: true } },
          },
        });
        return NextResponse.json(
          { message: "User updated successfully", userId, user: serializeUser(updated) },
          { status: 200 }
        );
      }

      // --- Admin path ---
      if (role === "admin" && !["employee", "admin"].includes(existing.role)) {
        return NextResponse.json(
          { error: "Cannot upgrade to admin role via this endpoint" },
          { status: 400 }
        );
      }
      if (clientRole !== undefined && !VALID_CLIENT_ROLES.includes(clientRole)) {
        return NextResponse.json({ error: "Invalid client_role" }, { status: 400 });
      }

      const payload = await buildProfileUpdateData(body, existing);
      payload.clientIdsRaw = clientIdsRaw;
      payload.clientRoleOverride = clientRole ?? null;
      const updated = await prisma.$transaction((tx) =>
        runUpdateTransaction(tx, userId, payload)
      );

      return NextResponse.json(
        {
          message: "User updated successfully",
          userId,
          updates: payload.updates,
          user: serializeUser(updated),
        },
        { status: 200 }
      );
    } catch (err) {
      console.error("[PUT /api/v1/users/[userId]] error:", err);
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
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "client"] }
);

// -------------------------------------------------------------------
// DELETE
// -------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma, user } = request;
      const { userId } = await params;

      if (!userId) {
        return NextResponse.json({ error: "User ID is required" }, { status: 400 });
      }

      const existing = await prisma.wehowareProfile.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (user.role === "client") {
        if (user.activeClientRole !== "manager") {
          return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
        if (userId === user.id) {
          return NextResponse.json(
            { error: "Cannot delete your own account" },
            { status: 403 }
          );
        }
        if (existing.role !== "client") {
          return NextResponse.json(
            { error: "You can only delete client users" },
            { status: 403 }
          );
        }
        const managerClientId = user.activeClientId ?? user.clientId;
        const targetUserClient = await prisma.wehowareUserClient.findFirst({
          where: { userId, clientId: managerClientId, active: true },
          select: { userId: true },
        });
        if (!targetUserClient) {
          return NextResponse.json(
            { error: "User not found in your client" },
            { status: 403 }
          );
        }
      }

      await prisma.wehowareProfile.delete({ where: { id: userId } });
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      console.error("[DELETE /api/v1/users/[userId]] error:", err);
      return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "client"] }
);
