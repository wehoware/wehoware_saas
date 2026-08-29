// src/app/api/v1/ai/sessions/[id]/route.js
// Get or update a specific chat session.

import { NextResponse } from "next/server";
import { withAuth } from "@/app/api/utils/auth-middleware";

/**
 * GET /api/v1/ai/sessions/[id]
 * Get a session with all its messages (chat history).
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

  // Verify session belongs to this user + client (strict isolation)
  const session = await request.prisma.wehowareAgentSession.findFirst({
    where: {
      id: sessionId,
      clientId,
      userId: request.user.id,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          model: true,
          totalTimeMs: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ session });
}, { allowedRoles: ["admin", "employee", "client"] });

/**
 * PATCH /api/v1/ai/sessions/[id]
 * Update session (e.g., change title or status).
 * Body: { title?: string, status?: string }
 */
export const PATCH = withAuth(async (request, { params }) => {
  const sessionId = params.id;
  const clientId = request.user.activeClientId;

  if (!clientId) {
    return NextResponse.json(
      { error: "No active client selected." },
      { status: 400 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Verify ownership
  const existing = await request.prisma.wehowareAgentSession.findFirst({
    where: { id: sessionId, clientId, userId: request.user.id },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  const data = {};
  if (body.title) data.title = body.title;
  if (body.status) data.status = body.status;

  const updated = await request.prisma.wehowareAgentSession.update({
    where: { id: sessionId },
    data,
  });

  return NextResponse.json({ session: updated });
}, { allowedRoles: ["admin", "employee", "client"] });
