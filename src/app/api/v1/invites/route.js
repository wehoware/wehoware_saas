/**
 * /api/v1/invites
 *
 * POST — Create an invitation (admin/employee/client_owner for their client)
 * GET  — Validate an invite token (public, no auth)
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../utils/auth-middleware";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/ses";
import crypto from "node:crypto";

const INVITE_EXPIRY_HOURS = 7 * 24; // 7 days

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

// -------------------------------------------------------------------
// POST — Create invite
// -------------------------------------------------------------------
export const POST = withAuth(
  async (request) => {
    try {
      const { prisma: tx, user } = request;
      const body = await request.json();
      const { email, client_id: clientId, role: inviteRole } = body ?? {};

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
      }
      if (!clientId || typeof clientId !== "string") {
        return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
      }
      if (!inviteRole || !["manager", "editor", "viewer"].includes(inviteRole)) {
        return NextResponse.json(
          { error: "Role must be manager, editor, or viewer" },
          { status: 400 }
        );
      }

      // Authorization:
      // - admin/employee can invite to any client
      // - client (owner) can invite only to their own active client associations
      if (!["admin", "employee", "client"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (user.role === "client") {
        // Verify the inviter is an owner (client role) of the target client
        const uc = await tx.wehowareUserClient.findFirst({
          where: {
            userId: user.id,
            clientId: clientId,
            role: "client",
            active: true,
          },
          select: { id: true },
        });
        if (!uc) {
          return NextResponse.json(
            { error: "You can only invite users to clients you own" },
            { status: 403 }
          );
        }
      }

      // Prevent duplicate active invites
      const existing = await tx.wehowareUserInvite.findFirst({
        where: {
          email: email.trim().toLowerCase(),
          clientId: clientId,
          status: { in: ["Pending", "Accepted"] },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "An active invite already exists for this email on this client" },
          { status: 409 }
        );
      }

      // Check if user already exists with this email and has an active association
      const existingUser = await tx.wehowareProfile.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: {
          id: true,
          userClients: {
            where: { clientId, active: true },
            select: { id: true },
          },
        },
      });
      if (existingUser?.userClients?.length > 0) {
        return NextResponse.json(
          { error: "This user is already a member of this client" },
          { status: 409 }
        );
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

      const invite = await tx.wehowareUserInvite.create({
        data: {
          email: email.trim().toLowerCase(),
          clientId,
          role: inviteRole,
          invitedBy: user.id,
          token,
          status: "Pending",
          expiresAt,
        },
      });

      // Fetch client name + inviter name for email
      const [client, inviter] = await Promise.all([
        tx.wehowareClient.findUnique({
          where: { id: clientId },
          select: { companyName: true },
        }),
        tx.wehowareProfile.findUnique({
          where: { id: user.id },
          select: { firstName: true, lastName: true, email: true },
        }),
      ]);

      const inviterName = inviter?.firstName
        ? `${inviter.firstName} ${inviter.lastName || ""}`.trim()
        : inviter?.email || "Someone";

      const inviteUrl = `${getBaseUrl()}/invite/accept?token=${encodeURIComponent(token)}`;

      // Fire-and-forget email (don't block response)
      sendEmail({
        clientId,
        to: email.trim().toLowerCase(),
        template: "user.invite",
        context: {
          inviter_name: inviterName,
          client_name: client?.companyName || "Wehoware",
          invite_url: inviteUrl,
          role: inviteRole,
        },
      }).catch((err) => {
        console.error("[POST /api/v1/invites] Failed to send invite email:", err);
      });

      return NextResponse.json(
        {
          message: "Invitation sent",
          inviteId: invite.id,
          expiresAt: invite.expiresAt.toISOString(),
        },
        { status: 201 }
      );
    } catch (err) {
      console.error("[POST /api/v1/invites] error:", err);
      return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
    }
  },
  { allowedRoles: ["admin", "employee", "client"] }
);

// -------------------------------------------------------------------
// GET — Validate invite token (public)
// -------------------------------------------------------------------
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const invite = await prisma.wehowareUserInvite.findUnique({
      where: { token },
      include: {
        client: { select: { id: true, companyName: true } },
      },
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
      // Auto-mark expired
      await prisma.wehowareUserInvite
        .update({ where: { id: invite.id }, data: { status: "Expired" } })
        .catch(() => {});
      return NextResponse.json({ error: "Invitation expired" }, { status: 410 });
    }

    return NextResponse.json({
      valid: true,
      email: invite.email,
      client: invite.client,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[GET /api/v1/invites] error:", err);
    return NextResponse.json({ error: "Failed to validate invitation" }, { status: 500 });
  }
}
