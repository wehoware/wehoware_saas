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

  const { messages, enableThinking } = body;

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

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = chatWithBaddy({
          systemPrompt,
          messages: trimmedMessages,
          clientId, // STRICT client isolation — enforced in executeToolCall
          userId: request.user.id,
          enableThinking: Boolean(enableThinking),
        });

        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        console.error("[ai/chat] Stream error:", err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "AI service error", content: "Sorry, an error occurred. Please try again." })}\n\n`)
        );
      } finally {
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
