// src/app/api/utils/auth-middleware.js
// Route-level auth middleware — NextAuth v5 JWT session verification +
// API key authentication (Authorization: Bearer whk_...)

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function unauthorized(message) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(roles) {
  return NextResponse.json(
    { error: `Forbidden - Requires one of these roles: ${roles.join(", ")}` },
    { status: 403 }
  );
}

function forbiddenClientRoles(clientRoles) {
  return NextResponse.json(
    { error: `Forbidden - Requires one of these client roles: ${clientRoles.join(", ")}` },
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
    // SECURITY FIX: Do NOT trust profile.clientId directly — verify the user
    // still has an active WehowareUserClient row for that client.
    // This prevents removed/deactivated members from retaining access.
    if (profile.clientId) {
      try {
        const verified = await prisma.wehowareUserClient.findFirst({
          where: { userId: profile.id, clientId: profile.clientId, active: true },
          select: { clientId: true },
        });
        if (verified) return verified.clientId;
      } catch (err) {
        console.warn("[withAuth] Client fallback verification failed:", err);
      }
    }
    // If profile.clientId is not verified, try primary or any active client
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
 * Extract and verify an API key from the Authorization header.
 * Returns the matching WehowareProfile if valid, or null if not.
 *
 * Key format: "whk_<32 hex chars>"
 * Stored as: SHA-256 hash of the full key string
 */
async function authenticateWithApiKey(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  const rawKey = parts[1];
  if (!rawKey.startsWith("whk_")) return null;

  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  let apiKey;
  try {
    apiKey = await prisma.wehowareApiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: { id: true, email: true, role: true, clientId: true },
        },
      },
    });
  } catch (err) {
    console.warn("[withAuth] API key lookup error:", err);
    return null;
  }

  if (!apiKey || !apiKey.active) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update lastUsedAt (fire-and-forget)
  prisma.wehowareApiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return apiKey.user;
}

/**
 * withAuth — higher-order function that wraps a Route Handler with:
 *   1. API key authentication (Authorization: Bearer whk_...) — checked first
 *   2. JWT session verification via NextAuth auth() — fallback if no API key
 *   3. Profile lookup and role-based access control
 *   4. Optional client switching with audit logging
 *   5. request.user population for the handler
 *
 * Usage:
 *   export const GET = withAuth(handler);
 *   export const POST = withAuth(handler, { allowedRoles: ['admin', 'employee'] });
 *
 * @param {Function} handler  - the async (request, context) Route Handler
 * @param {Object}   options
 * @param {string[]} [options.allowedRoles] - if set, only these profile roles may proceed
 * @param {string[]} [options.allowedClientRoles] - if set, client-role users must also have
 *   an activeClientRole (per-client role) in this list. Admins bypass this check.
 */
export function withAuth(handler, options = {}) {
  return async (request, context) => {
    let profile;

    // --- API key authentication (checked first) ---
    const apiKeyUser = await authenticateWithApiKey(request);
    if (apiKeyUser) {
      profile = apiKeyUser;
    } else {
      // --- JWT session authentication (fallback) ---
      let session;
      try {
        session = await auth();
      } catch (err) {
        return serverError("withAuth] Session read error", err);
      }

      if (!session?.user?.id) {
        return unauthorized("Unauthorized - Not authenticated");
      }

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

    // Per-client role-based access control
    // When allowedClientRoles is set, client-role users must also have
    // an activeClientRole that matches. Admins bypass this check.
    if (
      options.allowedClientRoles?.length > 0 &&
      profile.role === "client" &&
      !options.allowedClientRoles.includes(request.user.activeClientRole)
    ) {
      return forbiddenClientRoles(options.allowedClientRoles);
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
