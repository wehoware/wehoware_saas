// tests/harness.mjs — shared helpers for API route tests.
import { __setSession, __resetSession } from "./mocks/auth.mjs";
import { prisma, __reset, __seed, __dump } from "./mocks/prisma.mjs";

/**
 * Build a fake Request object that matches what Next.js passes to route
 * handlers. Supports URL, method, body (as object), and cookies.
 */
export function makeRequest({
  url = "http://test.local/api/v1/resource",
  method = "GET",
  body,
  headers = {},
  cookies = {},
} = {}) {
  const cookieJar = {
    get(name) {
      return cookies[name] ? { value: cookies[name] } : undefined;
    },
  };
  return {
    url,
    method,
    headers: {
      get(name) {
        return headers[name] ?? null;
      },
    },
    cookies: cookieJar,
    async json() {
      if (body === undefined) {
        throw new SyntaxError("Empty body");
      }
      if (typeof body === "string") {
        try {
          return JSON.parse(body);
        } catch {
          throw new SyntaxError("Invalid JSON body");
        }
      }
      return body;
    },
  };
}

/**
 * Seed a standard user + client + access record so withAuth resolves an
 * active client automatically.
 */
export function seedAdmin({
  userId = "user-admin-1",
  clientId = "client-1",
  role = "admin",
  email = "admin@test.local",
} = {}) {
  __reset();
  __resetSession();
  __seed("wehowareProfile", [
    {
      id: userId,
      email,
      role,
      clientId: role === "client" ? clientId : null,
    },
  ]);
  __seed("wehowareClient", [{ id: clientId, name: "Test Client" }]);
  __seed("wehowareUserClient", [
    { userId, clientId, isPrimary: true, active: true, role },
  ]);
  __setSession({ user: { id: userId, email, role } });
  return { userId, clientId, role };
}

export { prisma, __seed, __reset, __dump };

/** Read the JSON body out of the mocked NextResponse. */
export async function readJson(res) {
  return res.json();
}

export function expectStatus(res, status, context = "") {
  if (res.status !== status) {
    throw new Error(
      `Expected status ${status} but got ${res.status}. ${context}\n` +
        `Body: ${JSON.stringify(res._body)}`
    );
  }
}
