/**
 * /api/v1/password-reset/verify
 *
 * POST — Verify a password reset token (public)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  try {
    const body = await request.json();
    const { token } = body ?? {};

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const reset = await prisma.wehowarePasswordReset.findUnique({
      where: { token },
    });

    if (!reset || reset.used) {
      return NextResponse.json({ error: "Invalid or used token" }, { status: 400 });
    }

    if (new Date() > reset.expiresAt) {
      return NextResponse.json({ error: "Token expired" }, { status: 410 });
    }

    return NextResponse.json({ valid: true, email: reset.email });
  } catch (err) {
    console.error("[POST /api/v1/password-reset/verify] error:", err);
    return NextResponse.json({ error: "Failed to verify token" }, { status: 500 });
  }
}
