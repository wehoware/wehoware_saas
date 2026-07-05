/**
 * LLM provider registry and router.
 *
 * This is the single entry point for all LLM calls from the SEO analyser
 * pipeline. It manages provider selection, failover, and health tracking.
 *
 * Currently supports: OpenRouter
 * Architecture is extensible — add new providers by importing their modules
 * and adding them to the PROVIDER_REGISTRY.
 */

import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { isAvailable, resetProvider } from "./health.js";
import { AllProvidersExhaustedError } from "./base.js";
import openrouter from "./openrouter.js";

/**
 * Registry of all available provider modules.
 * Key = provider name, Value = provider module from createProvider()
 */
const PROVIDER_REGISTRY = {
  openrouter,
};

/**
 * Default provider order (by priority).
 * When a client has no DB-configured priorities, this order is used.
 */
const DEFAULT_PRIORITY = ["openrouter"];

/**
 * Ensure all provider rows exist for a client in the database.
 * Seeds rows with default priorities if they don't exist yet.
 *
 * @param {string} clientId
 * @returns {Promise<void>}
 */
export async function ensureProvidersSeeded(clientId) {
  if (!clientId) return;

  const existing = await prisma.wehowareSeoLlmProvider.findMany({
    where: { clientId },
    select: { providerName: true },
  });

  const existingNames = new Set(existing.map((r) => r.providerName));
  const toCreate = [];

  DEFAULT_PRIORITY.forEach((name, idx) => {
    if (!existingNames.has(name)) {
      toCreate.push({
        clientId,
        providerName: name,
        priority: idx + 1,
        isEnabled: true,
        isActive: idx === 0,
      });
    }
  });

  if (toCreate.length > 0) {
    await prisma.wehowareSeoLlmProvider.createMany({ data: toCreate });
  }
}

/**
 * Get all providers with their DB state and config for a client.
 *
 * @param {string} clientId
 * @returns {Promise<Array>} Array of provider objects with merged DB + config data
 */
export async function getProvidersForClient(clientId) {
  await ensureProvidersSeeded(clientId);

  const dbProviders = await prisma.wehowareSeoLlmProvider.findMany({
    where: { clientId },
    orderBy: { priority: "asc" },
  });

  return dbProviders.map((db) => {
    const providerModule = PROVIDER_REGISTRY[db.providerName];
    if (!providerModule) return null;

    const isConfigured = providerModule.isConfigured(db.apiKeyEncrypted ? decryptSecret(db.apiKeyEncrypted) : null);

    const envAnalysisModel = process.env.OPENROUTER_DEFAULT_ANALYSIS_MODEL || null;
    const envSuggestionModel = process.env.OPENROUTER_DEFAULT_SUGGESTION_MODEL || null;

    const analysisModel =
      db.analysisModel ||
      envAnalysisModel ||
      providerModule.config.analysisModel;
    const suggestionModel =
      db.suggestionModel ||
      envSuggestionModel ||
      providerModule.config.suggestionModel;

    return {
      id: db.id,
      providerName: db.providerName,
      displayName: providerModule.displayName,
      priority: db.priority,
      isEnabled: db.isEnabled,
      isActive: db.isActive,
      healthStatus: db.healthStatus,
      isConfigured,
      totalRequests: db.totalRequests,
      totalTokensUsed: db.totalTokensUsed,
      lastUsedAt: db.lastUsedAt,
      lastErrorAt: db.lastErrorAt,
      lastErrorMessage: db.lastErrorMessage,
      rateLimitResetAt: db.rateLimitResetAt,
      circuitOpenUntil: db.circuitOpenUntil,
      models: {
        analysis: analysisModel,
        suggestion: suggestionModel,
      },
      modelOverrides: {
        analysis: db.analysisModel,
        suggestion: db.suggestionModel,
      },
      envDefaults: {
        analysis: envAnalysisModel,
        suggestion: envSuggestionModel,
      },
      configDefaults: {
        analysis: providerModule.config.analysisModel,
        suggestion: providerModule.config.suggestionModel,
      },
      freeQuota: providerModule.config.freeQuota,
      signupUrl: providerModule.config.signupUrl,
    };
  }).filter(Boolean);
}

