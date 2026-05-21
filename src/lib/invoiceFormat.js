/**
 * src/lib/invoiceFormat.js
 *
 * Client-safe date / currency helpers used across invoice UI.
 * Treats date-only strings as UTC midnight to avoid timezone shifts that
 * would otherwise display the previous day in negative-offset locales.
 */

const PLACEHOLDER = "—";
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format a date input as a localized date string.
 * Accepts ISO strings (YYYY-MM-DD), full ISO timestamps, or Date objects.
 * Uses UTC-based formatting to avoid timezone shifts that would display the wrong day.
 *
 * @param {string|Date|null|undefined} dateInput
 * @returns {string}
 */
export function formatInvoiceDate(dateInput) {
  if (!dateInput) return PLACEHOLDER;
  try {
    let date;
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === "string") {
      const normalized = ISO_DATE_ONLY.test(dateInput)
        ? `${dateInput}T00:00:00Z`
        : dateInput;
      date = new Date(normalized);
    } else {
      return PLACEHOLDER;
    }
    if (Number.isNaN(date.getTime())) return PLACEHOLDER;
    // Use UTC methods to avoid timezone shifts
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${month}/${day}/${year}`;
  } catch {
    return PLACEHOLDER;
  }
}

/**
 * Convert a Date or ISO timestamp into a YYYY-MM-DD string in UTC.
 * Returns "" if the value cannot be parsed.
 */
export function toIsoDateOnly(dateInput) {
  if (!dateInput) return "";
  try {
    let date;
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === "string") {
      if (ISO_DATE_ONLY.test(dateInput)) return dateInput;
      date = new Date(dateInput);
    } else {
      return "";
    }
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

/**
 * Format a number as `<currency> <amount>` with two decimals.
 */
export function formatCurrency(amount, currency = "") {
  const value = Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  return `${currency} ${safe.toFixed(2)}`.trim();
}
