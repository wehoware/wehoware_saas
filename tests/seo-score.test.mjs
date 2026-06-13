import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSeoScore, normalizeTargetKeywords } from "@/lib/seoScore.js";

test("computeSeoScore returns 0 for null/undefined data", () => {
  assert.equal(computeSeoScore(null), 0);
  assert.equal(computeSeoScore(undefined), 0);
});

test("computeSeoScore returns 0 for empty object", () => {
  assert.equal(computeSeoScore({}), 0);
});

test("computeSeoScore awards 20 pts for optimal meta title length", () => {
  const data = { metaTitle: "A".repeat(55) };
  assert.equal(computeSeoScore(data), 20);
});

test("computeSeoScore awards 10 pts for non-optimal but present meta title", () => {
  const data = { metaTitle: "Short" };
  assert.equal(computeSeoScore(data), 10);
});

test("computeSeoScore awards 20 pts for optimal meta description length", () => {
  const data = { metaDescription: "A".repeat(155) };
  assert.equal(computeSeoScore(data), 20);
});

test("computeSeoScore awards 10 pts for non-optimal but present meta description", () => {
  const data = { metaDescription: "Short desc" };
  assert.equal(computeSeoScore(data), 10);
});

test("computeSeoScore awards 10 pts for meta keywords", () => {
  const data = { metaKeywords: "keyword1, keyword2" };
  assert.equal(computeSeoScore(data), 10);
});

test("computeSeoScore awards 10 pts for target keywords array", () => {
  const data = { targetKeywords: ["seo", "marketing"] };
  assert.equal(computeSeoScore(data), 10);
});

test("computeSeoScore awards 8 pts for thumbnail", () => {
  const data = { thumbnail: "https://example.com/image.jpg" };
  assert.equal(computeSeoScore(data), 8);
});

test("computeSeoScore awards 7 pts for thumbnail alt", () => {
  const data = { thumbnailAlt: "Alt text" };
  assert.equal(computeSeoScore(data), 7);
});

test("computeSeoScore awards 15 pts for complete OG fields", () => {
  const data = {
    openGraphTitle: "OG Title",
    openGraphDescription: "OG Description",
    openGraphImage: "https://example.com/og.jpg",
  };
  assert.equal(computeSeoScore(data), 15);
});

test("computeSeoScore does not award OG points when any field is missing", () => {
  const data = {
    openGraphTitle: "OG Title",
    openGraphDescription: "OG Description",
  };
  assert.equal(computeSeoScore(data), 0);
});

test("computeSeoScore awards 10 pts for slug", () => {
  const data = { slug: "my-awesome-post" };
  assert.equal(computeSeoScore(data), 10);
});

test("computeSeoScore awards 10 pts for content over 300 chars", () => {
  const data = { content: "A".repeat(301) };
  assert.equal(computeSeoScore(data), 10);
});

test("computeSeoScore uses description as fallback for content length", () => {
  const data = { description: "B".repeat(301) };
  assert.equal(computeSeoScore(data), 10);
});

test("computeSeoScore caps at 100", () => {
  const data = {
    metaTitle: "A".repeat(55),
    metaDescription: "B".repeat(155),
    metaKeywords: "kw1, kw2",
    thumbnail: "https://example.com/img.jpg",
    thumbnailAlt: "alt",
    openGraphTitle: "OG",
    openGraphDescription: "OG Desc",
    openGraphImage: "https://example.com/og.jpg",
    slug: "slug",
    content: "C".repeat(301),
  };
  assert.equal(computeSeoScore(data), 100);
});

test("normalizeTargetKeywords returns empty array for null/undefined", () => {
  assert.deepEqual(normalizeTargetKeywords(null), []);
  assert.deepEqual(normalizeTargetKeywords(undefined), []);
});

test("normalizeTargetKeywords filters empty and whitespace-only strings from array", () => {
  assert.deepEqual(normalizeTargetKeywords(["a", "", "b", " "]), ["a", "b"]);
});

test("normalizeTargetKeywords splits comma-separated string", () => {
  assert.deepEqual(normalizeTargetKeywords("a, b, c"), ["a", "b", "c"]);
});

test("normalizeTargetKeywords trims whitespace", () => {
  assert.deepEqual(normalizeTargetKeywords("  a  ,  b  "), ["a", "b"]);
});
