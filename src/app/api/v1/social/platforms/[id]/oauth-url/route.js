/**
 * GET /api/v1/social/platforms/[id]/oauth-url
 * Returns an OAuth authorization URL for a platform.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";
import { randomBytes } from "crypto";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { id } = await params;

    const platform = await prisma.wehowareSocialPlatform.findUnique({
      where: { id },
    });
    if (!platform) {
      return NextResponse.json({ error: "Platform not found" }, { status: 404 });
    }

    const clientId = user.activeClientId || user.clientId;
    if (!clientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }

    const appOrigin = new URL(request.url).origin;
    const redirectUri = process.env[`${platform.platformCode.toUpperCase()}_CALLBACK_URL`]
      || `${appOrigin}/api/v1/social/platforms/${platform.platformCode}/callback`;

    const state = Buffer.from(
      JSON.stringify({ clientId, userId: user.id, platformId: id, platformCode: platform.platformCode })
    ).toString("base64");

    const oauthConfig = platform.oauthConfig;
    const authUrl = new URL(oauthConfig.authUrl);
    const appClientId = process.env[`${platform.platformCode.toUpperCase()}_APP_ID`]
      || process.env[`${platform.platformCode.toUpperCase()}_CLIENT_KEY`]
      || process.env[`${platform.platformCode.toUpperCase()}_API_KEY`];

    if (!appClientId) {
      return NextResponse.json(
        { error: `${platform.name} App credentials not configured. Set ${platform.platformCode.toUpperCase()}_APP_ID in environment.` },
        { status: 503 }
      );
    }

    authUrl.searchParams.set("client_id", appClientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", oauthConfig.scopes.join(" "));
    authUrl.searchParams.set("state", state);

    if (platform.platformCode === "facebook" || platform.platformCode === "instagram") {
      // Facebook/Instagram specific
    } else if (platform.platformCode === "twitter") {
      authUrl.searchParams.set("code_challenge_method", "plain");
      const verifier = randomBytes(32).toString("base64url");
      authUrl.searchParams.set("code_challenge", verifier);
      // Store verifier in state for callback
    } else if (platform.platformCode === "tiktok") {
      authUrl.searchParams.set("code_verifier", randomBytes(32).toString("base64url"));
    }

    return NextResponse.json({ authUrl: authUrl.toString(), redirectUri, platform: platform.name });
  } catch (err) {
    console.error("[GET /api/v1/social/platforms/[id]/oauth-url]", err);
    return NextResponse.json({ error: "Failed to generate OAuth URL" }, { status: 500 });
  }
});
