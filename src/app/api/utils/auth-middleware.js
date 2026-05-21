// src/app/api/utils/auth-middleware.js
// Route-level auth middleware — NextAuth v5 JWT session verification +

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function unauthorized(message) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(roles) {
  return NextResponse.json(
    { error: `Forbidden - Requires one of these roles: ${roles.join(", ")}` },
    { status: 403 }
  );
}

function serverError(logPrefix, err) {
  console.error(`[${logPrefix}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

function getClientAccessCandidates(request) {
  const url = new URL(request.url);
  const queryClientId = url.searchParams.get("clientId");
  const cookieClientId = request.cookies?.get?.("wehoware_active_client_id")?.value;
  return [
    { id: queryClientId, audit: true },
    { id: cookieClientId, audit: false },
  ].filter((c) => c.id);
}

function logClientSwitch(profileId, clientId, request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const ua = request.headers.get("user-agent") ?? "unknown";
  prisma.wehowareClientSwitchHistory
    .create({
      data: { userId: profileId, clientId, ipAddress: ip, userAgent: ua },
    })
    .catch((err) => console.warn("[withAuth] Failed to write switch history:", err));
}

async function tryClientAccess(profileId, clientId) {
  const row = await prisma.wehowareUserClient.findFirst({
    where: { userId: profileId, clientId, active: true },
    select: { clientId: true },
  });
  return row ? clientId : null;
}

async function resolveActiveClientId(profile, candidates, request) {
  for (const { id, audit } of candidates) {
    try {
      const resolved = await tryClientAccess(profile.id, id);
      if (!resolved) continue;
      if (audit) logClientSwitch(profile.id, id, request);
      return resolved;
    } catch (err) {
      console.warn("[withAuth] Client access check error:", err);
    }
  }

  // Fallback
  if (profile.role === "client") {
    return profile.clientId ?? null;
  }
  try {
    const primary =
      (await prisma.wehowareUserClient.findFirst({
        where: { userId: profile.id, isPrimary: true, active: true },
        select: { clientId: true },
      })) ??
      (await prisma.wehowareUserClient.findFirst({
        where: { userId: profile.id, active: true },
        select: { clientId: true },
      }));
    return primary?.clientId ?? null;
  } catch (err) {
    console.warn("[withAuth] Fallback client lookup failed:", err);
    return null;
  }
}

async function resolveActiveClientRole(profile, activeClientId) {
  if (!activeClientId) return null;
  try {
    const uc = await prisma.wehowareUserClient.findFirst({
      where: { userId: profile.id, clientId: activeClientId, active: true },
      select: { role: true },
    });
    return uc?.role ?? null;
  } catch (err) {
    console.warn("[withAuth] Failed to resolve active client role:", err);
    return null;
  }
}

/**
 * withAuth — higher-order function that wraps a Route Handler with:
 *   1. JWT session verification via NextAuth auth()
 *   2. Profile lookup and role-based access control
 *   3. Optional client switching with audit logging
 *   4. request.user population for the handler
 *
 * Usage:
 *   export const GET = withAuth(handler);
 *   export const POST = withAuth(handler, { allowedRoles: ['admin', 'employee'] });
 *
 * @param {Function} handler  - the async (request, context) Route Handler
 * @param {Object}   options
 * @param {string[]} [options.allowedRoles] - if set, only these roles may proceed
 */
export function withAuth(handler, options = {}) {
  return async (request, context) => {
    let session;
    try {
      session = await auth();
    } catch (err) {
      return serverError("withAuth] Session read error", err);
    }

    if (!session?.user?.id) {
      return unauthorized("Unauthorized - Not authenticated");
    }

    let profile;
    try {
      profile = await prisma.wehowareProfile.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, role: true, clientId: true },
      });
    } catch (err) {
      return serverError("withAuth] DB error fetching profile", err);
    }

    if (!profile) {
      return unauthorized("Unauthorized - User profile not found");
    }

    // Role-based access control
    if (
      options.allowedRoles?.length > 0 &&
      !options.allowedRoles.includes(profile.role)
    ) {
      return forbidden(options.allowedRoles);
    }

    // Populate request.user
    request.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      clientId: profile.clientId ?? null,
    };

    // Resolve active client context
    if (["employee", "admin", "client"].includes(profile.role)) {
      const candidates = getClientAccessCandidates(request);
      const activeClientId = await resolveActiveClientId(profile, candidates, request);
      if (activeClientId) {
        request.user.activeClientId = activeClientId;
      }
      request.user.activeClientRole = await resolveActiveClientRole(
        profile,
        request.user.activeClientId
      );
    }

    // Attach Prisma client for route handlers
    request.prisma = prisma;

    try {
      return await handler(request, context);
    } catch (err) {
      return serverError("withAuth] Handler threw an unhandled error", err);
    }
  };
}
