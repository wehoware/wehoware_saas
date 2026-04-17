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
            select: { clientId: true, isPrimary: true },
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
      const {
        email,
        password,
        role,
        first_name: firstName,
        last_name: lastName,
        avatar_url: avatarUrl,
        client_ids: clientIdsRaw,
        primary_client_id: primaryClientIdRaw,
      } = body ?? {};

      // Verify the user exists before doing any writes
      const existing = await prisma.wehowareProfile.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      const updates = [];
      const profileData = {};

      if (email !== undefined) profileData.email = email;
      if (firstName !== undefined) profileData.firstName = firstName;
      if (lastName !== undefined) profileData.lastName = lastName;
      if (avatarUrl !== undefined) profileData.avatarUrl = avatarUrl;
      if (role !== undefined) profileData.role = role;

      if (password) {
        profileData.passwordHash = await bcrypt.hash(password, 10);
        updates.push("password");
      }

      const effectiveRole = role ?? existing.role;
      const shouldUpdateClients =
        effectiveRole === "client" && Array.isArray(clientIdsRaw);

      let primaryClientIdForProfile;
      if (shouldUpdateClients) {
        primaryClientIdForProfile =
          primaryClientIdRaw || clientIdsRaw[0] || null;
        profileData.clientId = primaryClientIdForProfile;
      }

      // Transaction so the profile row and its associations stay in sync
      const updated = await prisma.$transaction(async (tx) => {
        if (Object.keys(profileData).length > 0) {
          await tx.wehowareProfile.update({
            where: { id: userId },
            data: profileData,
          });
          if (email !== undefined) updates.push("email");
          if (
            firstName !== undefined ||
            lastName !== undefined ||
            avatarUrl !== undefined ||
            role !== undefined
          ) {
            updates.push("profile");
          }
        }

        if (shouldUpdateClients) {
          // Simple diff-by-replace: delete then recreate. The @@unique on
          // (userId, clientId) makes an upsert path unnecessary here.
          await tx.wehowareUserClient.deleteMany({
            where: { userId },
          });

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

        const profile = await tx.wehowareProfile.findUnique({
          where: { id: userId },
          select: {
            ...USER_SELECT,
            userClients: {
              select: { clientId: true, isPrimary: true },
            },
          },
        });

        return profile;
      });

      return NextResponse.json(
        {
          message: "User updated successfully",
          userId,
          updates,
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
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
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
