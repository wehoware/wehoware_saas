/**
 * Google Calendar OAuth Auth Initiator
 *
 * GET /api/v1/integrations/google/calendar/auth
 *
 * Builds the Google OAuth URL with the active client encoded in the state
 * parameter, then redirects the browser to Google for authorization.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Resolve active client from session or cookie
    let clientId = session.user.activeClientId || session.user.clientId;
    if (!clientId) {
      const userClients = await prisma.wehowareUserClient.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
      });
      clientId = userClients?.clientId;
    }

    if (!clientId) {
      return NextResponse.redirect(new URL("/admin/appointments?tab=settings&error=no_client", request.url));
    }

    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${new URL(request.url).origin}/api/v1/integrations/google/calendar/callback`;

    const state = Buffer.from(
      JSON.stringify({ clientId, userId: session.user.id })
    ).toString("base64");

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set(
      "scope",
      "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly openid email profile"
    );
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "consent");
    googleAuthUrl.searchParams.set("state", state);

    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (err) {
    console.error("[Google OAuth Auth] exception:", err);
    return NextResponse.redirect(new URL("/admin/appointments?tab=settings&error=auth_failed", request.url));
  }
}
