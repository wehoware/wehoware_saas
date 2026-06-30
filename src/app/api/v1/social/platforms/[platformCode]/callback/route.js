/**
 * GET /api/v1/social/platforms/[platformCode]/callback
 * Handles OAuth callback from social media platforms.
 * State is verified with HMAC-SHA256 before processing to prevent CSRF.
 */
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { OAUTH_STATE_MAX_AGE_MS } from "@/lib/social-clients/constants.js";

const PLATFORM_TOKEN_URLS = {
  facebook: "https://graph.facebook.com/v18.0/oauth/access_token",
  instagram: "https://graph.facebook.com/v18.0/oauth/access_token",
  twitter: "https://api.twitter.com/2/oauth2/token",
  tiktok: "https://open.tiktokapis.com/v2/oauth/token",
};

// ── State verification ──────────────────────────────────────────────────────

function verifyAndDecodeState(stateB64) {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(stateB64, "base64url").toString("utf-8"));
  } catch {
    throw new Error("Malformed state parameter");
  }
  const { payload, sig } = parsed;
  if (!payload || !sig) throw new Error("Invalid state structure");

  const expected = createHmac("sha256", process.env.NEXTAUTH_SECRET || "")
    .update(JSON.stringify(payload))
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(sig, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("State signature mismatch — possible CSRF attempt");
  }

  // Verify state has not expired
  if (payload.createdAt) {
    const ageMs = Date.now() - payload.createdAt;
    if (ageMs > OAUTH_STATE_MAX_AGE_MS) {
      throw new Error("OAuth state expired — please try connecting again");
    }
  }

  return payload;
}

// ── Token exchange ──────────────────────────────────────────────────────────

async function exchangeFacebookToken(code, redirectUri) {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const url = new URL(PLATFORM_TOKEN_URLS.facebook);
  url.searchParams.set("client_id", appId || "");
  url.searchParams.set("client_secret", appSecret || "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Facebook token exchange failed: ${res.status}`);
  return res.json();
}

async function exchangeTwitterToken(code, redirectUri, codeVerifier) {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const res = await fetch(PLATFORM_TOKEN_URLS.twitter, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier || "",
    }).toString(),
  });
  if (!res.ok) throw new Error(`Twitter token exchange failed: ${res.status}`);
  return res.json();
}

async function exchangeTikTokToken(code, redirectUri, codeVerifier) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const body = new URLSearchParams({
    client_key: clientKey || "",
    client_secret: clientSecret || "",
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  if (codeVerifier) body.set("code_verifier", codeVerifier);
  const res = await fetch(PLATFORM_TOKEN_URLS.tiktok, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`TikTok token exchange failed: ${res.status}`);
  return res.json();
}

// ── Profile fetch ───────────────────────────────────────────────────────────

async function fetchFacebookProfile(accessToken) {
  const pagesRes = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,picture&access_token=${accessToken}`
  );
  if (!pagesRes.ok) return {};
  const pages = await pagesRes.json();
  const firstPage = pages.data?.[0];
  return {
    name: firstPage?.name || "Facebook Page",
    handle: firstPage?.id,
    profileData: {
      pageId: firstPage?.id,
      pageAccessToken: firstPage?.access_token,
      pages: pages.data || [],
    },
  };
}

async function fetchInstagramProfile(accessToken) {
  const igRes = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,instagram_business_account{id,name,username,profile_picture_url}&access_token=${accessToken}`
  );
  if (!igRes.ok) return {};
  const pages = await igRes.json();
  const igAccount = pages.data?.[0]?.instagram_business_account;
  return {
    name: igAccount?.name || igAccount?.username || "Instagram Account",
    handle: igAccount?.username,
    profileData: { igUserId: igAccount?.id, username: igAccount?.username },
  };
}

async function fetchTwitterProfile(accessToken) {
  const res = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return {};
  const data = await res.json();
  return {
    name: data.data?.name || "Twitter User",
    handle: data.data?.username,
    profileData: { userId: data.data?.id, username: data.data?.username },
  };
}

async function fetchTikTokProfile(accessToken) {
  const res = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return {};
  const data = await res.json();
  return {
    name: data.data?.user?.display_name || "TikTok User",
    handle: data.data?.user?.username || data.data?.user?.open_id,
    profileData: { openId: data.data?.user?.open_id, username: data.data?.user?.username },
  };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request, { params }) {
  const { platformCode } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");
  const appOrigin = new URL(request.url).origin;
  const accountsUrl = `${appOrigin}/admin/social-media/accounts`;

  if (error) {
    return NextResponse.redirect(`${accountsUrl}?error=${encodeURIComponent(error)}`);
  }
  if (!code || !stateParam) {
    return NextResponse.redirect(`${accountsUrl}?error=missing_params`);
  }

  try {
    const stateData = verifyAndDecodeState(stateParam);
    const { clientId, userId, platformId, codeVerifier } = stateData;

    if (!clientId || !userId) throw new Error("Invalid state parameter");

    const platform = await prisma.wehowareSocialPlatform.findUnique({ where: { id: platformId } });
    if (!platform) throw new Error("Platform not found");

    const redirectUri =
      process.env[`${platformCode.toUpperCase()}_CALLBACK_URL`] ||
      `${appOrigin}/api/v1/social/platforms/${platformCode}/callback`;

    let tokenData, profile;
    switch (platformCode) {
      case "facebook":
        tokenData = await exchangeFacebookToken(code, redirectUri);
        profile = await fetchFacebookProfile(tokenData.access_token);
        break;
      case "instagram":
        tokenData = await exchangeFacebookToken(code, redirectUri);
        profile = await fetchInstagramProfile(tokenData.access_token);
        break;
      case "twitter":
        tokenData = await exchangeTwitterToken(code, redirectUri, codeVerifier);
        profile = await fetchTwitterProfile(tokenData.access_token);
        break;
      case "tiktok":
        tokenData = await exchangeTikTokToken(code, redirectUri, codeVerifier);
        profile = await fetchTikTokProfile(tokenData.data?.access_token || tokenData.access_token);
        break;
      default:
        throw new Error(`Unknown platform: ${platformCode}`);
    }

    const accessToken = tokenData.data?.access_token || tokenData.access_token;
    const refreshToken = tokenData.data?.refresh_token || tokenData.refresh_token || null;
    const expiresIn = tokenData.data?.access_token_expire_in || tokenData.expires_in;
    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
    const accountId = profile.handle || profile.profileData?.userId || profile.profileData?.openId || userId;

    await prisma.wehowareSocialAccount.upsert({
      where: { clientId_platformId_accountId: { clientId, platformId, accountId } },
      update: {
        accountName: profile.name || platformCode,
        accountHandle: profile.handle || null,
        accessToken,
        refreshToken,
        tokenExpiresAt,
        profileData: profile.profileData || {},
        status: "Active",
        lastSyncedAt: new Date(),
        syncError: null,
        updatedBy: userId,
      },
      create: {
        clientId,
        platformId,
        accountName: profile.name || platformCode,
        accountHandle: profile.handle || null,
        accountId,
        accessToken,
        refreshToken,
        tokenExpiresAt,
        profileData: profile.profileData || {},
        status: "Active",
        lastSyncedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      },
    });

    return NextResponse.redirect(`${accountsUrl}?success=connected&platform=${platformCode}`);
  } catch (err) {
    console.error(`[OAuth Callback ${platformCode}]`, err);
    return NextResponse.redirect(`${accountsUrl}?error=${encodeURIComponent("Authentication failed. Please try connecting again.")}`);
  }
}
