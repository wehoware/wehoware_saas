/**
 * OpenRouter provider configuration.
 *
 * OpenRouter provides access to multiple models through a single OpenAI-compatible API.
 * Free models available include Llama, Kimi K2.6, and others.
 *
 * Free tier limits (OpenRouter free models):
 *   - 20 requests/minute
 *   - 50 requests/day (free models)
 *   - 1000 requests/day (with credits)
 *
 * Get an API key at: https://openrouter.ai/keys
 */

import { createProvider } from "./base.js";

const openrouterConfig = {
  name: "openrouter",
  displayName: "OpenRouter",
  baseUrl: "https://openrouter.ai/api/v1",
  apiKeyEnv: "OPENROUTER_API_KEY",
  analysisModel: "openai/gpt-oss-120b:free",
  suggestionModel: "qwen/qwen3-next-80b-a3b-instruct:free",
  maxTokens: 16000,
  freeQuota: { rpm: 20, rpd: 50, tpm: 10000 },
  signupUrl: "https://openrouter.ai/keys",
};

export const openrouter = createProvider(openrouterConfig);

export default openrouter;
