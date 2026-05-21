/**
 * Microsoft Outlook Calendar OAuth Callback
 *
 * GET /api/v1/integrations/microsoft/calendar/callback?code=...&state=...
 *
 * Exchanges the authorization code for tokens and creates/updates
 * a WehowareIntegration record linked to the Outlook Calendar provider.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { backfillAppointmentsToCalendar } from "@/lib/calendar-sync";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const stateParam = searchParams.get("state");

    if (error) {
      console.error("[Microsoft OAuth] error from provider:", error, errorDescription);
      return NextResponse.redirect(new URL("/admin/appointments?tab=settings&error=microsoft_denied", request.url));
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

    // Exchange code for tokens
    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID || "",
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI || "http://localhost:3000/api/v1/integrations/microsoft/calendar/callback",
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("[Microsoft OAuth] token exchange failed:", tokenData);
      return NextResponse.redirect(
        new URL("/admin/appointments?tab=settings&error=token_exchange_failed", request.url)
      );
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

    // Find or create the Outlook Calendar provider
    let provider = await prisma.wehowareIntegrationProvider.findFirst({
      where: { name: "Outlook Calendar" },
    });
    if (!provider) {
      provider = await prisma.wehowareIntegrationProvider.create({
        data: {
          name: "Outlook Calendar",
          category: "calendar",
          description: "Sync appointments with Microsoft Outlook Calendar",
          active: true,
        },
      });
    }

    const existing = await prisma.wehowareIntegration.findFirst({
      where: { clientId, providerId: provider.id },
    });

    let integration;
    if (existing) {
      integration = await prisma.wehowareIntegration.update({
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
      integration = await prisma.wehowareIntegration.create({
        data: {
          clientId,
          providerId: provider.id,
          name: "Outlook Calendar",
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

    // Trigger backfill of future appointments (non-blocking)
    backfillAppointmentsToCalendar(integration, clientId).catch(err => {
      console.error("[Microsoft OAuth Callback] backfill error:", err);
    });

    return NextResponse.redirect(new URL("/admin/appointments?tab=settings&success=microsoft_connected", request.url));
  } catch (err) {
    console.error("[Microsoft OAuth Callback] exception:", err);
    return NextResponse.redirect(new URL("/admin/appointments?tab=settings&error=unknown", request.url));
  }
}
