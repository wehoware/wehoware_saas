// tests/seo/lib-analyser-concurrency.test.mjs
// Unit tests for concurrency control and stale run cleanup in analyser.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanupStaleRuns } from "@/lib/seo-analyser/analyser";
import { __reset, __seed, __dump } from "../harness.mjs";

function seedRun(id, createdAt, overrides = {}) {
  __seed("wehowareSeoAnalyserRun", [
    {
      id,
      clientId: "client-1",
      contentType: "blog",
      contentId: "blog-1",
      status: "running",
      lockToken: "lock-123",
      ...overrides,
      createdAt,
    },
  ]);
}

test("cleanupStaleRuns: returns 0 when no stale runs", async () => {
  __reset();
  const count = await cleanupStaleRuns();
  assert.equal(count, 0);
});

test("cleanupStaleRuns: marks old running runs as failed", async () => {
  __reset();
  const staleDate = new Date(Date.now() - 35 * 60 * 1000); // 35 min ago
  const recentDate = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago

  seedRun("run-stale", staleDate);
  seedRun("run-recent", recentDate);

  const count = await cleanupStaleRuns();
  assert.equal(count, 1);

  const runs = __dump("wehowareSeoAnalyserRun");
  const stale = runs.find((r) => r.id === "run-stale");
  assert.equal(stale.status, "failed");
  assert.match(stale.errorMessage, /stale run cleanup/i);
  assert.ok(stale.completedAt, "completedAt should be set");
  assert.equal(stale.lockToken, null, "lockToken should be cleared");

  const recent = runs.find((r) => r.id === "run-recent");
  assert.equal(recent.status, "running", "recent run should still be running");
});

test("cleanupStaleRuns: respects custom threshold", async () => {
  __reset();
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

  seedRun("run-10m", tenMinAgo);

  // Default 30-min threshold should NOT mark 10-min run as stale
  const count1 = await cleanupStaleRuns();
  assert.equal(count1, 0);

  // 5-min threshold SHOULD mark it as stale
  const count2 = await cleanupStaleRuns(5 * 60 * 1000);
  assert.equal(count2, 1);
});

test("cleanupStaleRuns: does not touch completed or failed runs", async () => {
  __reset();
  const oldDate = new Date(Date.now() - 60 * 60 * 1000); // 60 min ago

  seedRun("run-completed", oldDate, { status: "completed", lockToken: null });
  seedRun("run-failed", oldDate, { status: "failed", lockToken: null });

  const count = await cleanupStaleRuns();
  assert.equal(count, 0);

  const runs = __dump("wehowareSeoAnalyserRun");
  assert.equal(runs[0].status, "completed");
  assert.equal(runs[1].status, "failed");
});

test("cleanupStaleRuns: handles multiple stale runs at once", async () => {
  __reset();
  const staleDate = new Date(Date.now() - 40 * 60 * 1000);

  seedRun("stale-1", staleDate, { contentId: "blog-1" });
  seedRun("stale-2", staleDate, { contentId: "blog-2" });
  seedRun("stale-3", staleDate, { contentId: "blog-3" });

  const count = await cleanupStaleRuns();
  assert.equal(count, 3);

  const runs = __dump("wehowareSeoAnalyserRun");
  assert.equal(runs.every((r) => r.status === "failed"), true);
  assert.equal(runs.every((r) => r.lockToken === null), true);
});
