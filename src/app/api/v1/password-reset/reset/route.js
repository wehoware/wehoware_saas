/**
 * /api/v1/password-reset/reset
 *
 * POST — Reset password using a valid token (public)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, password } = body ?? {};

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
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

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
      await tx.wehowareProfile.update({
        where: { email: reset.email },
        data: { passwordHash },
      });
      await tx.wehowarePasswordReset.update({
        where: { id: reset.id },
        data: { used: true },
      });
    });

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("[POST /api/v1/password-reset/reset] error:", err);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
