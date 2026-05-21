// tests/mocks/auth.mjs
// Stubbed NextAuth `auth()` — tests configure the active session via
// __setSession(). Everything else returned from "@/lib/auth" is a no-op shim
// the route handlers don't actually call.

let _session = null;

export function __setSession(session) {
  _session = session;
}

export function __resetSession() {
  _session = null;
}

export async function auth() {
  return _session;
}

export const GET = () => {};
export const POST = () => {};
export const handlers = { GET, POST };
export const signIn = async () => {};
export const signOut = async () => {};
