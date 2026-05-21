/**
 * /api/v1/users/[userId]
 *
 * Prisma/MySQL-backed handlers for a single user profile.
 * GET    — fetch (admin/employee)
 * PUT    — update (admin-only); supports password rehash + client assoc diff
 * DELETE — delete (admin-only); cascade removes user_clients rows
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withAuth } from "../../../utils/auth-middleware";

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
  return {
    id: profile.id,
    email: profile.email,
    first_name: profile.firstName,
    last_name: profile.lastName,
    avatar_url: profile.avatarUrl,
    role: profile.role,
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
      const { prisma } = request;
      const { userId } = await params;

      if (!userId) {
        return NextResponse.json(
          { error: "User ID is required" },
          { status: 400 }
        );
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
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ user: serializeUser(profile) }, { status: 200 });
    } catch (err) {
      console.error("[GET /api/v1/users/[userId]] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch user" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);

// -------------------------------------------------------------------
// PUT (admin-only)
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
  if (password !== undefined && password.length >= 6) {
    profileData.passwordHash = await bcrypt.hash(password, 10);
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

  return { profileData, updates, effectiveRole, shouldUpdateClients, primaryClientIdForProfile, email, firstName: first_name, lastName: last_name, avatarUrl: avatar_url, role };
}

async function runUpdateTransaction(tx, userId, payload) {
  const { profileData, updates, shouldUpdateClients, primaryClientIdForProfile, clientIdsRaw, email, firstName, lastName, avatarUrl, role } = payload;

  if (Object.keys(profileData).length > 0) {
    await tx.wehowareProfile.update({
      where: { id: userId },
      data: profileData,
    });
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
        })),
      });
    }
    updates.push("client_associations");
  }

  return tx.wehowareProfile.findUnique({
    where: { id: userId },
    select: {
      ...USER_SELECT,
      userClients: { select: { clientId: true, isPrimary: true } },
    },
  });
}

export const PUT = withAuth(
  async (request, { params }) => {
    try {
      const { prisma } = request;
      const { userId } = await params;

      if (!userId) {
        return NextResponse.json(
          { error: "User ID is required" },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { role, client_ids: clientIdsRaw } = body ?? {};

      const existing = await prisma.wehowareProfile.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true, passwordHash: true, clientId: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (role === "admin" && !["employee", "admin"].includes(existing.role)) {
        return NextResponse.json(
          { error: "Cannot downgrade a non-admin to admin via PUT" },
          { status: 400 }
        );
      }

      const payload = await buildProfileUpdateData(body, existing);
      payload.clientIdsRaw = clientIdsRaw;
      const updated = await prisma.$transaction((tx) => runUpdateTransaction(tx, userId, payload));

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
        return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
      }
      if (err?.code === "P2003") {
        return NextResponse.json({ error: "One or more client IDs are invalid" }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin"] }
);

// -------------------------------------------------------------------
// DELETE (admin-only)
// -------------------------------------------------------------------
export const DELETE = withAuth(
  async (request, { params }) => {
    try {
      const { prisma } = request;
      const { userId } = await params;

      if (!userId) {
        return NextResponse.json(
          { error: "User ID is required" },
          { status: 400 }
        );
      }

      const existing = await prisma.wehowareProfile.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      // Cascade on WehowareUserClient removes associations automatically
      await prisma.wehowareProfile.delete({ where: { id: userId } });

      return new NextResponse(null, { status: 204 });
    } catch (err) {
      console.error("[DELETE /api/v1/users/[userId]] error:", err);
      return NextResponse.json(
        { error: "Failed to delete user" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
