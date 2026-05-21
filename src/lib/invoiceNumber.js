/**
 * src/lib/invoiceNumber.js
 *
 * Pure utility for rendering invoice numbers from a user-defined format string.
 * Server-only — but free of node-specific imports, so it can be reused in
 * unit tests / scripts. No side effects.
 *
 * Supported placeholders:
 *   {YYYY} — 4-digit year   (e.g. 2026)
 *   {YY}   — 2-digit year   (e.g. 26)
 *   {MM}   — 2-digit month  (01–12)
 *   {DD}   — 2-digit day    (01–31)
 *   {X+}   — sequence number padded to the count of X's (e.g. {XXXX} -> 0001)
 *
 * Example:
 *   formatInvoiceNumber("INV-{YYYY}-{XXXX}", 42, new Date(2026, 3, 25))
 *     -> "INV-2026-0042"
 */

export const DEFAULT_INVOICE_FORMAT = "INV-{YYYY}-{XXXX}";
const SEQUENCE_PATTERN = /\{(X+)\}/g;
const REQUIRED_TOKEN = "{X";

/**
 * Validate that a format string contains a sequence placeholder.
 * Returns true when the format includes at least one {X+} token.
 */
export function isValidInvoiceFormat(format) {
  if (typeof format !== "string") return false;
  if (format.trim().length === 0) return false;
  if (format.length > 100) return false;
  return format.includes(REQUIRED_TOKEN);
}

/**
 * Render an invoice number from a format template.
 *
 * @param {string} format    template (e.g. "INV-{YYYY}-{XXXX}")
 * @param {number} sequence  positive integer sequence number
 * @param {Date}   [date]    date to derive year/month/day (defaults to now)
 * @returns {string} rendered invoice number
 */
export function formatInvoiceNumber(format, sequence, date = new Date()) {
  const safeFormat = isValidInvoiceFormat(format) ? format : DEFAULT_INVOICE_FORMAT;
  const safeSequence = Number.isFinite(sequence) && sequence > 0
    ? Math.floor(sequence)
    : 1;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return safeFormat
    .replaceAll("{YYYY}", String(year))
    .replaceAll("{YY}", String(year).slice(-2))
    .replaceAll("{MM}", month)
    .replaceAll("{DD}", day)
    .replace(SEQUENCE_PATTERN, (_match, xs) =>
      String(safeSequence).padStart(xs.length, "0")
    );
}
