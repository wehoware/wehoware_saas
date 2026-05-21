/**
 * Zoom OAuth Auth Initiator
 *
 * GET /api/v1/integrations/zoom/auth
 *
 * Builds the Zoom OAuth URL and redirects the browser to Zoom for authorization.
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

    let clientId = session.user.activeClientId || session.user.clientId;
    if (!clientId) {
      const userClients = await prisma.wehowareUserClient.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
        select: { clientId: true },
      });
      clientId = userClients?.clientId;
    }

    if (!clientId) {
      return NextResponse.redirect(new URL("/admin/appointments?tab=settings&error=no_client", request.url));
    }

    const state = Buffer.from(JSON.stringify({ clientId, userId: session.user.id })).toString("base64");

    const zoomClientId = process.env.ZOOM_CLIENT_ID || "";
    const redirectUri = process.env.ZOOM_REDIRECT_URI || "http://localhost:3000/api/v1/integrations/zoom/callback";

    const url = new URL("https://zoom.us/oauth/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", zoomClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    return NextResponse.redirect(url.toString());
  } catch (err) {
    console.error("[Zoom OAuth Auth] exception:", err);
    return NextResponse.redirect(new URL("/admin/appointments?tab=settings&error=unknown", request.url));
  }
}
