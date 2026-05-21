/**
 * Zoom OAuth Callback
 *
 * GET /api/v1/integrations/zoom/callback?code=...&state=...
 *
 * Exchanges the authorization code for tokens and creates/updates
 * a WehowareIntegration record linked to the Zoom provider.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const stateParam = searchParams.get("state");

    if (error) {
      console.error("[Zoom OAuth] error from provider:", error, errorDescription);
      return NextResponse.redirect(new URL("/admin/appointments?tab=settings&error=zoom_denied", request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/admin/appointments?tab=settings&error=no_code", request.url));
    }

    let state;
    try {
      state = JSON.parse(Buffer.from(stateParam || "", "base64").toString("utf8"));
    } catch {
      return NextResponse.redirect(new URL("/admin/appointments?tab=settings&error=invalid_state", request.url));
    }

    const { clientId, userId } = state;
    if (!clientId) {
      return NextResponse.redirect(new URL("/admin/appointments?tab=settings&error=no_client", request.url));
    }

    const zoomClientId = process.env.ZOOM_CLIENT_ID || "";
    const zoomClientSecret = process.env.ZOOM_CLIENT_SECRET || "";
    const redirectUri = process.env.ZOOM_REDIRECT_URI || "http://localhost:3000/api/v1/integrations/zoom/callback";

    const basicAuth = Buffer.from(`${zoomClientId}:${zoomClientSecret}`).toString("base64");
    const tokenRes = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("[Zoom OAuth] token exchange failed:", tokenData);
      return NextResponse.redirect(new URL("/admin/appointments?tab=settings&error=token_exchange_failed", request.url));
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

    let provider = await prisma.wehowareIntegrationProvider.findFirst({
      where: { name: "Zoom" },
    });
    if (!provider) {
      provider = await prisma.wehowareIntegrationProvider.create({
        data: {
          name: "Zoom",
          category: "video",
          description: "Auto-generate Zoom meetings for appointments",
          active: true,
        },
      });
    }

    const existing = await prisma.wehowareIntegration.findFirst({
      where: { clientId, providerId: provider.id },
    });

    if (existing) {
      await prisma.wehowareIntegration.update({
        where: { id: existing.id },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token || existing.refreshToken,
          tokenExpiresAt: expiresAt,
          status: "Active",
          lastSyncAt: new Date(),
          updatedBy: userId || existing.createdBy,
        },
      });
    } else {
      await prisma.wehowareIntegration.create({
        data: {
          clientId,
          providerId: provider.id,
          name: "Zoom",
          accessToken: access_token,
          refreshToken: refresh_token || null,
          tokenExpiresAt: expiresAt,
          config: {},
          status: "Active",
          lastSyncAt: new Date(),
          createdBy: userId,
          updatedBy: userId,
        },
      });
    }

    return NextResponse.redirect(new URL("/admin/appointments?tab=settings&success=zoom_connected", request.url));
  } catch (err) {
    console.error("[Zoom OAuth Callback] exception:", err);
    return NextResponse.redirect(new URL("/admin/appointments?tab=settings&error=unknown", request.url));
  }
}
