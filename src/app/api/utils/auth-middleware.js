// src/app/api/utils/auth-middleware.js
// Route-level auth middleware — replaces Supabase SSR session check
// with NextAuth v5 JWT session verification.
//
// TRANSITIONAL NOTE:
//   This middleware attaches BOTH:
//     request.prisma  — Prisma client (for migrated routes)
//     request.supabase — Supabase service-role client (for routes not yet
//                        migrated from Supabase; RLS is disabled on all
//                        tables so the service role key gives full access)
//   As each API route is migrated to Prisma, remove the request.supabase
//   usage from that route. Once all routes are migrated, remove the
//   supabaseAdmin import and request.supabase assignment here.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import supabaseAdmin from "@/lib/supabaseAdmin";

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

    // --- Client switching (employees/admins) ---
    // When a ?clientId= query param is provided and the user has access to
    // that client, set activeClientId and record the switch for audit.
    if (["employee", "admin", "client"].includes(profile.role)) {
      const url = new URL(request.url);
      const activeClientId = url.searchParams.get("clientId");

      if (activeClientId) {
        try {
          const clientAccess = await prisma.wehowareUserClient.findFirst({
            where: {
              userId: profile.id,
              clientId: activeClientId,
            },
            select: { clientId: true },
          });

          if (clientAccess) {
            // Fire-and-forget audit insert; don't block the request on it
            prisma.wehowareClientSwitchHistory
              .create({
                data: {
                  userId: profile.id,
                  clientId: activeClientId,
                  ipAddress:
                    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
                    "unknown",
                  userAgent:
                    request.headers.get("user-agent") ?? "unknown",
                },
              })
              .catch((err) => {
                console.warn("[withAuth] Failed to write switch history:", err);
              });

            request.user.activeClientId = activeClientId;
          }
        } catch (err) {
          // Non-fatal — log and continue; the switch just won't register
          console.warn("[withAuth] Client access check error:", err);
        }
      }
    }

    // --- Transitional: attach Supabase service-role client ---
    // Allows routes not yet migrated to Prisma to continue working.
    // The service role key bypasses RLS (already disabled on all tables).
    request.supabase = supabaseAdmin;

    // Attach Prisma client for migrated routes
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
