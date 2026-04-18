import { NextResponse } from "next/server";

/**
 * Next.js Edge Middleware
 * Runs on every request before it hits a route handler or page.
 *
 * Responsibilities:
 * 1. Add security headers to all responses
 * 2. Protect /admin/* routes — redirect to /login if no session cookie
 * 3. Redirect authenticated users away from /login
 */

const PUBLIC_PATHS = [
  "/login",
  "/",
  "/about",
  "/contact",
  "/services",
  "/blog",
];

/** Security headers applied to every response */
function addSecurityHeaders(response) {
  const h = response.headers;
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "SAMEORIGIN");
  h.set("X-XSS-Protection", "1; mode=block");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  h.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  h.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for Next.js dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  return response;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Skip static files, _next internals, and API routes (API routes have their
  // own auth via withAuth middleware)
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|webp|svg|avif|gif|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // Check for NextAuth session token (works with both dev and prod cookie names)
  const sessionToken =
    request.cookies.get("next-auth.session-token")?.value ||
    request.cookies.get("__Secure-next-auth.session-token")?.value;

  const isAdminPath = pathname.startsWith("/admin");
  const isLoginPath = pathname === "/login";

  // Redirect unauthenticated users away from /admin
  if (isAdminPath && !sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const response = NextResponse.redirect(loginUrl);
    return addSecurityHeaders(response);
  }

  // Redirect authenticated users away from /login
  if (isLoginPath && sessionToken) {
    const response = NextResponse.redirect(new URL("/admin", request.url));
    return addSecurityHeaders(response);
  }

  // Add security headers to all other responses
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

export const config = {
  // Run on all paths except static files (redundant with the check above but
  // prevents the middleware from even being invoked for static assets)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
