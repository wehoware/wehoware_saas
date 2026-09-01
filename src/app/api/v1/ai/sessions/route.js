// src/app/api/v1/ai/sessions/route.js
// AI chat session management — list and create sessions.
// Sessions are scoped to user + activeClientId (strict client isolation).

import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";

/**
 * GET /api/v1/ai/sessions
 * List chat sessions for the current user + active client.
 * Returns the most recent sessions (max 20).
 */
export const GET = withAuth(async (request) => {
  const clientId = request.user.activeClientId;
  if (!clientId) {
    return NextResponse.json(
      { error: "No active client selected." },
      { status: 400 }
    );
  }

  const sessions = await request.prisma.wehowareAgentSession.findMany({
    where: {
      clientId,
      userId: request.user.id,
      status: { not: "archived" },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      summary: true,
      messageCount: true,
      lastMessageAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ sessions });
}, { allowedRoles: ["admin", "employee", "client"] });

/**
 * POST /api/v1/ai/sessions
 * Create a new chat session for the current user + active client.
 * Body: { title?: string }
 */
export const POST = withAuth(async (request) => {
  const clientId = request.user.activeClientId;
  if (!clientId) {
    return NextResponse.json(
      { error: "No active client selected." },
      { status: 400 }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const session = await request.prisma.wehowareAgentSession.create({
    data: {
      clientId,
      userId: request.user.id,
      title: body.title || "New Chat",
      status: "active",
    },
  });

  return NextResponse.json({ session }, { status: 201 });
}, { allowedRoles: ["admin", "employee", "client"] });
