// tests/seo/api-suggestions-reject.test.mjs
// Integration tests for POST /api/v1/seo-analyser/suggestions/[id]/reject
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST as rejectSuggestion } from "@/app/api/v1/seo-analyser/suggestions/[id]/reject/route";
import { makeRequest, seedAdmin, expectStatus, __seed, __dump, __reset } from "../harness.mjs";
import { __setSession, __resetSession } from "../mocks/auth.mjs";

function seedNoClientContext({ userId = "user-admin-1", role = "admin" } = {}) {
  __reset();
  __resetSession();
  __seed("wehowareProfile", [{ id: userId, email: "admin@test.local", role, clientId: null }]);
  __setSession({ user: { id: userId, email: "admin@test.local", role } });
}

function seedSuggestionWithIssue(clientId, sugId = "sug-1", overrides = {}) {
  __seed("wehowareSeoAnalyserIssue", [
    { id: "issue-1", clientId, runId: "run-1", itemType: "blog", itemId: "blog-1", category: "meta", severity: "high", title: "Missing meta title", status: "open" },
  ]);
  __seed("wehowareSeoAnalyserSuggestion", [
    {
      id: sugId,
      issueId: "issue-1",
      clientId,
      fixType: "meta_title",
      fieldName: "metaTitle",
      suggestedValue: "Optimised Title",
      explanation: "Title is too short",
      status: "pending",
      ...overrides,
    },
  ]);
}

test("reject: 400 when no client context", async () => {
  seedNoClientContext();
  const res = await rejectSuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/sug-1/reject" }),
    { params: Promise.resolve({ id: "sug-1" }) }
  );
  expectStatus(res, 400);
});

test("reject: 404 when suggestion not found", async () => {
  const { clientId } = seedAdmin();
  const res = await rejectSuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/nonexistent/reject" }),
    { params: Promise.resolve({ id: "nonexistent" }) }
  );
  expectStatus(res, 404);
});

test("reject: marks suggestion as rejected and issue as dismissed", async () => {
  const { clientId, userId } = seedAdmin();
  seedSuggestionWithIssue(clientId, "sug-1");

  const res = await rejectSuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/sug-1/reject" }),
    { params: Promise.resolve({ id: "sug-1" }) }
  );
  expectStatus(res, 200);

  const body = await res.json();
  assert.equal(body.data.status, "rejected");
  assert.equal(body.data.rejectedBy, userId);
  assert.ok(body.data.rejectedAt, "rejectedAt should be set");

  // Verify issue is dismissed
  const issues = __dump("wehowareSeoAnalyserIssue");
  assert.equal(issues[0].status, "dismissed");
});

test("reject: cross-tenant suggestion returns 404", async () => {
  const { clientId } = seedAdmin();
  seedSuggestionWithIssue("other-client", "sug-1");
  const res = await rejectSuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/sug-1/reject" }),
    { params: Promise.resolve({ id: "sug-1" }) }
  );
  expectStatus(res, 404);
});
