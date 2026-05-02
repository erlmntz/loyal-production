/**
 * Loyal Production - HTML escape helper
 *
 * Single source of truth for escaping user/admin-controlled data
 * before injecting it into innerHTML. Used by both admin and user
 * scripts. Load this BEFORE any script that touches the DOM with
 * dynamic data.
 */
(function () {
  'use strict';
  window.LP = window.LP || {};
  window.LP.escapeHtml = function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
})();
