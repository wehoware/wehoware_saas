// Shared helpers for Meta platform callbacks (deauthorize / data-deletion).
// Meta POSTs application/x-www-form-urlencoded with `signed_request` =
// "<base64url(hmac-sha256(payload, appSecret))>.<base64url(JSON payload)>".

import { createHmac, timingSafeEqual } from "node:crypto";

function b64urlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

/**
 * Verify and decode a Meta signed_request against any of the app secrets.
 * Returns the decoded payload on success, or null on failure.
 * Tries each secret because the request doesn't identify which app sent it.
 */
export function parseSignedRequest(signedRequest, secrets) {
  if (typeof signedRequest !== "string") return null;
  const dot = signedRequest.indexOf(".");
  if (dot === -1) return null;

  const encodedSig = signedRequest.slice(0, dot);
  const payloadB64 = signedRequest.slice(dot + 1);

  let data;
  try {
    data = JSON.parse(b64urlDecode(payloadB64).toString("utf-8"));
  } catch {
    return null;
  }
  if (!data || !data.user_id) return null;

  const sig = b64urlDecode(encodedSig);
  const valid = secrets.filter(Boolean).some((secret) => {
    const expected = createHmac("sha256", secret).update(payloadB64).digest();
    return expected.length === sig.length && timingSafeEqual(expected, sig);
  });

  return valid ? data : null;
}

/** Extract and verify signed_request from a Meta form POST. */
export async function readSignedRequest(request) {
  let signed;
  try {
    const form = await request.formData();
    signed = form.get("signed_request");
  } catch {
    return null;
  }
  return parseSignedRequest(signed, [
    process.env.FACEBOOK_APP_SECRET,
    process.env.INSTAGRAM_APP_SECRET,
  ]);
}

/**
 * Find connected social accounts belonging to a Meta user_id.
 * IG connections store the IG user id in profileData.igUserId; FB Page
 * connections store the granting user in profileData.userId when available.
 */
export async function findAccountsForMetaUser(prisma, metaUserId) {
  return prisma.wehowareSocialAccount.findMany({
    where: {
      OR: [
        { profileData: { path: ["igUserId"], equals: metaUserId } },
        { profileData: { path: ["userId"], equals: metaUserId } },
        { accountId: metaUserId },
      ],
    },
  });
}
