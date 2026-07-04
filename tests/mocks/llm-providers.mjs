// tests/mocks/llm-providers.mjs
// Stub for @/lib/llm-providers/index — callLLM returns a canned response
// so the analyser pipeline can be imported without pulling in real provider deps.

export async function callLLM() {
  return {
    content: '{"issues":[],"suggestions":[]}',
    tokensUsed: 0,
    provider: "mock",
    model: "mock-model",
  };
}

export class AllProvidersExhaustedError extends Error {
  constructor(message = "All providers exhausted") {
    super(message);
    this.name = "AllProvidersExhaustedError";
  }
}
