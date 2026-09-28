/**
 * src/lib/date-utils.js
 *
 * Timezone-safe helpers for @db.Date fields.
 *
 * Prisma serializes @db.Date columns as "YYYY-MM-DDT00:00:00.000Z".
 * Passing that through `new Date(...).toLocaleDateString()` shifts the
 * displayed day backward for users in UTC-negative timezones (and the
 * UTC getters shift the *default* date for users ahead of UTC).
 * Always work with the "YYYY-MM-DD" prefix directly, or with local
 * getters on a Date object — never mix the two.
 */

/**
 * Normalize any date input to a "YYYY-MM-DD" string.
 * - Date object → local calendar date
 * - "YYYY-MM-DD..." string → the leading date part (no TZ math)
 * - anything else parseable → local calendar date
 * Returns "" for empty/invalid input.
 */
export function toLocalISODate(input) {
  if (!input) return "";
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return "";
    return formatDateParts(input.getFullYear(), input.getMonth() + 1, input.getDate());
  }
  const s = String(input).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return formatDateParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Format a date-only value ("YYYY-MM-DD" or ISO string) for display
 * without timezone drift.
 */
export function formatDateOnly(dateStr, options) {
  const iso = toLocalISODate(dateStr);
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(
    "en-US",
    options ?? { year: "numeric", month: "short", day: "numeric" }
  );
}

function formatDateParts(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Format an "HH:MM" 24h string (or an ISO timestamp carrying one) as
 * "9:30 AM". Returns "—" for empty/invalid input.
 */
export function formatTime12h(value) {
  if (!value) return "—";
  const s = String(value);
  const m = s.includes("T") ? s.slice(11, 16) : s.slice(0, 5);
  const parts = m.match(/^(\d{1,2}):(\d{2})/);
  if (!parts) return "—";
  const h = Number(parts[1]);
  if (h > 23) return "—";
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${parts[2]} ${period}`;
}

/**
 * Format a fractional hour count as "2h 30m" / "45m".
 */
export function formatDuration(hours) {
  const total = Math.round(Number(hours) * 60);
  if (!Number.isFinite(total) || total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
