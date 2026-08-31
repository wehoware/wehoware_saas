// src/app/api/v1/ai/chat/route.js
// Baddy AI assistant chat endpoint — client-isolated.
//
// SECURITY: This endpoint enforces strict client isolation:
// 1. User must be authenticated (NextAuth session or API key)
// 2. User must have an activeClientId (resolved by withAuth)
// 3. All tool calls are scoped to activeClientId — no cross-client access
// 4. The LLM never gets raw DB access — only scoped query results
//
// CRITICAL RULE: NEVER deletes data. The tool set only has GET and POST.

import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";
import { prisma } from "@/lib/prisma";
import { buildSystemPrompt, chatWithBaddy } from "@/lib/ai/baddy-assistant";

/**
 * POST /api/v1/ai/chat
 * Send a message to the Baddy AI assistant and get a response.
 *
 * Body:
 *   { messages: [{role: "user"|"assistant", content: "string"}], enableThinking?: boolean }
 *
 * Response (streaming):
 *   text/event-stream — chunks of assistant response
 *
 * Response (non-streaming):
 *   { response: "string", clientId: "uuid" }
 */
export const POST = withAuth(async (request) => {
  // ─── Security: Require activeClientId ───────────────────────────
  const clientId = request.user.activeClientId;
  if (!clientId) {
    return NextResponse.json(
      { error: "No active client selected. Please select a client before chatting with Baddy." },
      { status: 400 }
    );
  }

  // ─── Parse request body ─────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, enableThinking, sessionId: existingSessionId } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages array is required and must not be empty" },
      { status: 400 }
    );
  }

  // Validate message structure
  for (const msg of messages) {
    if (!msg.role || !msg.content) {
      return NextResponse.json(
        { error: "Each message must have role and content" },
        { status: 400 }
      );
    }
    if (!["user", "assistant", "system"].includes(msg.role)) {
      return NextResponse.json(
        { error: `Invalid message role: ${msg.role}` },
        { status: 400 }
      );
    }
  }

  // Limit conversation history to last 20 messages to prevent token overflow
  const trimmedMessages = messages.slice(-20);

  // ─── Resolve or create a chat session ───────────────────────────
  let session = null;
  try {
    if (existingSessionId) {
      // Verify the session belongs to this user + client
      session = await prisma.wehowareAgentSession.findFirst({
        where: {
          id: existingSessionId,
          clientId,
          userId: request.user.id,
        },
      });
    }

    if (!session) {
      // Create a new session — use the first user message as the title
      const firstUserMsg = trimmedMessages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 80) + (firstUserMsg.content.length > 80 ? "…" : "")
        : "New Chat";

      session = await prisma.wehowareAgentSession.create({
        data: {
          clientId,
          userId: request.user.id,
          title,
          status: "active",
        },
      });
    }
  } catch (err) {
    console.error("[ai/chat] Session setup failed:", err);
    // Non-fatal — continue without persistence
  }

  const sessionId = session?.id;

  // ─── Save the latest user message to DB ─────────────────────────
  const lastUserMessage = [...trimmedMessages].reverse().find((m) => m.role === "user");
  if (sessionId && lastUserMessage) {
    try {
      await prisma.wehowareAgentMessage.create({
        data: {
          sessionId,
          clientId,
          userId: request.user.id,
          role: "user",
          content: lastUserMessage.content,
        },
      });
    } catch (err) {
      console.error("[ai/chat] Failed to save user message:", err);
    }
  }

  // ─── Fetch client details for system prompt ─────────────────────
  let client;
  try {
    client = await prisma.wehowareClient.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        companyName: true,
        domain: true,
        website: true,
        industry: true,
        contactPerson: true,
        email: true,
      },
    });
  } catch (err) {
    console.error("[ai/chat] Failed to fetch client:", err);
    return NextResponse.json(
      { error: "Failed to load client context" },
      { status: 500 }
    );
  }

  if (!client) {
    return NextResponse.json(
      { error: "Active client not found" },
      { status: 404 }
    );
  }

  // ─── Build system prompt (client-scoped) ────────────────────────
  const systemPrompt = buildSystemPrompt(request.user, client);

  // ─── Stream response ────────────────────────────────────────────
  const encoder = new TextEncoder();
  const streamStartTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      let fullAssistantContent = "";

      try {
        const generator = chatWithBaddy({
          systemPrompt,
          messages: trimmedMessages,
          clientId, // STRICT client isolation — enforced in executeToolCall
          userId: request.user.id,
          enableThinking: Boolean(enableThinking),
          userRole: request.user.role,
          clientRole: request.user.activeClientRole,
          sessionId, // For session-level memory context
        });

        for await (const chunk of generator) {
          fullAssistantContent += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, sessionId })}\n\n`));
      } catch (err) {
        console.error("[ai/chat] Stream error:", err?.message || err, err?.stack?.split("\n").slice(0, 3).join(" | "));
        fullAssistantContent = `Sorry, an error occurred: ${err?.message || "unknown error"}. Please try again.`;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "AI service error", content: fullAssistantContent, sessionId })}\n\n`)
        );
      } finally {
        // ─── Save the assistant response to DB ───────────────────
        if (sessionId && fullAssistantContent) {
          try {
            await prisma.wehowareAgentMessage.create({
              data: {
                sessionId,
                clientId,
                userId: request.user.id,
                role: "assistant",
                content: fullAssistantContent,
                model: process.env.VLLM_MODEL || "qwen3.8-27b",
                totalTimeMs: Date.now() - streamStartTime,
              },
            });

            // Update session's updatedAt timestamp, lastMessageAt, and messageCount
            await prisma.wehowareAgentSession.update({
              where: { id: sessionId },
              data: {
                updatedAt: new Date(),
                lastMessageAt: new Date(),
                messageCount: { increment: 2 }, // user message + assistant response
              },
            });
          } catch (err) {
            console.error("[ai/chat] Failed to save assistant message:", err);
          }
        }

        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}, { allowedRoles: ["admin", "employee", "client"] });
