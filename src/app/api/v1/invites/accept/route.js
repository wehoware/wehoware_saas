/**
 * /api/v1/invites/accept
 *
 * POST — Accept an invitation and create the user profile + client association.
 * Public endpoint (no auth required — the token is the credential).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, password, first_name: firstName, last_name: lastName } = body ?? {};

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invitation token is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const invite = await prisma.wehowareUserInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
    }
    if (invite.status === "Accepted") {
      return NextResponse.json({ error: "Invitation already accepted" }, { status: 410 });
    }
    if (invite.status === "Revoked") {
      return NextResponse.json({ error: "Invitation revoked" }, { status: 410 });
    }
    if (new Date() > invite.expiresAt) {
      await prisma.wehowareUserInvite
        .update({ where: { id: invite.id }, data: { status: "Expired" } })
        .catch(() => {});
      return NextResponse.json({ error: "Invitation expired" }, { status: 410 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      // Check if a profile already exists for this email
      let profile = await tx.wehowareProfile.findUnique({
        where: { email: invite.email },
        select: { id: true },
      });

      if (profile) {
        // Update password if profile existed (e.g., was previously deleted and re-invited)
        await tx.wehowareProfile.update({
          where: { id: profile.id },
          data: { passwordHash, firstName: firstName || null, lastName: lastName || null },
        });
      } else {
        profile = await tx.wehowareProfile.create({
          data: {
            email: invite.email,
            passwordHash,
            firstName: firstName || null,
            lastName: lastName || null,
            role: "client", // Global role is always "client" for team members
            clientId: invite.clientId, // Primary client for session context
          },
          select: { id: true },
        });
      }

      // Create or reactivate the client association with the per-client role
      const existingAssoc = await tx.wehowareUserClient.findFirst({
        where: { userId: profile.id, clientId: invite.clientId },
      });

      if (existingAssoc) {
        await tx.wehowareUserClient.update({
          where: { id: existingAssoc.id },
          data: { role: invite.role, active: true, isPrimary: true },
        });
      } else {
        await tx.wehowareUserClient.create({
          data: {
            userId: profile.id,
            clientId: invite.clientId,
            role: invite.role,
            isPrimary: true,
            active: true,
          },
        });
      }

      // Mark invite as accepted
      await tx.wehowareUserInvite.update({
        where: { id: invite.id },
        data: { status: "Accepted" },
      });

      return { userId: profile.id };
    });

    return NextResponse.json(
      { message: "Invitation accepted. You can now log in.", userId: result.userId },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/v1/invites/accept] error:", err);
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}
