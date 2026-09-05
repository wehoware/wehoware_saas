/**
 * Public API Middleware
 *
 * Provides:
 *   - CORS headers for cross-origin booking widgets
 *   - Simple per-client rate limiting (in-memory, per-process)
 *   - Client lookup by domain, clientId, or publicSlug
 *
 * Client resolution order (same as services/blogs):
 *   1. ?domain=example.com   — match by WehowareClient.domain
 *   2. ?clientId=uuid        — match by WehowareClient.id
 *   3. ?client_slug=acme     — match by WehowareClient.publicSlug (legacy)
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
 * Fields selected from WehowareClient for public API responses.
 * Shared across all public appointment endpoints.
 */
const CLIENT_SELECT = {
  id: true,
  active: true,
  companyName: true,
  publicSlug: true,
  domain: true,
  website: true,
  email: true,
  contactNumber: true,
  address: true,
};

/**
 * Resolve a client by domain, clientId, or publicSlug.
 * Returns null if not found, or { inactive: true, id } if inactive.
 *
 * @param {string|null} domain
 * @param {string|null} clientId
 * @param {string|null} publicSlug
 * @returns {Promise<object|null>}
 */
export async function resolvePublicClient(domain, clientId, publicSlug) {
  if (!domain && !clientId && !publicSlug) return null;

  const where = {};
  if (domain) where.domain = domain;
  else if (clientId) where.id = clientId;
  else if (publicSlug) where.publicSlug = publicSlug;

  const client = await prisma.wehowareClient.findFirst({
    where,
    select: CLIENT_SELECT,
  });

  if (!client) return null;
  if (!client.active) return { inactive: true, id: client.id };
  return client;
}

/**
 * Lookup client by public slug (legacy helper — kept for backward compat).
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
 * Extract client identifier from query params.
 * Priority: domain > clientId > client_slug
 * Returns { kind, value } or null.
 */
function extractClientParam(searchParams) {
  const domain = searchParams.get("domain")?.trim();
  if (domain) return { kind: "domain", value: domain };

  const clientId = searchParams.get("clientId")?.trim();
  if (clientId) return { kind: "clientId", value: clientId };

  const clientSlug = searchParams.get("client_slug")?.trim();
  if (clientSlug) return { kind: "client_slug", value: clientSlug };

  return null;
}

/**
 * withPublic — wraps a public route handler with:
 *   1. CORS preflight support
 *   2. Rate limiting keyed by client identifier + IP
 *   3. Client resolution from ?domain= / ?clientId= / ?client_slug= query param
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
    const clientParam = extractClientParam(url.searchParams);

    if (!clientParam) {
      return NextResponse.json(
        { error: "Missing required query parameter: domain, clientId, or client_slug" },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Rate limit by client + IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const rateKey = `${clientParam.kind}:${clientParam.value}:${ip}`;

    if (!checkRateLimit(rateKey)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: corsHeaders() }
      );
    }

    // Resolve client
    const client = await resolvePublicClient(
      clientParam.kind === "domain" ? clientParam.value : null,
      clientParam.kind === "clientId" ? clientParam.value : null,
      clientParam.kind === "client_slug" ? clientParam.value : null,
    );

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404, headers: corsHeaders() }
      );
    }

    if (client.inactive) {
      return NextResponse.json(
        { error: "Client is inactive" },
        { status: 403, headers: corsHeaders() }
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