/**
 * Get LLM settings for a client, creating defaults if not present.
 *
 * @param {string} clientId
 * @returns {Promise<Object>}
 */
export async function getLlmSettings(clientId) {
  if (!clientId) {
    return {
      providerMode: process.env.SEO_LLM_PROVIDER_MODE || "auto",
      manualProvider: process.env.SEO_LLM_MANUAL_PROVIDER || null,
      autoFailover: process.env.SEO_LLM_AUTO_FAILOVER !== "false",
      timeoutMs: Number.parseInt(process.env.SEO_LLM_TIMEOUT_MS, 10) || 30000,
    };
  }

  let settings = await prisma.wehowareSeoLlmSetting.findUnique({
    where: { clientId },
  });

  if (!settings) {
    settings = await prisma.wehowareSeoLlmSetting.create({
      data: { clientId },
    });
  }

  const envTimeout = Number.parseInt(process.env.SEO_LLM_TIMEOUT_MS, 10) || 120000;

  return {
    providerMode: settings.providerMode,
    manualProvider: settings.manualProvider,
    autoFailover: settings.autoFailover,
    timeoutMs: settings.timeoutMs >= 30000 ? settings.timeoutMs : envTimeout,
  };
}

/**
 * Update LLM settings for a client.
 *
 * @param {string} clientId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateLlmSettings(clientId, updates) {
  const data = {};
  if (updates.providerMode !== undefined) data.providerMode = updates.providerMode;
  if (updates.manualProvider !== undefined) data.manualProvider = updates.manualProvider;
  if (updates.autoFailover !== undefined) data.autoFailover = updates.autoFailover;

  return prisma.wehowareSeoLlmSetting.upsert({
    where: { clientId },
    create: { clientId, ...data },
    update: data,
  });
}

/**
 * Save encrypted API keys for providers.
 *
 * @param {string} clientId
 * @param {Object} keys - { providerName: apiKey }
 * @returns {Promise<void>}
 */
export async function saveApiKeys(clientId, keys) {
  for (const [providerName, apiKey] of Object.entries(keys)) {
    if (!PROVIDER_REGISTRY[providerName]) continue;

    const encrypted = apiKey ? encryptSecret(apiKey) : null;

    await prisma.wehowareSeoLlmProvider.update({
      where: {
        clientId_providerName: { clientId, providerName },
      },
      data: { apiKeyEncrypted: encrypted },
    });
  }
}

/**
 * Get the decrypted API key for a provider (DB first, env fallback).
 *
 * @param {string} clientId
 * @param {string} providerName
 * @returns {Promise<string|null>}
 */
export async function getApiKey(clientId, providerName) {
  const dbProvider = await prisma.wehowareSeoLlmProvider.findUnique({
    where: { clientId_providerName: { clientId, providerName } },
    select: { apiKeyEncrypted: true },
  });

  const decrypted = dbProvider?.apiKeyEncrypted ? decryptSecret(dbProvider.apiKeyEncrypted) : null;
  return PROVIDER_REGISTRY[providerName]?.resolveApiKey(decrypted) || null;
}

/**
 * Get key status (configured/not) without exposing key values.
 *
 * @param {string} clientId
 * @returns {Promise<Object>} { providerName: boolean }
 */
export async function getKeyStatus(clientId) {
  const providers = await prisma.wehowareSeoLlmProvider.findMany({
    where: { clientId },
    select: { providerName: true, apiKeyEncrypted: true },
  });

  const status = {};
  for (const p of providers) {
    if (!PROVIDER_REGISTRY[p.providerName]) continue;
    const decrypted = p.apiKeyEncrypted ? decryptSecret(p.apiKeyEncrypted) : null;
    status[p.providerName] = PROVIDER_REGISTRY[p.providerName].isConfigured(decrypted);
  }
  return status;
}

