/**
 * /api/v1/seo/llm-providers/[name]/toggle
 *
 * POST — Toggle a provider's enabled state.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";
import { toggleProvider } from "@/lib/llm-providers/index.js";

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

      const updated = await toggleProvider(clientId, name);

      return NextResponse.json({
        success: true,
        isEnabled: updated.isEnabled,
      });
    } catch (err) {
      console.error("[seo/llm-providers/[name]/toggle POST]", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
