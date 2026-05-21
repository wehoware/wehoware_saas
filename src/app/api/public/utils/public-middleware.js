/**
 * Public API Middleware
 *
 * Provides:
 *   - CORS headers for cross-origin booking widgets
 *   - Simple per-client rate limiting (in-memory, per-process)
 *   - Client lookup by publicSlug
 *
 * Usage: wrap public route handlers with withPublic(handler)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// In-memory rate-limit store (per Node process).
// For production scale, swap to Redis.
const rateStore = new Map();

const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX_REQUESTS = 60;  // per window per client

function checkRateLimit(key) {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;

  let entries = rateStore.get(key) || [];
  entries = entries.filter((ts) => ts > windowStart);

  if (entries.length >= RATE_MAX_REQUESTS) {
    return false;
  }

  entries.push(now);
  rateStore.set(key, entries);
  return true;
}

/**
 * Lookup client by public slug.
 * Returns null if not found or inactive.
 */
export async function getClientBySlug(publicSlug) {
  if (!publicSlug) return null;
  return prisma.wehowareClient.findFirst({
    where: { publicSlug, active: true },
    select: { id: true, companyName: true, publicSlug: true },
  });
}

/**
 * Standard CORS headers for public endpoints.
 */
export function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * withPublic — wraps a public route handler with:
 *   1. CORS preflight support
 *   2. Rate limiting keyed by client slug + IP
 *   3. Client resolution from ?client_slug= query param
 *   4. Attaches `request.client` for downstream use
 */
export function withPublic(handler) {
  return async (request, context) => {
    // Preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);
    const clientSlug = url.searchParams.get("client_slug");

    if (!clientSlug) {
      return NextResponse.json(
        { error: "Missing required query parameter: client_slug" },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Rate limit by client + IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const rateKey = `${clientSlug}:${ip}`;

    if (!checkRateLimit(rateKey)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: corsHeaders() }
      );
    }

    // Resolve client
    const client = await getClientBySlug(clientSlug);
    if (!client) {
      return NextResponse.json(
        { error: "Client not found or inactive" },
        { status: 404, headers: corsHeaders() }
      );
    }

    request.client = client;

    try {
      const response = await handler(request, context);
      // Inject CORS headers into JSON responses
      const headers = corsHeaders();
      for (const [k, v] of Object.entries(headers)) {
        response.headers.set(k, v);
      }
      return response;
    } catch (err) {
      console.error("[withPublic] Handler error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: corsHeaders() }
      );
    }
  };
}
