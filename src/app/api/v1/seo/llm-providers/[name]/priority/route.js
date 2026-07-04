/**
 * /api/v1/seo/llm-providers/[name]/priority
 *
 * POST — Set priority order for a provider.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";
import { setProviderPriority } from "@/lib/llm-providers/index.js";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

export const POST = withAuth(
  async (request, context) => {
    try {
      const { user } = request;
      const clientId = resolveClientId(user);

      if (!clientId) {
        return NextResponse.json(
          { error: "No active client context" },
          { status: 400 }
        );
      }

      const { name } = await context.params;
      const validProviders = new Set(["openrouter"]);

      if (!validProviders.has(name)) {
        return NextResponse.json(
          { error: `Unknown provider: ${name}` },
          { status: 400 }
        );
      }

      const body = await request.json();
      const { priority } = body;

      if (typeof priority !== "number" || priority < 1) {
        return NextResponse.json(
          { error: "priority must be a positive number" },
          { status: 400 }
        );
      }

      await setProviderPriority(clientId, name, priority);

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[seo/llm-providers/[name]/priority POST]", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
