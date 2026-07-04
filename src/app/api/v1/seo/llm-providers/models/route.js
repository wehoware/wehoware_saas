/**
 * /api/v1/seo/llm-providers/models
 *
 * GET — Fetch available models from OpenRouter's public API.
 *       Cached in-memory for 10 minutes. Supports ?filter=free|all.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 10 * 60 * 1000;
const RESET_TO_DEFAULT_VALUE = "__reset__";

let cachedModels = null;
let cachedAt = 0;

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

/**
 * Fetch models from OpenRouter and normalize the response.
 * @returns {Promise<Array<{id: string, name: string, contextLength: number, isFree: boolean, pricing: Object}>>}
 */
async function fetchOpenRouterModels() {
  const res = await fetch(OPENROUTER_MODELS_URL, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter models API returned ${res.status}`);
  }

  const json = await res.json();
  const models = (json.data || []).map((m) => ({
    id: m.id,
    name: m.name || m.id,
    contextLength: m.context_length || 0,
    isFree:
      (m.pricing?.prompt === "0" && m.pricing?.completion === "0") ||
      m.id.endsWith(":free"),
    pricing: m.pricing || {},
  }));

  models.sort((a, b) => {
    if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return models;
}

export const GET = withAuth(
  async (request) => {
    try {
      const { user } = request;
      const clientId = resolveClientId(user);

      if (!clientId) {
        return NextResponse.json(
          { error: "No active client context" },
          { status: 400 }
        );
      }

      const url = new URL(request.url);
      const filter = url.searchParams.get("filter") || "free";

      // Return cached data if fresh
      if (cachedModels && Date.now() - cachedAt < CACHE_TTL_MS) {
        const filtered = filter === "all"
          ? cachedModels
          : cachedModels.filter((m) => m.isFree);
        return NextResponse.json({
          data: filtered,
          cached: true,
          resetValue: RESET_TO_DEFAULT_VALUE,
        });
      }

      const models = await fetchOpenRouterModels();
      cachedModels = models;
      cachedAt = Date.now();

      const filtered = filter === "all"
        ? models
        : models.filter((m) => m.isFree);

      return NextResponse.json({
        data: filtered,
        cached: false,
        resetValue: RESET_TO_DEFAULT_VALUE,
      });
    } catch (err) {
      console.error("[llm-providers/models] Fetch failed:", err);
      // Return cached data if available, even if stale
      if (cachedModels) {
        const url = new URL(request.url);
        const filter = url.searchParams.get("filter") || "free";
        const filtered = filter === "all"
          ? cachedModels
          : cachedModels.filter((m) => m.isFree);
        return NextResponse.json({
          data: filtered,
          cached: true,
          stale: true,
          resetValue: RESET_TO_DEFAULT_VALUE,
        });
      }
      return NextResponse.json(
        { error: "Failed to fetch models from OpenRouter" },
        { status: 502 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

