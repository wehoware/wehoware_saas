// tests/seo/api-suggestions-batch-apply.test.mjs
// Integration tests for POST /api/v1/seo-analyser/suggestions/batch-apply
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST as batchApply } from "@/app/api/v1/seo-analyser/suggestions/batch-apply/route";
import { makeRequest, seedAdmin, expectStatus, __seed, __dump, __reset } from "../harness.mjs";
import { __setSession, __resetSession } from "../mocks/auth.mjs";

function seedNoClientContext({ userId = "user-admin-1", role = "admin" } = {}) {
  __reset();
  __resetSession();
  __seed("wehowareProfile", [{ id: userId, email: "admin@test.local", role, clientId: null }]);
  __setSession({ user: { id: userId, email: "admin@test.local", role } });
}

function seedSuggestions(clientId) {
  __seed("wehowareSeoAnalyserIssue", [
    { id: "issue-1", clientId, runId: "run-1", itemType: "blog", itemId: "blog-1", category: "meta", severity: "high", title: "Missing title", status: "open" },
    { id: "issue-2", clientId, runId: "run-1", itemType: "blog", itemId: "blog-1", category: "content", severity: "medium", title: "Short content", status: "open" },
  ]);
  __seed("wehowareSeoAnalyserSuggestion", [
    { id: "sug-1", issueId: "issue-1", clientId, itemType: "blog", itemId: "blog-1", fixType: "meta_title", fieldName: "metaTitle", suggestedValue: "Optimised Title", explanation: "Fix title", status: "pending" },
    { id: "sug-2", issueId: "issue-2", clientId, itemType: "blog", itemId: "blog-1", fixType: "content", fieldName: "content", suggestedValue: "Longer content here", explanation: "Add content", status: "pending" },
    { id: "sug-3", issueId: "issue-1", clientId, itemType: "blog", itemId: "blog-1", fixType: "other", fieldName: "metaDescription", suggestedValue: "A meta desc", explanation: "Fix desc", status: "approved" },
  ]);
  __seed("wehowareBlog", [
    { id: "blog-1", clientId, title: "My Blog", slug: "my-blog", content: "Short", metaTitle: "", metaDescription: "" },
  ]);
}

test("batch-apply: 400 when no client context", async () => {
  seedNoClientContext();
  const res = await batchApply(
    makeRequest({ method: "POST", body: { suggestionIds: ["sug-1"] } }),
    {}
  );
  expectStatus(res, 400);
});

test("batch-apply: 400 when suggestionIds missing", async () => {
  const { clientId } = seedAdmin();
  const res = await batchApply(
    makeRequest({ method: "POST", body: {} }),
    {}
  );
  expectStatus(res, 400);
});

test("batch-apply: 400 when suggestionIds is empty array", async () => {
  const { clientId } = seedAdmin();
  const res = await batchApply(
    makeRequest({ method: "POST", body: { suggestionIds: [] } }),
    {}
  );
  expectStatus(res, 400);
});

test("batch-apply: 404 when no matching pending suggestions", async () => {
  const { clientId } = seedAdmin();
  seedSuggestions(clientId);
  // sug-3 is "approved", not "pending" — only pending are eligible
  const res = await batchApply(
    makeRequest({ method: "POST", body: { suggestionIds: ["sug-3"] } }),
    {}
  );
  expectStatus(res, 404);
});

test("batch-apply: applies multiple pending suggestions", async () => {
  const { clientId, userId } = seedAdmin();
  seedSuggestions(clientId);

  const res = await batchApply(
    makeRequest({ method: "POST", body: { suggestionIds: ["sug-1", "sug-2"] } }),
    {}
  );
  expectStatus(res, 200);

  const body = await res.json();
  assert.equal(body.applied, 2);
  assert.equal(body.failed, 0);
  assert.equal(body.data.length, 2);
  assert.equal(body.data[0].status, "applied");
  assert.equal(body.data[1].status, "applied");

  // Verify blog content was updated
  const blogs = __dump("wehowareBlog");
  assert.equal(blogs[0].metaTitle, "Optimised Title");
  assert.equal(blogs[0].content, "Longer content here");

  // Verify suggestions are applied
  const suggestions = __dump("wehowareSeoAnalyserSuggestion");
  const applied = suggestions.filter((s) => s.status === "applied");
  assert.equal(applied.length, 2);

  // Verify issues are resolved
  const issues = __dump("wehowareSeoAnalyserIssue");
  assert.equal(issues[0].status, "resolved");
  assert.equal(issues[1].status, "resolved");

  // Verify score updates were computed
  assert.ok(body.scoreUpdates.length > 0, "scoreUpdates should have entries");
});

test("batch-apply: only applies suggestions for current client (cross-tenant isolation)", async () => {
  const { clientId } = seedAdmin();
  // Seed suggestions for a different client
  __seed("wehowareSeoAnalyserSuggestion", [
    { id: "sug-other", issueId: "issue-x", clientId: "other-client", fixType: "meta_title", fieldName: "metaTitle", suggestedValue: "Hack", explanation: "test", status: "pending" },
  ]);

  const res = await batchApply(
    makeRequest({ method: "POST", body: { suggestionIds: ["sug-other"] } }),
    {}
  );
  expectStatus(res, 404);
});

test("batch-apply: handles mixed success and failure", async () => {
  const { clientId } = seedAdmin();
  __seed("wehowareSeoAnalyserIssue", [
    { id: "issue-1", clientId, runId: "run-1", itemType: "blog", itemId: "blog-1", category: "meta", severity: "high", title: "Issue 1", status: "open" },
    { id: "issue-2", clientId, runId: "run-1", itemType: "blog", itemId: "missing-blog", category: "meta", severity: "high", title: "Issue 2", status: "open" },
  ]);
  __seed("wehowareSeoAnalyserSuggestion", [
    { id: "sug-ok", issueId: "issue-1", clientId, itemType: "blog", itemId: "blog-1", fixType: "meta_title", fieldName: "metaTitle", suggestedValue: "Good Title", explanation: "Fix", status: "pending" },
    { id: "sug-fail", issueId: "issue-2", clientId, itemType: "blog", itemId: "missing-blog", fixType: "meta_title", fieldName: "metaTitle", suggestedValue: "Bad Title", explanation: "Fix", status: "pending" },
  ]);
  __seed("wehowareBlog", [
    { id: "blog-1", clientId, title: "Blog", slug: "blog", content: "Content", metaTitle: "", metaDescription: "" },
  ]);

  const res = await batchApply(
    makeRequest({ method: "POST", body: { suggestionIds: ["sug-ok", "sug-fail"] } }),
    {}
  );
  expectStatus(res, 200);

  const body = await res.json();
  assert.equal(body.applied, 1);
  assert.equal(body.failed, 1);
  assert.equal(body.data.length, 2);

  const failed = body.data.find((r) => r.status === "failed");
  assert.ok(failed, "should have a failed entry");
  assert.ok(failed.error, "failed entry should have error message");
});
