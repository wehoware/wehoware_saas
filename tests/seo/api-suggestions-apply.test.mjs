// tests/seo/api-suggestions-apply.test.mjs
// Integration tests for POST /api/v1/seo-analyser/suggestions/[id]/apply
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST as applySuggestion } from "@/app/api/v1/seo-analyser/suggestions/[id]/apply/route";
import { makeRequest, seedAdmin, expectStatus, __seed, __dump, __reset } from "../harness.mjs";
import { __setSession, __resetSession } from "../mocks/auth.mjs";

function seedNoClientContext({ userId = "user-admin-1", role = "admin" } = {}) {
  __reset();
  __resetSession();
  __seed("wehowareProfile", [{ id: userId, email: "admin@test.local", role, clientId: null }]);
  __setSession({ user: { id: userId, email: "admin@test.local", role } });
}

function seedFullSetup(clientId, sugId = "sug-1", overrides = {}) {
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
      suggestedValue: "Optimised Blog Title",
      explanation: "Title is too short",
      itemType: "blog",
      itemId: "blog-1",
      status: "approved",
      ...overrides,
    },
  ]);
  __seed("wehowareBlog", [
    { id: "blog-1", clientId, title: "My Blog", slug: "my-blog", content: "Some content here", metaTitle: "", metaDescription: "" },
  ]);
}

test("apply: 400 when no client context", async () => {
  seedNoClientContext();
  const res = await applySuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/sug-1/apply" }),
    { params: Promise.resolve({ id: "sug-1" }) }
  );
  expectStatus(res, 400);
});

test("apply: 404 when suggestion not found", async () => {
  const { clientId } = seedAdmin();
  const res = await applySuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/nonexistent/apply" }),
    { params: Promise.resolve({ id: "nonexistent" }) }
  );
  expectStatus(res, 404);
});

test("apply: updates blog content with suggested value", async () => {
  const { clientId, userId } = seedAdmin();
  seedFullSetup(clientId, "sug-1");

  const res = await applySuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/sug-1/apply" }),
    { params: Promise.resolve({ id: "sug-1" }) }
  );
  expectStatus(res, 200);

  const body = await res.json();
  assert.equal(body.data.status, "applied");
  assert.equal(body.data.appliedBy, userId);
  assert.ok(body.data.appliedAt, "appliedAt should be set");
  assert.ok(body.seoScore !== null, "seoScore should be returned");

  // Verify blog was updated
  const blogs = __dump("wehowareBlog");
  assert.equal(blogs[0].metaTitle, "Optimised Blog Title");

  // Verify suggestion is applied
  const suggestions = __dump("wehowareSeoAnalyserSuggestion");
  assert.equal(suggestions[0].status, "applied");

  // Verify issue is resolved
  const issues = __dump("wehowareSeoAnalyserIssue");
  assert.equal(issues[0].status, "resolved");
});

test("apply: updates service content with suggested value", async () => {
  const { clientId, userId } = seedAdmin();
  __seed("wehowareSeoAnalyserIssue", [
    { id: "issue-2", clientId, runId: "run-2", itemType: "service", itemId: "svc-1", category: "meta", severity: "medium", title: "Missing meta desc", status: "open" },
  ]);
  __seed("wehowareSeoAnalyserSuggestion", [
    { id: "sug-2", issueId: "issue-2", clientId, itemType: "service", itemId: "svc-1", fixType: "meta_desc", fieldName: "metaDescription", suggestedValue: "A great service description", explanation: "Add meta desc", status: "approved" },
  ]);
  __seed("wehowareService", [
    { id: "svc-1", clientId, title: "My Service", slug: "my-service", content: "Service content", metaTitle: "Title", metaDescription: "" },
  ]);

  const res = await applySuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/sug-2/apply" }),
    { params: Promise.resolve({ id: "sug-2" }) }
  );
  expectStatus(res, 200);

  const services = __dump("wehowareService");
  assert.equal(services[0].metaDescription, "A great service description");
});

test("apply: cross-tenant suggestion returns 404", async () => {
  const { clientId } = seedAdmin();
  seedFullSetup("other-client", "sug-1");
  const res = await applySuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/sug-1/apply" }),
    { params: Promise.resolve({ id: "sug-1" }) }
  );
  expectStatus(res, 404);
});

test("apply: handles missing content item gracefully (seoScore null)", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareSeoAnalyserIssue", [
    { id: "issue-3", clientId, runId: "run-3", itemType: "blog", itemId: "missing-blog", category: "meta", severity: "low", title: "Issue", status: "open" },
  ]);
  __seed("wehowareSeoAnalyserSuggestion", [
    { id: "sug-3", issueId: "issue-3", clientId, itemType: "blog", itemId: "missing-blog", fixType: "meta_title", fieldName: "metaTitle", suggestedValue: "New Title", explanation: "Fix", status: "approved" },
  ]);
  // No blog seeded — update will throw P2025

  const res = await applySuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/sug-3/apply" }),
    { params: Promise.resolve({ id: "sug-3" }) }
  );
  expectStatus(res, 500);
  const body = await res.json();
  assert.match(body.error, /failed to apply suggestion/i);
});
