// tests/seo/api-suggestions-approve.test.mjs
// Integration tests for POST /api/v1/seo-analyser/suggestions/[id]/approve
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST as approveSuggestion } from "@/app/api/v1/seo-analyser/suggestions/[id]/approve/route";
import { makeRequest, seedAdmin, expectStatus, __seed, __dump, __reset } from "../harness.mjs";
import { __setSession, __resetSession } from "../mocks/auth.mjs";

function seedSuggestion(clientId, id = "sug-1", overrides = {}) {
  __seed("wehowareSeoAnalyserSuggestion", [
    {
      id,
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

function seedNoClientContext({ userId = "user-admin-1", role = "admin" } = {}) {
  __reset();
  __resetSession();
  __seed("wehowareProfile", [{ id: userId, email: "admin@test.local", role, clientId: null }]);
  __setSession({ user: { id: userId, email: "admin@test.local", role } });
}

test("approve: 400 when no client context", async () => {
  seedNoClientContext();
  const res = await approveSuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/sug-1/approve" }),
    { params: Promise.resolve({ id: "sug-1" }) }
  );
  expectStatus(res, 400);
  assert.match((await res.json()).error, /no client context/i);
});

test("approve: 404 when suggestion not found", async () => {
  const { clientId } = seedAdmin();
  const res = await approveSuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/nonexistent/approve" }),
    { params: Promise.resolve({ id: "nonexistent" }) }
  );
  expectStatus(res, 404);
});

test("approve: 404 when suggestion belongs to different client (cross-tenant)", async () => {
  const { clientId } = seedAdmin();
  seedSuggestion("other-client", "sug-1");
  const res = await approveSuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/sug-1/approve" }),
    { params: Promise.resolve({ id: "sug-1" }) }
  );
  expectStatus(res, 404);
});

test("approve: marks suggestion as approved with user id", async () => {
  const { clientId, userId } = seedAdmin();
  seedSuggestion(clientId, "sug-1");

  const res = await approveSuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/sug-1/approve" }),
    { params: Promise.resolve({ id: "sug-1" }) }
  );
  expectStatus(res, 200);

  const body = await res.json();
  assert.equal(body.data.status, "approved");
  assert.equal(body.data.approvedBy, userId);
  assert.ok(body.data.approvedAt, "approvedAt should be set");
});

test("approve: works for already-approved suggestion (idempotent)", async () => {
  const { clientId, userId } = seedAdmin();
  seedSuggestion(clientId, "sug-1", { status: "approved", approvedBy: "prev-user", approvedAt: new Date() });

  const res = await approveSuggestion(
    makeRequest({ method: "POST", url: "http://test.local/api/v1/seo-analyser/suggestions/sug-1/approve" }),
    { params: Promise.resolve({ id: "sug-1" }) }
  );
  expectStatus(res, 200);
  const body = await res.json();
  assert.equal(body.data.status, "approved");
  assert.equal(body.data.approvedBy, userId);
});
