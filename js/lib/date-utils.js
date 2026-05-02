/**
 * Loyal Production - Shared date helpers
 *
 * The `bookings.event_date` column historically stored values formatted by
 * Flatpickr ("F j, Y" -> "March 11, 2026"). Going forward we write ISO
 * "YYYY-MM-DD" strings so the calendar can do exact lookups, but old rows
 * still carry the human-readable format. These helpers normalise both
 * shapes to a single canonical "YYYY-MM-DD" string.
 *
 * Exposes `window.LP.dates`.
 */
(function () {
  'use strict';

  window.LP = window.LP || {};

  /** Pad a number to two digits. */
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  /** Format a Date instance as "YYYY-MM-DD" using local time. */
  function toISO(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  /**
   * Parse a stored event_date value (either ISO "YYYY-MM-DD" or legacy
   * "March 11, 2026") into a canonical ISO string. Returns null if it
   * cannot be parsed.
   */
  function normalizeEventDate(value) {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : toISO(parsed);
  }

  /**
   * Format an event_date (in either supported shape) as a friendly string
   * such as "March 11, 2026". Returns the original value if unparseable.
   */
  function formatLong(value) {
    if (!value) return '';
    const iso = normalizeEventDate(value);
    if (!iso) return String(value);
    // Anchor at noon to avoid TZ off-by-one.
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /** Today's local date as ISO "YYYY-MM-DD". */
  function todayISO() {
    return toISO(new Date());
  }

  window.LP.dates = {
    pad2,
    toISO,
    normalizeEventDate,
    formatLong,
    todayISO,
  };
})();
