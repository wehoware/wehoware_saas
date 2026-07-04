/**
 * /api/v1/seo/llm-providers
 *
 * GET    — List all LLM providers with status, config, and usage stats
 * PUT    — Save encrypted API keys for providers
 * PATCH  — Update LLM settings (mode, manualProvider, autoFailover)
 *
 * All routes are client-scoped via withAuth + resolveClientId.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";
import {
  getProvidersForClient,
  getLlmSettings,
  updateLlmSettings,
  updateProviderModels,
  saveApiKeys,
  getKeyStatus,
} from "@/lib/llm-providers/index.js";

function resolveClientId(user) {
  if (user.role === "client") return user.clientId ?? null;
  if (["employee", "admin"].includes(user.role)) {
    return user.activeClientId ?? null;
  }
  return null;
}

// -------------------------------------------------------------------
// GET — List providers + settings
// -------------------------------------------------------------------
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

      const providers = await getProvidersForClient(clientId);
      const settings = await getLlmSettings(clientId);
      const keyStatus = await getKeyStatus(clientId);

      const providersWithKeyStatus = providers.map((p) => ({
        ...p,
        isConfigured: keyStatus[p.providerName] ?? false,
      }));

      return NextResponse.json({
        data: providersWithKeyStatus,
        settings,
      });
    } catch (err) {
      console.error("[seo/llm-providers GET]", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PUT — Save API keys (encrypted)
// -------------------------------------------------------------------
export const PUT = withAuth(
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

      const body = await request.json();
      const { keys } = body;

      if (!keys || typeof keys !== "object") {
        return NextResponse.json(
          { error: "Request body must include 'keys' object" },
          { status: 400 }
        );
      }

      // Validate provider names
      const validProviders = new Set(["openrouter"]);
      const filteredKeys = {};
      for (const [name, value] of Object.entries(keys)) {
        if (validProviders.has(name)) {
          if (typeof value === "string" && value.length > 0) {
            filteredKeys[name] = value;
          } else if (value === null || value === "") {
            filteredKeys[name] = null;
          }
        }
      }

      await saveApiKeys(clientId, filteredKeys);

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[seo/llm-providers PUT]", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);

// -------------------------------------------------------------------
// PATCH — Update LLM settings (mode, manualProvider, autoFailover)
// -------------------------------------------------------------------
export const PATCH = withAuth(
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

      const body = await request.json();
      const { providerMode, manualProvider, autoFailover, analysisModel, suggestionModel, providerName } = body;

      // Handle model selection updates separately
      if (analysisModel !== undefined || suggestionModel !== undefined) {
        if (!providerName) {
          return NextResponse.json(
            { error: "providerName is required to update models" },
            { status: 400 }
          );
        }
        const validProviders = new Set(["openrouter"]);
        if (!validProviders.has(providerName)) {
          return NextResponse.json(
            { error: `Unknown provider: ${providerName}` },
            { status: 400 }
          );
        }

        // "__reset__" sentinel means clear the override
        const resolvedAnalysis = analysisModel === "__reset__" ? null : analysisModel;
        const resolvedSuggestion = suggestionModel === "__reset__" ? null : suggestionModel;

        await updateProviderModels(clientId, providerName, resolvedAnalysis, resolvedSuggestion);

        return NextResponse.json({ success: true });
      }

      const updates = {};
      if (providerMode !== undefined) {
        if (!["auto", "manual"].includes(providerMode)) {
          return NextResponse.json(
            { error: "providerMode must be 'auto' or 'manual'" },
            { status: 400 }
          );
        }
        updates.providerMode = providerMode;
      }
      if (manualProvider !== undefined) {
        updates.manualProvider = manualProvider || null;
      }
      if (autoFailover !== undefined) {
        updates.autoFailover = Boolean(autoFailover);
      }

      const updated = await updateLlmSettings(clientId, updates);

      return NextResponse.json({ success: true, settings: updated });
    } catch (err) {
      console.error("[seo/llm-providers PATCH]", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["client", "employee", "admin"] }
);
