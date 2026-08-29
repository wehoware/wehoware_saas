// src/lib/ai/constants.js
// Shared constants and Mem0 memory helpers for the Baddy AI assistant.

// vLLM endpoint (running on the AI Brain)
export const VLLM_BASE_URL = process.env.VLLM_BASE_URL || "http://localhost:18020/v1";
export const VLLM_API_KEY = process.env.VLLM_API_KEY || "wehoware-vllm-2026";
export const VLLM_MODEL = process.env.VLLM_MODEL || "qwen3.8-27b";

// Mem0 memory bridge endpoint (running on the AI Brain)
export const MEM0_BRIDGE_URL = process.env.MEM0_BRIDGE_URL || "http://localhost:9097";

// Maximum tool-call iterations per user turn
export const MAX_TOOL_ITERATIONS = 10;

/**
 * Search Mem0 for relevant memories scoped to user + client.
 */
export async function searchMemories(userId, clientId, query) {
  try {
    const response = await fetch(`${MEM0_BRIDGE_URL}/memory/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, client_id: clientId, query, limit: 5 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return "";
    const data = await response.json();
    const memories = data.memories?.results || data.memories || [];
    if (!memories.length) return "";
    const memoryTexts = memories.map(m => m.memory || m.text || "").filter(Boolean);
    if (!memoryTexts.length) return "";
    return `\n\n## What you remember about this user:\n${memoryTexts.map(t => `- ${t}`).join("\n")}\n`;
  } catch (err) {
    console.error("[baddy] Memory search failed (non-fatal):", err.message);
    return "";
  }
}

/**
 * Store a conversation in Mem0 for future recall.
 */
export async function storeConversationMemory(userId, clientId, userMessage, assistantResponse) {
  try {
    await fetch(`${MEM0_BRIDGE_URL}/memory/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        client_id: clientId,
        messages: [
          { role: "user", content: userMessage },
          { role: "assistant", content: assistantResponse },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.error("[baddy] Memory store failed (non-fatal):", err.message);
  }
}
