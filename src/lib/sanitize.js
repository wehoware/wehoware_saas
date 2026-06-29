/**
 * src/lib/sanitize.js
 *
 * Server-side HTML sanitizer for TipTap-produced rich text.
 * Allows a safe subset of formatting tags while stripping scripts,
 * event handlers, and other XSS vectors.
 *
 * Usage:
 *   import { sanitizeHtml } from "@/lib/sanitize";
 *   const clean = sanitizeHtml(rawHtml);
 */
import htmlSanitizer from "sanitize-html";

const ALLOWED_TAGS = [
  "h1","h2","h3","h4","h5","h6",
  "p","br","hr",
  "strong","b","em","i","u","s","del","mark","sub","sup","code","pre","kbd",
  "blockquote",
  "ul","ol","li",
  "a",
  "img",
  "table","thead","tbody","tfoot","tr","th","td","caption",
  "figure","figcaption",
  "div","span",
];

const ALLOWED_ATTRIBUTES = {
  a: ["href", "name", "target", "rel", "title"],
  img: ["src", "alt", "title", "width", "height", "loading"],
  "*": ["class", "id", "style"],
  table: ["class", "id", "style", "data-align"],
  th: ["colspan", "rowspan", "scope"],
  td: ["colspan", "rowspan"],
};

const ALLOWED_SCHEMES = ["https", "http", "mailto", "tel", "/uploads", "data"];

export function sanitizeHtml(dirty) {
  if (!dirty || typeof dirty !== "string") return dirty ?? null;
  return htmlSanitizer(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesAppliedToAttributes: ["href", "src"],
    // Strip style attributes that contain expressions
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,6}$/i, /^rgb\(/, /^rgba\(/],
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
        "font-weight": [/^\d+$/, /^bold$/, /^normal$/],
        "font-style": [/^italic$/, /^normal$/],
        "text-decoration": [/^underline$/, /^line-through$/, /^none$/],
      },
    },
    disallowedTagsMode: "discard",
  });
}
