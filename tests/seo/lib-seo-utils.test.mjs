// tests/seo/lib-seo-utils.test.mjs
// Unit tests for SEO analyser utility functions (pure functions, no mocks needed)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stripHtml,
  extractHeadings,
  extractImages,
  extractLinks,
  countLists,
  countTables,
  countWords,
  validateSlug,
  filterInternalLinks,
  filterExternalLinks,
  hasFaqPattern,
  hasStepByStepPattern,
  truncate,
  uuid,
  keywordDensity,
  isHttps,
  hasMixedContent,
  countParagraphs,
  extractFaqs,
  extractJsonLd,
  countSentences,
  countSyllables,
} from "@/lib/seo-analyser/utils";

// ── stripHtml ──────────────────────────────────────────────────
test("stripHtml: strips tags and decodes entities", () => {
  assert.equal(stripHtml("<p>Hello &amp; <b>world</b></p>"), "Hello & world");
  assert.equal(stripHtml("<script>alert(1)</script><p>text</p>"), "text");
  assert.equal(stripHtml("<style>.x{}</style><p>text</p>"), "text");
  assert.equal(stripHtml(""), "");
  assert.equal(stripHtml(null), "");
  assert.equal(stripHtml("&nbsp;A&nbsp;B"), "A B");
});

// ── extractHeadings ────────────────────────────────────────────
test("extractHeadings: extracts h1-h6 with text", () => {
  const html = "<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>";
  const headings = extractHeadings(html);
  assert.equal(headings.length, 3);
  assert.equal(headings[0].level, 1);
  assert.equal(headings[0].text, "Title");
  assert.equal(headings[1].level, 2);
  assert.equal(headings[2].text, "Section");
});

test("extractHeadings: returns empty for no headings", () => {
  assert.deepEqual(extractHeadings("<p>No headings</p>"), []);
  assert.deepEqual(extractHeadings(""), []);
});

// ── extractImages ──────────────────────────────────────────────
test("extractImages: extracts src, alt, width, height", () => {
  const html = '<img src="/img.jpg" alt="Photo" width="100" height="50" loading="lazy">';
  const images = extractImages(html);
  assert.equal(images.length, 1);
  assert.equal(images[0].src, "/img.jpg");
  assert.equal(images[0].alt, "Photo");
  assert.equal(images[0].width, "100");
  assert.equal(images[0].height, "50");
  assert.equal(images[0].loading, "lazy");
});

test("extractImages: handles missing alt", () => {
  const images = extractImages('<img src="/img.jpg">');
  assert.equal(images[0].alt, null);
});

// ── extractLinks ───────────────────────────────────────────────
test("extractLinks: extracts href, text, rel, target", () => {
  const html = '<a href="/page" rel="nofollow" target="_blank">Link text</a>';
  const links = extractLinks(html);
  assert.equal(links.length, 1);
  assert.equal(links[0].href, "/page");
  assert.equal(links[0].text, "Link text");
  assert.equal(links[0].rel, "nofollow");
  assert.equal(links[0].target, "_blank");
});

// ── countLists / countTables ───────────────────────────────────
test("countLists: counts ul and ol", () => {
  assert.equal(countLists("<ul><li>a</li></ul><ol><li>b</li></ol>"), 2);
  assert.equal(countLists(""), 0);
});

test("countTables: counts table elements", () => {
  assert.equal(countTables("<table></table><table></table>"), 2);
  assert.equal(countTables(""), 0);
});

// ── countWords ─────────────────────────────────────────────────
test("countWords: counts words in HTML content", () => {
  assert.equal(countWords("<p>Hello world foo bar</p>"), 4);
  assert.equal(countWords(""), 0);
  assert.equal(countWords("<p></p>"), 0);
});

// ── validateSlug ───────────────────────────────────────────────
test("validateSlug: valid slug", () => {
  const result = validateSlug("my-great-blog-post");
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
});

test("validateSlug: detects missing slug", () => {
  const result = validateSlug("");
  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("missing_slug"));
});

test("validateSlug: detects uppercase", () => {
  const result = validateSlug("My-Blog-Post");
  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("url_uppercase"));
});

test("validateSlug: detects underscores", () => {
  const result = validateSlug("my_blog_post");
  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("url_underscores"));
});

test("validateSlug: detects special chars", () => {
  const result = validateSlug("my-blog@post");
  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("url_special_chars"));
});

test("validateSlug: detects too-long slug", () => {
  const result = validateSlug("a".repeat(76));
  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("url_too_long"));
});

// ── filterInternalLinks / filterExternalLinks ──────────────────
test("filterInternalLinks: filters relative and same-domain", () => {
  const links = [
    { href: "/about" },
    { href: "#section" },
    { href: "https://example.com/page" },
    { href: "https://other.com/page" },
  ];
  const internal = filterInternalLinks(links, "example.com");
  assert.equal(internal.length, 2);
  assert.equal(internal[0].href, "/about");
  assert.equal(internal[1].href, "https://example.com/page");
});

