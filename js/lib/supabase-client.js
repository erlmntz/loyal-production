/**
 * Loyal Production - Shared Supabase client
 *
 * Single source of truth for Supabase URL + anon key. Loaded on every page
 * that talks to the database (user-facing booking/availability pages and
 * the admin dashboard). Exposes `window.LP.supabase` once initialized.
 *
 * Requires `@supabase/supabase-js` to be loaded BEFORE this file.
 */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://wxiwknkeqgptjlhfcwnt.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_-QVYmHFZsMHzS7RjAUh5Zg_xtPsHoZg';
  const BOOKINGS_TABLE = 'bookings';

  window.LP = window.LP || {};

  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.error('[LP] Supabase JS library not loaded. Include @supabase/supabase-js before lib/supabase-client.js.');
    window.LP.supabase = null;
    window.LP.bookingsTable = BOOKINGS_TABLE;
    return;
  }

  window.LP.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.LP.bookingsTable = BOOKINGS_TABLE;
})();
