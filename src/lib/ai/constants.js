// src/lib/ai/constants.js
// Shared constants and Mem0 memory helpers for the Baddy AI assistant.
//
// MEMORY ARCHITECTURE:
// - Mem0 (Qdrant-backed): Long-term per-user + per-client semantic memory.
//   Stores user preferences, past interactions, and important context.
//   Scoped by user_id + client_id — no cross-user or cross-client leakage.
// - DB session context: Recent session summaries from wehowareAgentSession.summary
//   provide conversation-level continuity without re-reading all messages.

import { prisma } from "@/lib/prisma";

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
 * Memory is isolated per user_id + client_id — no cross-user leakage.
 */
export async function searchMemories(userId, clientId, query) {
  try {
    const response = await fetch(`${MEM0_BRIDGE_URL}/memory/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, client_id: clientId, query, limit: 5 }),
      signal: AbortSignal.timeout(3000),
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
 * Scoped by user_id + client_id.
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
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("[baddy] Memory store failed (non-fatal):", err.message);
  }
}

/**
 * Get recent session context for the user + client.
 *
 * This provides conversation-level continuity by fetching summaries from
 * recent sessions. If a session has no summary, it falls back to the
 * session title and last few messages.
 *
 * This complements Mem0 (which provides semantic long-term memory) with
 * structured conversation history from the database.
 *
 * @param {string} userId - The authenticated user's ID
 * @param {string} clientId - The active client's ID
 * @param {string|null} currentSessionId - The current session ID (to exclude from history)
 * @returns {string} Session context text for the system prompt, or ""
 */
export async function getRecentSessionContext(userId, clientId, currentSessionId = null) {
  try {
    // Get the 3 most recent sessions (excluding the current one) that have summaries
    const sessions = await prisma.wehowareAgentSession.findMany({
      where: {
        userId,
        clientId,
        status: "active",
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
        summary: { not: null },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        summary: true,
        lastMessageAt: true,
      },
    });

    if (!sessions.length) return "";

    const sessionLines = sessions.map(s => {
      const date = s.lastMessageAt?.toLocaleDateString() || "recently";
      return `### ${s.title || "Untitled"} (${date})\n${s.summary}`;
    });

    return `\n\n## Recent Conversations:\nHere are summaries of your recent conversations with this user. Use this context to provide continuity:\n\n${sessionLines.join("\n\n")}\n`;
  } catch (err) {
    console.error("[baddy] Session context fetch failed (non-fatal):", err.message);
    return "";
  }
}

/**
 * Generate and store a session summary.
 *
 * This is called after each assistant response to maintain a rolling
 * summary of the conversation. It uses a simple extractive approach
 * (first user message + last assistant message) rather than calling
 * the LLM again, to avoid latency.
 *
 * For longer conversations, the summary is truncated to 500 chars.
 *
 * @param {string} sessionId - The session ID
 * @param {string} userMessage - The user's message
 * @param {string} assistantResponse - The assistant's response
 */
export async function updateSessionSummary(sessionId, userMessage, assistantResponse) {
  try {
    // Get the existing session to check if it has a summary
    const session = await prisma.wehowareAgentSession.findUnique({
      where: { id: sessionId },
      select: { summary: true, messageCount: true, title: true },
    });

    if (!session) return;

    // Build a rolling summary: keep the existing summary and append the latest exchange
    const latestExchange = `User: ${userMessage.slice(0, 200)}\nAssistant: ${assistantResponse.slice(0, 300)}`;

    let newSummary;
    if (session.summary) {
      // Append to existing summary, keeping it under 1000 chars
      newSummary = `${session.summary}\n\n${latestExchange}`;
      if (newSummary.length > 1000) {
        // Keep the most recent part — truncate from the beginning
        newSummary = "...\n" + newSummary.slice(-1000);
      }
    } else {
      newSummary = latestExchange;
    }

    await prisma.wehowareAgentSession.update({
      where: { id: sessionId },
      data: { summary: newSummary },
    });
  } catch (err) {
    console.error("[baddy] Session summary update failed (non-fatal):", err.message);
  }
}