test("filterExternalLinks: filters http/https links", () => {
  const links = [
    { href: "/about" },
    { href: "https://example.com" },
    { href: "http://other.com" },
  ];
  const external = filterExternalLinks(links);
  assert.equal(external.length, 2);
});

// ── hasFaqPattern ──────────────────────────────────────────────
test("hasFaqPattern: detects FAQ text", () => {
  assert.equal(hasFaqPattern("<p>Frequently asked questions</p>"), true);
  assert.equal(hasFaqPattern("<p>FAQ section</p>"), true);
  assert.equal(hasFaqPattern("<h3>What is SEO?</h3><p>Answer</p>"), true);
  assert.equal(hasFaqPattern("<p>Regular content</p>"), false);
  assert.equal(hasFaqPattern(""), false);
});

// ── hasStepByStepPattern ───────────────────────────────────────
test("hasStepByStepPattern: detects how-to content", () => {
  assert.equal(hasStepByStepPattern("<ol><li>Step 1</li></ol>"), true);
  assert.equal(hasStepByStepPattern("<p>How to guide</p>"), true);
  assert.equal(hasStepByStepPattern("<p>Regular text</p>"), false);
  assert.equal(hasStepByStepPattern(""), false);
});

// ── truncate ───────────────────────────────────────────────────
test("truncate: truncates long text with ellipsis", () => {
  const long = "a".repeat(100);
  const result = truncate(long, 50);
  assert.equal(result.length, 53); // 50 + "..."
  assert.ok(result.endsWith("..."));
});

test("truncate: returns short text as-is", () => {
  assert.equal(truncate("short", 50), "short");
  assert.equal(truncate("", 50), "");
});

// ── uuid ───────────────────────────────────────────────────────
test("uuid: generates valid UUID v4 format", () => {
  const id = uuid();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("uuid: generates unique values", () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) ids.add(uuid());
  assert.equal(ids.size, 100);
});

// ── keywordDensity ─────────────────────────────────────────────
test("keywordDensity: calculates percentage", () => {
  const text = "seo is great because seo helps with seo ranking";
  const density = keywordDensity(text, "seo");
  assert.ok(density > 0);
  // "seo" appears 3 times out of 9 words = ~33.33%
  assert.ok(Math.abs(density - 33.33) < 1);
});

test("keywordDensity: returns 0 for empty inputs", () => {
  assert.equal(keywordDensity("", "seo"), 0);
  assert.equal(keywordDensity("some text", ""), 0);
});

// ── isHttps / hasMixedContent ──────────────────────────────────
test("isHttps: detects https URLs", () => {
  assert.equal(isHttps("https://example.com"), true);
  assert.equal(isHttps("http://example.com"), false);
  assert.equal(isHttps(""), false);
});

test("hasMixedContent: detects http resources in https page", () => {
  assert.equal(hasMixedContent('<img src="http://example.com/img.jpg">'), true);
  assert.equal(hasMixedContent('<img src="https://example.com/img.jpg">'), false);
  assert.equal(hasMixedContent(""), false);
});

// ── countParagraphs ────────────────────────────────────────────
test("countParagraphs: counts p tags", () => {
  assert.equal(countParagraphs("<p>One</p><p>Two</p><p>Three</p>"), 3);
  assert.equal(countParagraphs(""), 0);
});

// ── extractFaqs ────────────────────────────────────────────────
test("extractFaqs: extracts question-answer pairs", () => {
  const html = "<h3>What is SEO?</h3><p>SEO is search engine optimization.</p>";
  const faqs = extractFaqs(html);
  assert.equal(faqs.length, 1);
  assert.equal(faqs[0].question, "What is SEO?");
  assert.equal(faqs[0].answer, "SEO is search engine optimization.");
});

test("extractFaqs: returns empty for no FAQs", () => {
  assert.deepEqual(extractFaqs("<p>Regular content</p>"), []);
  assert.deepEqual(extractFaqs(""), []);
});

// ── extractJsonLd ──────────────────────────────────────────────
test("extractJsonLd: extracts and parses JSON-LD blocks", () => {
  const html = '<script type="application/ld+json">{"@type":"Article","name":"Test"}</script>';
  const blocks = extractJsonLd(html);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]["@type"], "Article");
});

test("extractJsonLd: skips invalid JSON", () => {
  const html = '<script type="application/ld+json">invalid json</script>';
  const blocks = extractJsonLd(html);
  assert.equal(blocks.length, 0);
});

// ── countSentences ─────────────────────────────────────────────
test("countSentences: counts sentence-ending punctuation", () => {
  assert.equal(countSentences("Hello world. This is a test! Right?"), 3);
  assert.equal(countSentences(""), 0);
  assert.equal(countSentences("No punctuation"), 1);
});

// ── countSyllables ─────────────────────────────────────────────
test("countSyllables: approximates syllable count", () => {
  assert.equal(countSyllables("the"), 1);
  assert.equal(countSyllables("apple"), 2);
  assert.equal(countSyllables(""), 0);
});
