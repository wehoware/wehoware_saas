/**
 * Base provider factory — creates a provider module from a config object.
 *
 * All providers share identical logic via this factory. Only the config
 * (baseUrl, model names, rate limits, env var names) differs per provider.
 *
 * Uses the `openai` npm package which is OpenAI-API-compatible across
 * all supported providers by changing baseURL and apiKey.
 */

import OpenAI from "openai";
import { recordSuccess, recordFailure, markRateLimited } from "./health.js";

/**
 * Error class for rate-limit (429) responses.
 */
export class RateLimitError extends Error {
  constructor(message, retryAfterMs) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs || 3600000;
  }
}

/**
 * Error class for server errors (500/502/503).
 */
export class ProviderServerError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "ProviderServerError";
    this.statusCode = statusCode;
  }
}

/**
 * Error class for all providers exhausted.
 */
export class AllProvidersExhaustedError extends Error {
  constructor(message) {
    super(message);
    this.name = "AllProvidersExhaustedError";
  }
}

/**
 * Create a provider module from a config object.
 *
 * @param {Object} config
 * @param {string} config.name - Provider identifier (e.g. "openrouter")
 * @param {string} config.displayName - Human-readable name
 * @param {string} config.baseUrl - OpenAI-compatible API base URL
 * @param {string} config.apiKeyEnv - Environment variable name for API key fallback
 * @param {string} config.analysisModel - Model for analysis calls
 * @param {string} config.suggestionModel - Model for suggestion calls
 * @param {number} config.maxTokens - Max tokens per request
 * @param {Object} config.freeQuota - Free tier rate limits { rpm, rpd, tpm }
 * @param {string} config.signupUrl - URL to get an API key
 * @returns {Object} Provider module
 */
export function createProvider(config) {
  const {
    name,
    displayName,
    baseUrl,
    apiKeyEnv,
    analysisModel,
    maxTokens,
  } = config;

  return {
    name,
    displayName,
    config,

    /**
     * Resolve the API key — uses decrypted DB key or env var fallback.
     * @param {string|null} decryptedDbKey
     * @returns {string|null}
     */
    resolveApiKey(decryptedDbKey) {
      if (decryptedDbKey) return decryptedDbKey;
      return process.env[apiKeyEnv] || null;
    },

    /**
     * Check if the provider is configured (has an API key).
     * @param {string|null} decryptedDbKey
     * @returns {boolean}
     */
    isConfigured(decryptedDbKey) {
      return Boolean(this.resolveApiKey(decryptedDbKey));
    },

    /**
     * Create an OpenAI client instance for this provider.
     * @param {string} apiKey
     * @param {number} timeoutMs
     * @returns {OpenAI}
     */
    createClient(apiKey, timeoutMs) {
      return new OpenAI({
        baseURL: baseUrl,
        apiKey,
        timeout: timeoutMs || 30000,
        maxRetries: 0,
      });
    },

    /**
     * Make an LLM call using the OpenAI-compatible API.
     *
     * @param {Object} params
     * @param {string} params.apiKey - Decrypted API key
     * @param {string} params.prompt - User prompt
     * @param {string} [params.systemPrompt] - System prompt
     * @param {string} [params.model] - Override model (defaults to analysisModel)
     * @param {number} [params.timeoutMs] - Request timeout
     * @param {number} [params.maxTokensOverride] - Override max tokens
     * @returns {Promise<{ content: string, tokensUsed: number, model: string }>}
     */
    async call({ apiKey, prompt, systemPrompt, model, timeoutMs, maxTokensOverride }) {
      const useModel = model || analysisModel;
      const client = this.createClient(apiKey, timeoutMs);

      const messages = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const response = await client.chat.completions.create({
        model: useModel,
        messages,
        max_tokens: maxTokensOverride || maxTokens,
        temperature: 0.3,
      });

      const choice = response.choices?.[0];
      const content = choice?.message?.content || "";
      const tokensUsed = response.usage?.total_tokens || 0;
      const finishReason = choice?.finish_reason;

      recordSuccess(name);

      if (finishReason === "length") {
        throw new Error(
          `LLM response truncated (max_tokens=${maxTokensOverride || maxTokens} reached). The model needs more tokens to complete the JSON output.`
        );
      }

      return { content, tokensUsed, model: useModel };
    },

    /**
     * Make a simple test call to verify connectivity.
     *
     * @param {string} apiKey
     * @param {number} [timeoutMs]
     * @returns {Promise<{ success: boolean, model: string, latencyMs: number, error?: string }>}
     */
    async test(apiKey, timeoutMs) {
      const start = Date.now();
      try {
        const result = await this.call({
          apiKey,
          prompt: "Reply with exactly: OK",
          model: analysisModel,
          timeoutMs: timeoutMs || 15000,
          maxTokensOverride: 10,
        });
        return {
          success: true,
          model: result.model,
          latencyMs: Date.now() - start,
        };
      } catch (err) {
        return {
          success: false,
          model: analysisModel,
          latencyMs: Date.now() - start,
          error: err.message || "Unknown error",
        };
      }
    },

    /**
     * Classify an error from the OpenAI client and update health state.
     *
     * @param {Error} error
     * @returns {{ type: string, retryAfterMs?: number, shouldRetry: boolean }}
     */
    classifyError(error) {
      // OpenAI SDK attaches status to errors
      const status = error.status || error.statusCode;

      if (status === 429) {
        // Try to extract Retry-After from headers
        const retryAfterHeader = error.headers?.["retry-after"];
        let retryAfterMs = 300000; // Default 5 minutes (free models use per-minute limits)
        if (retryAfterHeader) {
          const seconds = Number.parseFloat(retryAfterHeader);
          if (!Number.isNaN(seconds)) {
            retryAfterMs = seconds * 1000;
          }
        }
        markRateLimited(name, retryAfterMs);
        const retryMin = Math.ceil(retryAfterMs / 60000);
        const rateLimitMsg = `Rate limited by ${displayName || name}: 429. Free tier limit reached. Retry in ~${retryMin} min. Check usage at ${config.signupUrl || "provider dashboard"}.`;
        error.message = rateLimitMsg;
        return { type: "rate_limited", retryAfterMs, shouldRetry: true };
      }

      if (status && status >= 500 && status < 600) {
        recordFailure(name);
        return { type: "server_error", shouldRetry: true };
      }

      if (error.code === "ETIMEDOUT" || error.code === "ESOCKETTIMEDOUT") {
        recordFailure(name);
        return { type: "timeout", shouldRetry: true };
      }

      // Unknown error — record failure but don't retry
      recordFailure(name);
      return { type: "error", shouldRetry: false };
    },
  };
}
