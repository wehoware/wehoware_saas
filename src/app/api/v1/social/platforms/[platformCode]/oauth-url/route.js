/**
 * GET /api/v1/social/platforms/[platformCode]/oauth-url
 * Returns an OAuth authorization URL for a platform.
 * The `state` parameter is HMAC-signed with NEXTAUTH_SECRET to prevent CSRF.
 */
import { NextResponse } from "next/server";
import { withAuth } from "../../../../../utils/auth-middleware";
import { randomBytes, createHmac } from "node:crypto";

const PKCE_PLATFORMS = new Set(["twitter", "tiktok"]);

function signState(payload) {
  const json = JSON.stringify(payload);
  const sig = createHmac("sha256", process.env.NEXTAUTH_SECRET || "")
    .update(json)
    .digest("hex");
  return Buffer.from(JSON.stringify({ payload, sig })).toString("base64url");
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { prisma, user } = request;
    const { platformCode } = await params;

    const platform = await prisma.wehowareSocialPlatform.findUnique({
      where: { platformCode },
    });
    if (!platform) {
      return NextResponse.json({ error: "Platform not found" }, { status: 404 });
    }

    const clientId = user.activeClientId || user.clientId;
    if (!clientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }

    const appOrigin = new URL(request.url).origin;
    const redirectUri =
      process.env[`${platform.platformCode.toUpperCase()}_CALLBACK_URL`] ||
      `${appOrigin}/api/v1/social/platforms/${platform.platformCode}/callback`;

    const appClientId =
      process.env[`${platform.platformCode.toUpperCase()}_APP_ID`] ||
      process.env[`${platform.platformCode.toUpperCase()}_CLIENT_KEY`] ||
      process.env[`${platform.platformCode.toUpperCase()}_API_KEY`];

    if (!appClientId) {
      return NextResponse.json(
        { error: `${platform.name} credentials not configured` },
        { status: 503 }
      );
    }

    // Build the state payload — include PKCE verifier when required
    const statePayload = {
      clientId,
      userId: user.id,
      platformId: platform.id,
      platformCode: platform.platformCode,
    };

    const oauthConfig = platform.oauthConfig;
    const authUrl = new URL(oauthConfig.authUrl);

    if (PKCE_PLATFORMS.has(platform.platformCode)) {
      // PKCE plain method: code_challenge === verifier.
      // Verifier is embedded in the signed state so only our callback can retrieve it.
      const verifier = randomBytes(32).toString("base64url");
      statePayload.codeVerifier = verifier;
      authUrl.searchParams.set("code_challenge_method", "plain");
      authUrl.searchParams.set("code_challenge", verifier);
    }

    const state = signState(statePayload);

    authUrl.searchParams.set("client_id", appClientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", oauthConfig.scopes.join(" "));
    authUrl.searchParams.set("state", state);

    return NextResponse.json({ authUrl: authUrl.toString(), redirectUri, platform: platform.name });
  } catch (err) {
    console.error("[GET /api/v1/social/platforms/[platformCode]/oauth-url]", err);
    return NextResponse.json({ error: "Failed to generate OAuth URL" }, { status: 500 });
  }
});
