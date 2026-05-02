/**
 * Loyal Production - Booking status lookup (user side)
 *
 * Lets a customer enter their email and view all bookings they have
 * submitted, with the current admin status (pending / accepted /
 * declined / completed). Pre-fills the email from the `?email=` query
 * param when redirected from the booking confirmation.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const supabase = window.LP && window.LP.supabase;
    const dates = window.LP && window.LP.dates;
    const tableName = (window.LP && window.LP.bookingsTable) || 'bookings';

    const form = document.getElementById('lookup-form');
    const emailInput = document.getElementById('lookup-email');
    const resultsDiv = document.getElementById('lookup-results');

    if (!form || !emailInput || !resultsDiv) return;

    const params = new URLSearchParams(window.location.search);
    const prefill = params.get('email');
    if (prefill) emailInput.value = prefill;

    function statusBadge(status) {
      const s = (status || 'pending').toLowerCase();
      const labels = {
        pending: 'Pending review',
        accepted: 'Accepted',
        declined: 'Declined',
        completed: 'Completed',
        cancelled: 'Cancelled',
      };
      return `<span class="status-badge status-${s}">${labels[s] || s}</span>`;
    }

    function renderRow(row) {
      const eventLabel =
        row.event_type === 'other' && row.other_event_type
          ? row.other_event_type
          : row.event_type;
      const created = row.created_at
        ? new Date(row.created_at).toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })
        : '';
      const reason = row.decline_reason
        ? `<p class="status-reason"><strong>Reason:</strong> ${row.decline_reason}</p>`
        : '';
      return `
        <article class="status-card">
          <header>
            <h3>${eventLabel || 'Event'} &middot; ${row.service_type || ''}</h3>
            ${statusBadge(row.status)}
          </header>
          <p><strong>Event date:</strong> ${dates.formatLong(row.event_date) || '—'}</p>
          ${row.venue ? `<p><strong>Venue:</strong> ${row.venue}</p>` : ''}
          <p class="status-meta">Submitted ${created}</p>
          ${reason}
        </article>`;
    }

    async function lookup(email) {
      if (!supabase) {
        resultsDiv.innerHTML =
          '<p class="form-msg form-msg-error">Booking system unavailable. Please try again later.</p>';
        return;
      }
      resultsDiv.innerHTML = '<p class="form-msg form-msg-info">Looking up your bookings...</p>';
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('email', email)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (!data || !data.length) {
          resultsDiv.innerHTML =
            '<p class="form-msg form-msg-info">No bookings found for that email. If you just submitted a request, please try again in a few seconds.</p>';
          return;
        }
        resultsDiv.innerHTML = data.map(renderRow).join('');
      } catch (err) {
        console.error('[status] Lookup failed:', err);
        resultsDiv.innerHTML = `<p class="form-msg form-msg-error">Could not load bookings: ${err.message}</p>`;
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = emailInput.value.trim().toLowerCase();
      if (!email) return;
      lookup(email);
    });

    if (prefill) lookup(prefill.trim().toLowerCase());
  });
})();
