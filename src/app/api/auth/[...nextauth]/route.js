// src/app/api/auth/[...nextauth]/route.js
// NextAuth v5 catch-all route — handles all /api/auth/* requests:
//   POST /api/auth/callback/credentials  — credential sign-in
//   POST /api/auth/signout               — sign-out
//   GET  /api/auth/session               — session fetch
//   GET  /api/auth/csrf                  — CSRF token
//   GET  /api/auth/providers             — available providers

import { handlers } from "@/lib/auth";

// Wrap handlers to log the actual NextAuth error for debugging
// the "Configuration" error on production
async function withErrorLogging(handler) {
  return async (req, ctx) => {
    try {
      const res = await handler(req, ctx);
      // Log if NextAuth returned a configuration error
      if (res.status === 500 || res.status === 400) {
        const clone = res.clone();
        const body = await clone.json().catch(() => null);
        if (body?.message?.includes("server configuration")) {
          console.error("[nextauth] Configuration error detected!", {
            status: res.status,
            url: req.url,
            host: req.headers.get("host"),
            xForwardedHost: req.headers.get("x-forwarded-host"),
            xForwardedProto: req.headers.get("x-forwarded-proto"),
            hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
            hasAuthSecret: !!process.env.AUTH_SECRET,
            hasAuthTrustHost: process.env.AUTH_TRUST_HOST,
            nextAuthUrl: process.env.NEXTAUTH_URL,
            nodeEnv: process.env.NODE_ENV,
          });
        }
      }
      return res;
    } catch (err) {
      console.error("[nextauth] Unhandled error:", err?.name, err?.message);
      throw err;
    }
  };
}

export const GET = withErrorLogging(handlers.GET);
export const POST = withErrorLogging(handlers.POST);
