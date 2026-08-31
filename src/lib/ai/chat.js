// src/lib/ai/chat.js
// Main chat function for the Baddy AI assistant.
//
// Implements:
// - Streaming via async generator (SSE to browser)
// - Multi-turn tool calling (up to MAX_TOOL_ITERATIONS)
// - Dynamic tool selection (only relevant tools sent per request)
// - Prompt caching (byte-stable system prompt prefix)
// - Mem0 memory integration

import { prisma } from "@/lib/prisma";
import {
  VLLM_BASE_URL,
  VLLM_API_KEY,
  VLLM_MODEL,
  MAX_TOOL_ITERATIONS,
  searchMemories,
  storeConversationMemory,
  getRecentSessionContext,
  updateSessionSummary,
} from "./constants.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { getRelevantTools, getToolDefinitions, filterToolsByRole, TOOL_TO_CATEGORY } from "./tools/definitions.js";
import { executeToolCall } from "./tools/execution.js";

// Re-export for backward compatibility
export { buildSystemPrompt } from "./system-prompt.js";
export { getToolDefinitions } from "./tools/definitions.js";
export { executeToolCall } from "./tools/execution.js";
export { getRelevantTools } from "./tools/definitions.js";
export { filterToolsByRole } from "./tools/definitions.js";

/**
 * Main chat function — async generator that yields text chunks for streaming.
 *
 * ARCHITECTURE:
 * 1. Build system prompt (static cached prefix + dynamic context + memory)
 * 2. Select relevant tools based on the user's message (dynamic selection)
 * 3. Call vLLM with streaming + tool calling
 * 4. Execute tool calls in-process (scoped by clientId)
 * 5. Feed tool results back to the LLM for the next iteration
 * 6. Yield text chunks to the browser via SSE
 *
 * PROMPT CACHING:
 * The system prompt is split into a static BASE_PROMPT (cached by vLLM) and
 * dynamic context (client/user/memory). The base prompt is byte-stable across
 * turns, so vLLM's prefix cache hits on every turn after the first.
 *
 * DYNAMIC TOOL SELECTION:
 * Instead of sending all 89 tools on every request, only the 15-25 tools
 * relevant to the user's message are sent. This reduces token overhead and
 * improves Qwen's tool-calling accuracy (smaller tool surface = fewer
 * selection errors).
 *
 * @param {object} params - { systemPrompt, messages, clientId, userId, enableThinking, userRole, clientRole, sessionId }
 * @yields {string} - text chunks of the assistant response
 */
export async function* chatWithBaddy({ systemPrompt, messages, clientId, userId, enableThinking, userRole, clientRole, sessionId }) {
  if (!clientId) {
    yield "I don't have an active client context. Please select a client workspace first, then I can help you manage their data.";
    return;
  }

  // ─── Build system prompt with memory ──────────────────────────────
  // The systemPrompt passed in is already built by the route handler.
  // We append two types of dynamic memory context AFTER the static
  // base prompt so the cached prefix remains valid:
  //   1. Mem0: semantic long-term memory (user preferences, past interactions)
  //   2. DB session context: summaries of recent conversations for continuity
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";
  const [memoryContext, sessionContext] = await Promise.all([
    searchMemories(userId, clientId, lastUserMsg),
    getRecentSessionContext(userId, clientId, sessionId),
  ]);
  const fullSystemPrompt = systemPrompt + sessionContext + memoryContext;

  // ─── Dynamic tool selection with role-based filtering ─────────────
  // Select only the tools relevant to the user's message, then filter
  // by the user's role so viewers get read-only, editors get content,
  // and managers/clients get everything except user management.
  const roleContext = { userRole, clientRole };
  const relevantTools = getRelevantTools(lastUserMsg, 25, roleContext);
  const allFilteredTools = filterToolsByRole(getToolDefinitions(), userRole, clientRole);
  console.log(`[baddy] Selected ${relevantTools.length}/${allFilteredTools.length} tools (role: ${userRole}/${clientRole || "N/A"}) for message: "${lastUserMsg.slice(0, 80)}"`);

  // ─── Prepare messages for the LLM ─────────────────────────────────
  const llmMessages = [
    { role: "system", content: fullSystemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  // ─── Multi-turn tool calling loop ─────────────────────────────────
  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    // On subsequent iterations (after tool results), we may need to expand
    // the tool set if the model is trying to call a tool that wasn't included
    // But still respect role-based filtering
    const toolsForThisIteration = iteration === 0
      ? relevantTools
      : allFilteredTools; // After first iteration, send all role-allowed tools

    // Call vLLM with streaming
    const response = await fetch(`${VLLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${VLLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: llmMessages,
        tools: toolsForThisIteration,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      console.error("[baddy] vLLM error:", response.status, errText);
      yield `I encountered an error connecting to the AI model (HTTP ${response.status}). Please try again in a moment.`;
      return;
    }

    // ─── Parse SSE stream from vLLM ───────────────────────────────
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    let toolCalls = [];
    let finishReason = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) {
            fullContent += delta.content;
            yield delta.content;
          }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index || 0;
              if (!toolCalls[idx]) {
                toolCalls[idx] = { id: tc.id, function: { name: "", arguments: "" } };
              }
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
            }
          }
          if (parsed.choices?.[0]?.finish_reason) {
            finishReason = parsed.choices[0].finish_reason;
          }
        } catch (e) {
          // Skip unparseable chunks
        }
      }
    }

    // ─── Build assistant message for next iteration ────────────────
    const assistantMessage = { role: "assistant", content: fullContent || null };
    if (toolCalls.length > 0) {
      assistantMessage.tool_calls = toolCalls.filter(Boolean).map(tc => ({
        id: tc.id,
        type: "function",
        function: tc.function,
      }));
    }
    llmMessages.push(assistantMessage);

    // ─── Execute tool calls ────────────────────────────────────────
    if (toolCalls.length > 0 && toolCalls.some(tc => tc?.function?.name)) {
      for (const toolCall of toolCalls.filter(Boolean)) {
        if (!toolCall?.function?.name) continue;
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch (e) {
          console.error("[baddy] Failed to parse tool args:", toolCall.function.arguments);
        }

        // Execute the tool (scoped by clientId — strict isolation)
        const result = await executeToolCall(toolName, toolArgs, clientId, userId);

        // Add tool result to conversation
        llmMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
      // Continue to next iteration — LLM will process tool results
      continue;
    }

    // ─── No tool calls — final response ────────────────────────────
    // Store conversation in Mem0 (async, non-blocking) for long-term memory
    storeConversationMemory(userId, clientId, lastUserMsg, fullContent);
    // Update session summary for conversation continuity (async, non-blocking)
    if (sessionId) {
      updateSessionSummary(sessionId, lastUserMsg, fullContent);
    }
    return;
  }

  // Exceeded max iterations
  yield "\n\n*I've reached the maximum number of tool calls for this request. Here's what I've gathered so far — please ask me a more specific question if you need further details.*";
}
