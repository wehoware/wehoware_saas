/**
 * Wehoware Private AI provider configuration.
 *
 * Private OpenAI-compatible server running at ai.wehoware.ca.
 * Models include qwen2.5:3b and other Ollama-hosted models.
 */

import { createProvider } from "./base.js";

const wehowarePrivateConfig = {
  name: "wehoware",
  displayName: "Wehoware Private AI",
  baseUrl: "https://ai.wehoware.ca/v1",
  apiKeyEnv: "WEHOWARE_AI_API_KEY",
  analysisModel: "qwen2.5:3b",
  suggestionModel: "qwen2.5:3b",
  maxTokens: 4096,
  freeQuota: null,
  signupUrl: null,
};

export const wehowarePrivate = createProvider(wehowarePrivateConfig);

export default wehowarePrivate;
