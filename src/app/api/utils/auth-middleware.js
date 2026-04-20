// src/app/api/utils/auth-middleware.js
// Route-level auth middleware — NextAuth v5 JWT session verification +

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      console.error("[withAuth] Session read error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized - Not authenticated" },
        { status: 401 }
      );
    }

    // Fetch profile — needed for authoritative role check.
    // (Role in JWT can be stale if changed between logins; DB is source of truth.)
    let profile;
    try {
      profile = await prisma.wehowareProfile.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          role: true,
          clientId: true,
        },
      });
    } catch (err) {
      console.error("[withAuth] DB error fetching profile:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Unauthorized - User profile not found" },
        { status: 401 }
      );
    }

    // Role-based access control
    if (
      options.allowedRoles?.length > 0 &&
      !options.allowedRoles.includes(profile.role)
    ) {
      return NextResponse.json(
        {
          error: `Forbidden - Requires one of these roles: ${options.allowedRoles.join(", ")}`,
        },
        { status: 403 }
      );
    }

    // Populate request.user — available to every wrapped handler
    request.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      clientId: profile.clientId ?? null,
    };

    // --- Resolve active client context (employees/admins/clients) ---
    // Precedence:
    //   1. Explicit ?clientId= query param (lets a single request override)
    //   2. wehoware_active_client_id cookie (set by the auth context when
    //      the user picks a client from the header switcher)
    //   3. Fallback: the user's primary wehoware_user_clients row, or their
    //      first accessible client — so every request has a client context
    //      without each admin page needing to pass ?clientId= manually.
    //
    // Regardless of source, access is always verified against
    // wehoware_user_clients before activeClientId is set on request.user.
    if (["employee", "admin", "client"].includes(profile.role)) {
      const url = new URL(request.url);
      const queryClientId = url.searchParams.get("clientId");
      const cookieClientId = request.cookies?.get?.(
        "wehoware_active_client_id"
      )?.value;

      // Explicit sources to try in order. We only write an audit row when
      // the user actually changes their client (query param request), not
      // on every page load where the cookie is just replaying state.
      const candidates = [
        { id: queryClientId, audit: true },
        { id: cookieClientId, audit: false },
      ].filter((c) => c.id);

      let resolvedClientId = null;

      for (const { id, audit } of candidates) {
        try {
          const clientAccess = await prisma.wehowareUserClient.findFirst({
            where: { userId: profile.id, clientId: id },
            select: { clientId: true },
          });
          if (!clientAccess) continue;

          resolvedClientId = id;

          if (audit) {
            // Fire-and-forget audit insert; don't block the request on it.
            prisma.wehowareClientSwitchHistory
              .create({
                data: {
                  userId: profile.id,
                  clientId: id,
                  ipAddress:
                    request.headers
                      .get("x-forwarded-for")
                      ?.split(",")[0]
                      ?.trim() ?? "unknown",
                  userAgent: request.headers.get("user-agent") ?? "unknown",
                },
              })
              .catch((err) => {
                console.warn(
                  "[withAuth] Failed to write switch history:",
                  err
                );
              });
          }
          break;
        } catch (err) {
          console.warn("[withAuth] Client access check error:", err);
        }
      }

      // Fallback: pick the user's primary client (or first accessible).
      // For role=client, profile.clientId is the authoritative tenant.
      if (!resolvedClientId) {
        if (profile.role === "client") {
          resolvedClientId = profile.clientId ?? null;
        } else {
          try {
            const primary =
              (await prisma.wehowareUserClient.findFirst({
                where: { userId: profile.id, isPrimary: true },
                select: { clientId: true },
              })) ??
              (await prisma.wehowareUserClient.findFirst({
                where: { userId: profile.id },
                select: { clientId: true },
              }));
            resolvedClientId = primary?.clientId ?? null;
          } catch (err) {
            console.warn(
              "[withAuth] Fallback client lookup failed:",
              err
            );
          }
        }
      }

      if (resolvedClientId) {
        request.user.activeClientId = resolvedClientId;
      }
    }

    // Attach Prisma client for route handlers.
    request.prisma = prisma;

    try {
      return await handler(request, context);
    } catch (err) {
      console.error("[withAuth] Handler threw an unhandled error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
