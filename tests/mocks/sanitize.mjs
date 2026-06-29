// tests/mocks/sanitize.mjs
// Stubbed sanitizeHtml — just returns the input unchanged for tests.
export function sanitizeHtml(dirty) {
  return dirty ?? null;
}
