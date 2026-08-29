// src/app/api/v1/ai/sessions/[id]/messages/route.js
// Get messages for a specific chat session (chat history).

import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";

/**
 * GET /api/v1/ai/sessions/[id]/messages
 * Get all messages for a session, ordered oldest-first.
 */
export const GET = withAuth(async (request, { params }) => {
  const sessionId = params.id;
  const clientId = request.user.activeClientId;

  if (!clientId) {
    return NextResponse.json(
      { error: "No active client selected." },
      { status: 400 }
    );
  }

  // Verify session belongs to this user + client
  const session = await request.prisma.wehowareAgentSession.findFirst({
    where: {
      id: sessionId,
      clientId,
      userId: request.user.id,
    },
    select: { id: true },
  });

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  const messages = await request.prisma.wehowareAgentMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      model: true,
      totalTimeMs: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ messages });
}, { allowedRoles: ["admin", "employee", "client"] });
