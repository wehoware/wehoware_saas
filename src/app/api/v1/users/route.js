/**
 * /api/v1/users
 *
 * Prisma/MySQL-backed replacement for the old Supabase auth.admin + profiles
 * handler. NextAuth v5 + bcryptjs now own credential storage, so the password
 * is hashed here and persisted to wehoware_profiles.password_hash.
 *
 * GET   — list users (optionally filtered by role), with client associations
 * POST  — create a new user (admin-only)
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withAuth } from "../../utils/auth-middleware";

// Fields returned for user listings. Explicitly omit passwordHash.
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

/**
 * Reshape a Prisma profile + userClients join back into the snake_case
 * payload the old Supabase API returned. Keeps frontend consumers working.
 */
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
    // Backward-compat shape expected by admin UI
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
// GET /api/v1/users
// -------------------------------------------------------------------
export const GET = withAuth(
  async (request) => {
    try {
      const { prisma } = request;
      const url = new URL(request.url);
      const roles = url.searchParams.getAll("role");

      const where = {};
      if (roles.length > 0) {
        where.role = { in: roles };
      }

      const profiles = await prisma.wehowareProfile.findMany({
        where,
        select: {
          ...USER_SELECT,
          userClients: {
            select: { clientId: true, isPrimary: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const users = profiles.map(serializeUser);

      return NextResponse.json({ users }, { status: 200 });
    } catch (err) {
      console.error("[GET /api/v1/users] error:", err);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin", "employee"] }
);

// -------------------------------------------------------------------
// POST /api/v1/users  (admin-only)
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma } = request;
      const body = await request.json();

      const {
        email,
        password,
        role,
        first_name: firstName,
        last_name: lastName,
        avatar_url: avatarUrl,
        client_ids: clientIdsRaw,
      } = body ?? {};

      // Validate required fields
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

      const clientIds = Array.isArray(clientIdsRaw) ? clientIdsRaw : [];

      // Role-specific validation mirrors the old API contract
      if (role === "client" && clientIds.length === 0) {
        return NextResponse.json(
          { error: "Client role requires at least one client association" },
          { status: 400 }
        );
      }
      if (role === "employee" && clientIds.length > 0) {
        return NextResponse.json(
          { error: "Employee role cannot have client associations during creation" },
          { status: 400 }
        );
      }

      // Enforce unique email up-front for a nicer error than P2002
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

      // Use a transaction so the profile + associations are atomic
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

        if (role === "client" && clientIds.length > 0) {
          await tx.wehowareUserClient.createMany({
            data: clientIds.map((cid) => ({
              userId: profile.id,
              clientId: cid,
              isPrimary: cid === primaryClientId,
            })),
          });
        }

        const userClients = await tx.wehowareUserClient.findMany({
          where: { userId: profile.id },
          select: { clientId: true, isPrimary: true },
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
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["admin"] }
);
