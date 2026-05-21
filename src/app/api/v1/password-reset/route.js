/**
 * /api/v1/password-reset
 *
 * POST — Request a password reset email (public)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/ses";
import crypto from "node:crypto";

const RESET_EXPIRY_HOURS = 1;

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body ?? {};

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const profile = await prisma.wehowareProfile.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, firstName: true, clientId: true },
    });

    // Always return success to prevent user enumeration
    if (!profile) {
      return NextResponse.json(
        { message: "If an account exists, a reset link has been sent." },
        { status: 200 }
      );
    }

    // Invalidate previous unused tokens
    await prisma.wehowarePasswordReset.updateMany({
      where: { email: normalizedEmail, used: false },
      data: { used: true },
    });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + RESET_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.wehowarePasswordReset.create({
      data: {
        email: normalizedEmail,
        token,
        used: false,
        expiresAt,
      },
    });

    const resetUrl = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

    // Send email — use client's ID for tenant log if available, otherwise a system placeholder
    sendEmail({
      clientId: profile.clientId || "system",
      to: normalizedEmail,
      template: "user.password_reset",
      context: { reset_url: resetUrl },
    }).catch((err) => {
      console.error("[POST /api/v1/password-reset] Failed to send reset email:", err);
    });

    return NextResponse.json(
      { message: "If an account exists, a reset link has been sent." },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/v1/password-reset] error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