/**
 * Test a specific provider by making a simple API call.
 *
 * @param {string} clientId
 * @param {string} providerName
 * @returns {Promise<{ success: boolean, model: string, latencyMs: number, error?: string }>}
 */
export async function testProvider(clientId, providerName) {
  const providerModule = PROVIDER_REGISTRY[providerName];
  if (!providerModule) {
    return { success: false, model: "", latencyMs: 0, error: `Unknown provider: ${providerName}` };
  }

  const apiKey = await getApiKey(clientId, providerName);
  if (!apiKey) {
    return { success: false, model: providerModule.config.analysisModel, latencyMs: 0, error: "No API key configured" };
  }

  const result = await providerModule.test(apiKey);

  // Update DB health status
  await prisma.wehowareSeoLlmProvider.update({
    where: { clientId_providerName: { clientId, providerName } },
    data: {
      healthStatus: result.success ? "healthy" : "error",
      lastErrorAt: result.success ? null : new Date(),
      lastErrorMessage: result.success ? null : result.error,
    },
  });

  return result;
}

/**
 * Toggle a provider's enabled state.
 *
 * @param {string} clientId
 * @param {string} providerName
 * @returns {Promise<Object>}
 */
export async function toggleProvider(clientId, providerName) {
  const current = await prisma.wehowareSeoLlmProvider.findUnique({
    where: { clientId_providerName: { clientId, providerName } },
    select: { isEnabled: true },
  });

  if (!current) {
    throw new Error(`Provider ${providerName} not found for client`);
  }

  return prisma.wehowareSeoLlmProvider.update({
    where: { clientId_providerName: { clientId, providerName } },
    data: { isEnabled: !current.isEnabled },
  });
}

/**
 * Set priority for a provider and renumber others to avoid conflicts.
 *
 * @param {string} clientId
 * @param {string} providerName
 * @param {number} priority
 * @returns {Promise<void>}
 */
export async function setProviderPriority(clientId, providerName, priority) {
  const all = await prisma.wehowareSeoLlmProvider.findMany({
    where: { clientId },
    orderBy: { priority: "asc" },
  });

  // Remove target from list, insert at new position
  const without = all.filter((p) => p.providerName !== providerName);
  without.sort((a, b) => a.priority - b.priority);
  without.splice(priority - 1, 0, all.find((p) => p.providerName === providerName));

  // Renumber
  for (let i = 0; i < without.length; i++) {
    await prisma.wehowareSeoLlmProvider.update({
      where: { id: without[i].id },
      data: { priority: i + 1 },
    });
  }
}

/**
 * Reset a provider's health state (circuit breaker + rate limit).
 *
 * @param {string} clientId
 * @param {string} providerName
 * @returns {Promise<void>}
 */
export async function resetProviderHealth(clientId, providerName) {
  resetProvider(providerName);

  await prisma.wehowareSeoLlmProvider.update({
    where: { clientId_providerName: { clientId, providerName } },
    data: {
      healthStatus: "unknown",
      rateLimitResetAt: null,
      circuitOpenUntil: null,
      lastErrorAt: null,
      lastErrorMessage: null,
    },
  });
}

/**
 * Update model selections for a specific provider.
 * Pass null to clear the override and revert to system defaults.
 *
 * @param {string} clientId
 * @param {string} providerName
 * @param {string|null} analysisModel
 * @param {string|null} suggestionModel
 * @returns {Promise<Object>}
 */
export async function updateProviderModels(clientId, providerName, analysisModel, suggestionModel) {
  const data = {};
  if (analysisModel !== undefined) {
    data.analysisModel = analysisModel || null;
  }
  if (suggestionModel !== undefined) {
    data.suggestionModel = suggestionModel || null;
  }

  return prisma.wehowareSeoLlmProvider.update({
    where: { clientId_providerName: { clientId, providerName } },
    data,
  });
}

