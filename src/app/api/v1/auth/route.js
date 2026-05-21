// src/app/api/v1/auth/route.js
// Auth API — NextAuth v5 + Prisma.
//
// ARCHITECTURE NOTE (post-migration):
//   The primary login/logout flow in auth-context.js now uses NextAuth's own
//   endpoints directly:
//     Login:  signIn('credentials', { redirect: false }) → /api/auth/callback/credentials
//     Logout: signOut({ redirect: false })               → /api/auth/signout
//
//   This file's endpoints serve two purposes:
//     GET    — session hydration: reads the NextAuth JWT and returns the
//              enriched user object (accessible clients, client details, names).
//              Called on every page load by auth-context.js.
//     POST   — legacy/API-client credential check: verifies email+password via
//              Prisma+bcrypt and returns user data. Does NOT establish a session
//              cookie (session is set only via /api/auth/callback/credentials).
//              Kept for backward compatibility with non-browser API clients.
//     DELETE — legacy session clear: deletes the NextAuth session cookies.
//              Kept for backward compatibility; browser flow uses signOut().

import { NextResponse } from "next/server";
import {
  auth,
  getAccessibleClients,
  getClientDetails,
  ROLES_WITH_CLIENT_ACCESS,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Cookie names used by NextAuth v5 (vary by environment)
const SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

// ----------------------------------------------------------------
// Shared: build the enriched user object returned to the frontend.
// Uses a single Prisma query + two optional helpers — no N+1.
// ----------------------------------------------------------------
async function buildUserResponse(userId, activeClientId) {
  const profile = await prisma.wehowareProfile.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      role: true,
      clientId: true,
    },
  });

  if (!profile) return null;

  let accessibleClients = [];
  let clientDetails = null;
  let activeClientRole = null;

  if (ROLES_WITH_CLIENT_ACCESS.includes(profile.role)) {
    accessibleClients = await getAccessibleClients(profile.id);
  }

  if (profile.role === "client" && profile.clientId) {
    clientDetails = await getClientDetails(profile.clientId);
  }

  // Resolve per-client role for the active client context
  if (activeClientId && ROLES_WITH_CLIENT_ACCESS.includes(profile.role)) {
    const uc = await prisma.wehowareUserClient.findFirst({
      where: { userId: profile.id, clientId: activeClientId, active: true },
      select: { role: true },
    });
    activeClientRole = uc?.role ?? null;
  }

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    avatarUrl: profile.avatarUrl ?? "",
    clientId: profile.clientId ?? null,
    activeClientRole,
    accessibleClients,
    clientDetails,
  };
}

// ----------------------------------------------------------------
// GET /api/v1/auth — Return enriched current user from JWT session.
//
// Called on every page load by auth-context.js initializeAuth().
// Returns { user: UserObject } or { user: null } — never 4xx on
// missing session (the frontend decides what to do with null).
// ----------------------------------------------------------------
export async function GET(request) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error("[GET /api/v1/auth] Session read error:", err);
    return NextResponse.json({ user: null });
  }

  if (!session?.user?.id) {
    return NextResponse.json({ user: null });
  }

  try {
    const activeClientId =
      request?.cookies?.get?.("wehoware_active_client_id")?.value ?? null;
    const user = await buildUserResponse(session.user.id, activeClientId);
    return NextResponse.json({ user });
  } catch (err) {
    console.error("[GET /api/v1/auth] DB error:", err);
    // Return null rather than 500 — the frontend gracefully handles a null user
    return NextResponse.json({ user: null });
  }
}

// ----------------------------------------------------------------
// POST /api/v1/auth — Credential verification for API clients.
//
// IMPORTANT: This endpoint verifies credentials and returns user
// data but does NOT set a session cookie. Callers that need a
// browser session must use POST /api/auth/callback/credentials
// (the NextAuth handler) instead.
//
// Body: { email: string, password: string }
// ----------------------------------------------------------------
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { email, password } = body;

  if (!email || typeof email !== "string" || email.trim().length === 0) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Password is required" },
      { status: 400 }
    );
  }

  let profile;
  try {
    profile = await prisma.wehowareProfile.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        passwordHash: true,
      },
    });
  } catch (err) {
    console.error("[POST /api/v1/auth] DB error during lookup:", err);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }

  if (!profile?.passwordHash) {
    // Use the same generic message for missing user and wrong password
    // to prevent user-enumeration attacks
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const isValid = await bcrypt.compare(String(password), profile.passwordHash);

  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  try {
    const user = await buildUserResponse(profile.id);
    if (!user) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ user });
  } catch (err) {
    console.error("[POST /api/v1/auth] DB error building response:", err);
    return NextResponse.json(
      { error: "Failed to load user profile" },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------
// DELETE /api/v1/auth — Clear NextAuth session cookies.
//
// Legacy endpoint — the browser login flow now uses
// signOut({ redirect: false }) from next-auth/react directly.
// This endpoint is kept for API clients or non-browser flows.
// ----------------------------------------------------------------
export async function DELETE() {
  const response = NextResponse.json({ success: true });

  SESSION_COOKIE_NAMES.forEach((name) => {
    response.cookies.set(name, "", {
      httpOnly: true,
      expires: new Date(0),
      path: "/",
      sameSite: "lax",
    });
  });

  return response;
}
