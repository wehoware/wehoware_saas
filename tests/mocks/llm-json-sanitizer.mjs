// tests/mocks/llm-json-sanitizer.mjs
// Stub for @/lib/llm-providers/json-sanitizer

export function parseJsonResponse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
