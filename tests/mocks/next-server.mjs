// tests/mocks/next-server.mjs
// Minimal in-memory stand-in for `next/server` that matches the shape our
// handlers use: NextResponse.json(body, init).
export const NextResponse = {
  json(body, init = {}) {
    const status = init.status ?? 200;
    const headers = { "content-type": "application/json", ...(init.headers ?? {}) };
    return {
      status,
      headers,
      ok: status >= 200 && status < 300,
      async json() {
        // Deep-clone so tests never observe handler-side mutations.
        return JSON.parse(JSON.stringify(body));
      },
      _body: body, // handy for assertions without awaiting
    };
  },
};
