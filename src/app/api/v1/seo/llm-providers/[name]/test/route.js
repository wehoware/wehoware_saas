/**
 * /api/v1/seo/llm-providers/[name]/test
 *
 * POST — Test connectivity to a specific provider by making a simple API call.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";
import { testProvider } from "@/lib/llm-providers/index.js";

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
      const validProviders = new Set(["openrouter", "wehoware"]);

      if (!validProviders.has(name)) {
        return NextResponse.json(
          { error: `Unknown provider: ${name}` },
          { status: 400 }
        );
      }

      const result = await testProvider(clientId, name);

      return NextResponse.json(result);
    } catch (err) {
      console.error("[seo/llm-providers/[name]/test POST]", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
