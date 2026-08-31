// src/lib/ai/baddy-assistant.js
// Baddy AI assistant integration for the WeHowAre SaaS.
//
// This file is now a thin re-export wrapper for backward compatibility.
// The implementation has been split into modular files:
//
//   constants.js      — vLLM/Mem0 config, memory helpers
//   system-prompt.js  — buildSystemPrompt (with prompt caching support)
//   tools/definitions.js — 89 tool definitions + dynamic tool selection
//   tools/execution.js   — executeToolCall (strict client isolation)
//   chat.js           — chatWithBaddy (streaming, multi-turn tool calling)
//
// SECURITY: This module enforces strict client isolation. The AI assistant
// can ONLY access data for the user's activeClientId. All tool calls are
// executed server-side with the user's clientId — the LLM never sees
// raw database access, only the results of scoped queries.
//
// CRITICAL RULE: NEVER delete data. The tool set exposed to the LLM
// contains read (GET), create (POST), and update (PATCH/PUT) operations.
// No DELETE or destructive operations are available.

export { buildSystemPrompt, getBasePrompt } from "./system-prompt.js";
export { getToolDefinitions, getRelevantTools, getToolsByCategory, filterToolsByRole, ALL_TOOLS, TOOL_CATEGORIES, ROLE_TOOL_CATEGORIES } from "./tools/definitions.js";
export { executeToolCall } from "./tools/execution.js";
export { chatWithBaddy } from "./chat.js";
export { searchMemories, storeConversationMemory, getRecentSessionContext, updateSessionSummary } from "./constants.js";
