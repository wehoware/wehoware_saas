import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/v1/plaid/link-token/route";
import { __setPlaidClientForTests } from "@/lib/plaid/client";
import { makeRequest, seedAdmin } from "../harness.mjs";

test("POST /api/v1/plaid/link-token returns link_token for admin", async () => {
  seedAdmin();
  __setPlaidClientForTests({
    async linkTokenCreate(input) {
      assert.equal(input.client_name, "Wehoware");
      assert.match(input.user.client_user_id, /^client-1:/);
      return { data: { link_token: "link-sandbox-abc", expiration: "2026-01-01T00:00:00Z" } };
    },
  });
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/link-token",
    method: "POST",
  });
  const res = await POST(req, { params: Promise.resolve({}) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.link_token, "link-sandbox-abc");
  __setPlaidClientForTests(null);
});

test("POST /api/v1/plaid/link-token bubbles up Plaid errors", async () => {
  seedAdmin();
  __setPlaidClientForTests({
    async linkTokenCreate() {
      const err = new Error("plaid down");
      err.response = { data: { error_message: "INTERNAL_SERVER_ERROR" } };
      throw err;
    },
  });
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/link-token",
    method: "POST",
  });
  const res = await POST(req, { params: Promise.resolve({}) });
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.match(body.error, /Failed to create Plaid link token/);
  __setPlaidClientForTests(null);
});

test("POST /api/v1/plaid/link-token requires authentication", async () => {
  const { __resetSession } = await import("../mocks/auth.mjs");
  __resetSession();
  const req = makeRequest({
    url: "http://test.local/api/v1/plaid/link-token",
    method: "POST",
  });
  const res = await POST(req, { params: Promise.resolve({}) });
  assert.equal(res.status, 401);
});
