/**
 * Microsoft Outlook Calendar OAuth Auth Initiator
 *
 * GET /api/v1/integrations/microsoft/calendar/auth
 *
 * Builds the Microsoft OAuth URL with the active client encoded in the state
 * parameter, then redirects the browser to Microsoft for authorization.
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
      process.env.MICROSOFT_REDIRECT_URI ||
      `${new URL(request.url).origin}/api/v1/integrations/microsoft/calendar/callback`;

    const state = Buffer.from(
      JSON.stringify({ clientId, userId: session.user.id })
    ).toString("base64");

    const msAuthUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    msAuthUrl.searchParams.set("client_id", process.env.MICROSOFT_CLIENT_ID || "");
    msAuthUrl.searchParams.set("redirect_uri", redirectUri);
    msAuthUrl.searchParams.set("response_type", "code");
    msAuthUrl.searchParams.set(
      "scope",
      "Calendars.ReadWrite offline_access openid email profile"
    );
    msAuthUrl.searchParams.set("response_mode", "query");
    msAuthUrl.searchParams.set("state", state);

    return NextResponse.redirect(msAuthUrl.toString());
  } catch (err) {
    console.error("[Microsoft OAuth Auth] exception:", err);
    return NextResponse.redirect(new URL("/admin/appointments?tab=settings&error=auth_failed", request.url));
  }
}