/**
 * The main entry point — call the LLM with automatic failover.
 *
 * Iterates through providers in priority order, skipping disabled,
 * circuit-broken, or rate-limited providers. On failure, moves to
 * the next provider. Throws AllProvidersExhaustedError if all fail.
 *
 * @param {string} clientId
 * @param {Object} params
 * @param {string} params.prompt - User prompt
 * @param {string} [params.systemPrompt] - System prompt
 * @param {string} [params.model] - Override model name
 * @param {string} [params.callType] - "analysis" or "suggestion" (selects model)
 * @returns {Promise<{ content: string, tokensUsed: number, model: string, provider: string }>}
 */
export async function callLLM(clientId, { prompt, systemPrompt, model, callType = "analysis" }) {
  await ensureProvidersSeeded(clientId);
  const settings = await getLlmSettings(clientId);
  const dbProviders = await prisma.wehowareSeoLlmProvider.findMany({
    where: {
      clientId,
      isEnabled: true,
    },
    orderBy: { priority: "asc" },
  });

  // Determine provider order
  let providerOrder;
  if (settings.providerMode === "manual" && settings.manualProvider) {
    providerOrder = dbProviders.filter((p) => p.providerName === settings.manualProvider);
    if (settings.autoFailover) {
      providerOrder = providerOrder.concat(
        dbProviders.filter((p) => p.providerName !== settings.manualProvider)
      );
    }
  } else {
    providerOrder = dbProviders;
  }

  const errors = [];

  for (const dbProvider of providerOrder) {
    const providerModule = PROVIDER_REGISTRY[dbProvider.providerName];
    if (!providerModule) continue;

    // Skip if not available (circuit broken or rate limited)
    if (!isAvailable(dbProvider.providerName)) {
      continue;
    }

    // Get API key
    const apiKey = await getApiKey(clientId, dbProvider.providerName);
    if (!apiKey) {
      errors.push({ provider: dbProvider.providerName, error: "No API key configured" });
      continue;
    }

    // Select model based on call type — 3-tier resolution: DB → env → config
    let useModel = model;
    if (!useModel) {
      if (callType === "suggestion") {
        useModel =
          dbProvider.suggestionModel ||
          process.env.OPENROUTER_DEFAULT_SUGGESTION_MODEL ||
          providerModule.config.suggestionModel ||
          providerModule.config.analysisModel;
      } else {
        useModel =
          dbProvider.analysisModel ||
          process.env.OPENROUTER_DEFAULT_ANALYSIS_MODEL ||
          providerModule.config.analysisModel;
      }
    }

    try {
      const result = await providerModule.call({
        apiKey,
        prompt,
        systemPrompt,
        model: useModel,
        timeoutMs: settings.timeoutMs || 30000,
      });

      // Update DB usage stats
      await prisma.wehowareSeoLlmProvider.update({
        where: { id: dbProvider.id },
        data: {
          totalRequests: { increment: 1 },
          totalTokensUsed: { increment: result.tokensUsed },
          lastUsedAt: new Date(),
          healthStatus: "healthy",
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });

      return {
        content: result.content,
        tokensUsed: result.tokensUsed,
        model: result.model,
        provider: dbProvider.providerName,
      };
    } catch (err) {
      const classification = providerModule.classifyError(err);
      errors.push({
        provider: dbProvider.providerName,
        error: err.message,
        type: classification.type,
      });

      // Update DB error state
      await prisma.wehowareSeoLlmProvider.update({
        where: { id: dbProvider.id },
        data: {
          healthStatus: classification.type === "rate_limited" ? "rate_limited" : "error",
          lastErrorAt: new Date(),
          lastErrorMessage: err.message?.substring(0, 500) || "Unknown error",
          rateLimitResetAt: classification.type === "rate_limited"
            ? new Date(Date.now() + (classification.retryAfterMs || 3600000))
            : dbProvider.rateLimitResetAt,
        },
      });

      // If auto-failover is disabled, stop here
      if (settings.providerMode === "manual" && !settings.autoFailover) {
        break;
      }

      continue;
    }
  }

  throw new AllProvidersExhaustedError(
    `All LLM providers exhausted. Errors: ${JSON.stringify(errors)}`
  );
}
