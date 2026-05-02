/**
 * Loyal Production - Admin dashboard
 *
 * Loads all bookings from Supabase once, then renders four views:
 *   - Dashboard      : stat cards + recent-bookings preview
 *   - Request booking: pending requests with Accept / Decline actions
 *   - Accepted       : confirmed bookings (View)
 *   - Declined       : declined requests with reason (Restore option)
 *   - Event          : upcoming accepted events with "Mark completed" / "Cancel"
 *
 * Subscribes to Supabase realtime so changes from the user side
 * (or other admin tabs) refresh the views automatically.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const supabase = window.LP && window.LP.supabase;
    const dates = window.LP && window.LP.dates;
    const tableName = (window.LP && window.LP.bookingsTable) || 'bookings';

    if (!supabase) {
      console.error('[admin] Supabase client unavailable.');
      return;
    }

    // ---------- DOM ----------
    const navItems = document.querySelectorAll('.sidebar-nav li');
    const sections = document.querySelectorAll('.content-section');

    const requestBody = document.getElementById('bookings-body');
    const acceptedBody = document.getElementById('accepted-body');
    const declinedBody = document.getElementById('declined-body');
    const eventBody = document.getElementById('event-body');
    const recentBody = document.querySelector('#recent-bookings tbody');

    const requestSearch = document.getElementById('search-bookings');
    const acceptedSearch = document.getElementById('search-accepted');
    const declinedSearch = document.getElementById('search-declined');
    const eventSearch = document.getElementById('search-event');

    const refreshBtns = {
      bookings: document.getElementById('refresh-bookings'),
      accepted: document.getElementById('refresh-accepted'),
      declined: document.getElementById('refresh-declined'),
      event: document.getElementById('refresh-event'),
    };

    const stats = {
      request: document.getElementById('request-booking-count'),
      accepted: document.getElementById('accepted-booking-count'),
      week: document.getElementById('incoming-week-count'),
      month: document.getElementById('incoming-month-count'),
      year: document.getElementById('incoming-year-count'),
    };

    const detailsModal = document.getElementById('bookingModal');
    const detailsBody = document.getElementById('modal-body');
    const declineModal = document.getElementById('declineReasonModal');
    const declineReasonInput = document.getElementById('declineReason');

    // ---------- State ----------
    let allBookings = [];
    let currentDeclineId = null;
    const search = { request: '', accepted: '', declined: '', event: '' };

    // ---------- Helpers ----------
    const escapeHtml = (window.LP && window.LP.escapeHtml) || function (v) {
      return v == null ? '' : String(v);
    };

    function eventLabel(b) {
      if (b.event_type === 'other' && b.other_event_type) return b.other_event_type;
      return b.event_type || '';
    }

    function formatTimestamp(value) {
      if (!value) return 'N/A';
      try {
        return new Date(value).toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
      } catch (_) {
        return 'N/A';
      }
    }

    function statusBadge(status) {
      const s = (status || 'pending').toLowerCase();
      return `<span class="status-badge status-${s}">${escapeHtml(s)}</span>`;
    }

    function eventDateObj(b) {
      const iso = dates.normalizeEventDate(b.event_date);
      return iso ? new Date(`${iso}T12:00:00`) : null;
    }

    function matchesSearch(b, query) {
      if (!query) return true;
      const q = query.toLowerCase();
      return [
        b.name, b.email, b.phone, b.venue, b.service_type,
        b.event_type, b.other_event_type, b.message, b.decline_reason,
        dates.formatLong(b.event_date),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    }

    // ---------- Data ----------
    async function loadBookings() {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        allBookings = data || [];
        renderAll();
      } catch (err) {
        console.error('[admin] Failed to load bookings:', err);
        const msg = err.code === '42501' || /permission denied/i.test(err.message || '')
          ? 'Permission denied. Add a SELECT policy for anon users on the bookings table.'
          : err.message || 'Failed to load bookings';
        const errorRow = `<tr><td colspan="6" style="color:red; text-align:center;">${escapeHtml(msg)}</td></tr>`;
        if (requestBody) requestBody.innerHTML = errorRow;
        if (acceptedBody) acceptedBody.innerHTML = errorRow;
        if (declinedBody) declinedBody.innerHTML = errorRow;
        if (eventBody) eventBody.innerHTML = errorRow;
        if (recentBody) recentBody.innerHTML = '';
        Object.values(stats).forEach((el) => { if (el) el.textContent = '0'; });
      }
    }

    async function updateStatus(id, status, reason) {
      try {
        const update = { status };
        if (reason) update.decline_reason = reason;
        if (status !== 'declined') update.decline_reason = null;
        const { error } = await supabase
          .from(tableName)
          .update(update)
          .eq('id', id);
        if (error) {
          if (reason && /decline_reason/.test(error.message || '')) {
            throw new Error(
              'Missing column "decline_reason". Add it in Supabase: ALTER TABLE bookings ADD COLUMN decline_reason text;'
            );
          }
          throw error;
        }
        await loadBookings();
      } catch (err) {
        console.error('[admin] Update failed:', err);
        alert('Failed to update status: ' + err.message);
      }
    }

    // ---------- Render ----------
    function renderAll() {
      renderStats();
      renderRecent();
      renderRequest();
      renderAccepted();
      renderDeclined();
      renderEvent();
    }

    function renderStats() {
      const pending = allBookings.filter((b) => !b.status || b.status === 'pending');
      const accepted = allBookings.filter((b) => b.status === 'accepted');
      if (stats.request) stats.request.textContent = pending.length;
      if (stats.accepted) stats.accepted.textContent = accepted.length;

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const in7 = new Date(today); in7.setDate(today.getDate() + 7);
      const in30 = new Date(today); in30.setDate(today.getDate() + 30);
      const in365 = new Date(today); in365.setDate(today.getDate() + 365);

      let week = 0, month = 0, year = 0;
      accepted.forEach((b) => {
        const d = eventDateObj(b);
        if (!d || d < today) return;
        if (d < in7) week++;
        if (d < in30) month++;
        if (d < in365) year++;
      });
      if (stats.week) stats.week.textContent = week;
      if (stats.month) stats.month.textContent = month;
      if (stats.year) stats.year.textContent = year;
    }

    function renderRecent() {
      if (!recentBody) return;
      const rows = allBookings.slice(0, 5).map((b) => `
        <tr>
          <td>${escapeHtml(b.name) || 'N/A'}</td>
          <td>${escapeHtml(eventLabel(b)) || 'N/A'}</td>
          <td>${escapeHtml(dates.formatLong(b.event_date)) || 'N/A'}</td>
        </tr>`).join('');
      recentBody.innerHTML = rows || '<tr><td colspan="3">No bookings yet.</td></tr>';
    }

    function tableRow(b, actionsHtml) {
      return `
        <tr>
          <td>${escapeHtml(formatTimestamp(b.created_at))}</td>
          <td>${escapeHtml(b.name) || 'N/A'}</td>
          <td>${escapeHtml(b.email) || 'N/A'}</td>
          <td>${escapeHtml(eventLabel(b)) || 'N/A'}</td>
          <td>${escapeHtml(b.service_type) || 'N/A'}</td>
          <td>${actionsHtml}</td>
        </tr>`;
    }

    function viewBtn(b) {
      const safeId = encodeURIComponent(b.id);
      return `<button class="btn-view" data-action="view" data-id="${safeId}"><i class="bi bi-eye"></i> View</button>`;
    }

    function renderRequest() {
      if (!requestBody) return;
      const rows = allBookings
        .filter((b) => !b.status || b.status === 'pending')
        .filter((b) => matchesSearch(b, search.request));
      if (!rows.length) {
        requestBody.innerHTML = '<tr><td colspan="6">No pending bookings found.</td></tr>';
        return;
      }
      requestBody.innerHTML = rows.map((b) => tableRow(b, `
        ${viewBtn(b)}
        <button class="btn-accept" data-action="accept" data-id="${encodeURIComponent(b.id)}"><i class="bi bi-check-lg"></i> Accept</button>
        <button class="btn-decline" data-action="decline" data-id="${encodeURIComponent(b.id)}"><i class="bi bi-x-lg"></i> Decline</button>
      `)).join('');
    }

    function renderAccepted() {
      if (!acceptedBody) return;
      const rows = allBookings
        .filter((b) => b.status === 'accepted')
        .filter((b) => matchesSearch(b, search.accepted));
      if (!rows.length) {
        acceptedBody.innerHTML = '<tr><td colspan="6">No accepted bookings found.</td></tr>';
        return;
      }
      acceptedBody.innerHTML = rows.map((b) => tableRow(b, viewBtn(b))).join('');
    }

    function renderDeclined() {
      if (!declinedBody) return;
      const rows = allBookings
        .filter((b) => b.status === 'declined')
        .filter((b) => matchesSearch(b, search.declined));
      if (!rows.length) {
        declinedBody.innerHTML = '<tr><td colspan="6">No declined bookings.</td></tr>';
        return;
      }
      declinedBody.innerHTML = rows.map((b) => tableRow(b, `
        ${viewBtn(b)}
        <button class="btn-restore" data-action="accept" data-id="${encodeURIComponent(b.id)}"><i class="bi bi-arrow-counterclockwise"></i> Restore</button>
      `)).join('');
    }

    function renderEvent() {
      if (!eventBody) return;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const upcoming = allBookings
        .filter((b) => b.status === 'accepted' || b.status === 'completed')
        .filter((b) => matchesSearch(b, search.event))
        .map((b) => ({ b, d: eventDateObj(b) }))
        .sort((a, z) => {
          if (!a.d) return 1;
          if (!z.d) return -1;
          return a.d - z.d;
        });

      if (!upcoming.length) {
        eventBody.innerHTML = '<tr><td colspan="6">No events to show.</td></tr>';
        return;
      }

      eventBody.innerHTML = upcoming.map(({ b, d }) => {
        const isPast = d && d < today;
        const dateLabel = dates.formatLong(b.event_date) || 'TBD';
        const status = b.status || 'accepted';
        const actions = status === 'completed'
          ? `${viewBtn(b)}<button class="btn-restore" data-action="accept" data-id="${encodeURIComponent(b.id)}"><i class="bi bi-arrow-counterclockwise"></i> Reopen</button>`
          : `${viewBtn(b)}
             <button class="btn-complete" data-action="complete" data-id="${encodeURIComponent(b.id)}"><i class="bi bi-check2-circle"></i> Mark completed</button>
             <button class="btn-cancel-event" data-action="cancel" data-id="${encodeURIComponent(b.id)}"><i class="bi bi-slash-circle"></i> Cancel</button>`;
        return `
          <tr class="${isPast && status !== 'completed' ? 'lp-event-overdue' : ''}">
            <td>${escapeHtml(dateLabel)}</td>
            <td>${escapeHtml(b.name) || 'N/A'}</td>
            <td>${escapeHtml(eventLabel(b)) || 'N/A'}</td>
            <td>${escapeHtml(b.service_type) || 'N/A'}</td>
            <td>${statusBadge(status)}</td>
            <td>${actions}</td>
          </tr>`;
      }).join('');
    }

    // ---------- Modals ----------
    function showDetails(b) {
      const eventType = eventLabel(b);
      const status = b.status || 'pending';
      const submitted = formatTimestamp(b.created_at);
      detailsBody.innerHTML = `
        <div class="booking-detail"><span class="detail-label">Name:</span> <span class="detail-value">${escapeHtml(b.name) || 'N/A'}</span></div>
        <div class="booking-detail"><span class="detail-label">Email:</span> <span class="detail-value">${escapeHtml(b.email) || 'N/A'}</span></div>
        <div class="booking-detail"><span class="detail-label">Phone:</span> <span class="detail-value">${escapeHtml(b.phone) || 'N/A'}</span></div>
        <div class="booking-detail"><span class="detail-label">Event Type:</span> <span class="detail-value">${escapeHtml(eventType) || 'N/A'}</span></div>
        <div class="booking-detail"><span class="detail-label">Event Date:</span> <span class="detail-value">${escapeHtml(dates.formatLong(b.event_date)) || 'N/A'}</span></div>
        <div class="booking-detail"><span class="detail-label">Venue:</span> <span class="detail-value">${escapeHtml(b.venue) || 'N/A'}</span></div>
        <div class="booking-detail"><span class="detail-label">Service:</span> <span class="detail-value">${escapeHtml(b.service_type) || 'N/A'}</span></div>
        <div class="booking-detail"><span class="detail-label">Message:</span> <span class="detail-value">${escapeHtml(b.message) || '—'}</span></div>
        <div class="booking-detail"><span class="detail-label">Status:</span> <span class="detail-value">${statusBadge(status)}</span></div>
        ${b.decline_reason ? `<div class="booking-detail"><span class="detail-label">Decline reason:</span> <span class="detail-value">${escapeHtml(b.decline_reason)}</span></div>` : ''}
        <div class="booking-detail"><span class="detail-label">Submitted:</span> <span class="detail-value">${escapeHtml(submitted)}</span></div>`;
      detailsModal.style.display = 'block';
    }

    function closeDetails() { detailsModal.style.display = 'none'; }

    function openDecline(id) {
      currentDeclineId = id;
      declineReasonInput.value = '';
      declineModal.style.display = 'block';
    }

    function closeDecline() {
      declineModal.style.display = 'none';
      declineReasonInput.value = '';
      currentDeclineId = null;
    }

    function confirmDecline() {
      const reason = declineReasonInput.value.trim();
      if (!reason) {
        alert('Please enter a decline reason.');
        return;
      }
      if (!currentDeclineId) return;
      const id = currentDeclineId;
      closeDecline();
      updateStatus(id, 'declined', reason);
    }

    // Expose modal close handlers to inline onclick attributes (kept for compatibility).
    window.closeDeclineModal = closeDecline;
    window.confirmDecline = confirmDecline;

    // ---------- Wiring ----------
    function findById(id) {
      return allBookings.find((b) => String(b.id) === String(id));
    }

    function bindTableActions(tbody) {
      if (!tbody) return;
      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const id = decodeURIComponent(btn.dataset.id || '');
        const action = btn.dataset.action;
        const booking = findById(id);
        if (!booking) return;
        switch (action) {
          case 'view': showDetails(booking); break;
          case 'accept': updateStatus(booking.id, 'accepted'); break;
          case 'decline': openDecline(booking.id); break;
          case 'complete': updateStatus(booking.id, 'completed'); break;
          case 'cancel':
            if (confirm('Cancel this event? It will move back to declined with no reason recorded.')) {
              updateStatus(booking.id, 'declined', 'Cancelled by admin');
            }
            break;
          default: break;
        }
      });
    }

    function bindSearch(input, key, render) {
      if (!input) return;
      input.addEventListener('input', () => {
        search[key] = input.value.trim();
        render();
      });
    }

    bindTableActions(requestBody);
    bindTableActions(acceptedBody);
    bindTableActions(declinedBody);
    bindTableActions(eventBody);

    bindSearch(requestSearch, 'request', renderRequest);
    bindSearch(acceptedSearch, 'accepted', renderAccepted);
    bindSearch(declinedSearch, 'declined', renderDeclined);
    bindSearch(eventSearch, 'event', renderEvent);

    Object.values(refreshBtns).forEach((btn) => {
      if (btn) btn.addEventListener('click', loadBookings);
    });

    // Modal close handlers
    const detailsClose = document.querySelector('#bookingModal .close-modal');
    if (detailsClose) detailsClose.addEventListener('click', closeDetails);
    window.addEventListener('click', (event) => {
      if (event.target === detailsModal) closeDetails();
      if (event.target === declineModal) closeDecline();
    });

    // Sidebar nav
    navItems.forEach((item) => {
      item.addEventListener('click', function () {
        navItems.forEach((n) => n.classList.remove('active'));
        this.classList.add('active');
        const sectionId = this.dataset.section;
        sections.forEach((sec) => sec.classList.remove('active'));
        const target = document.getElementById(sectionId + '-section');
        if (target) target.classList.add('active');
      });
    });

    // Lock / sign-out button (in sidebar footer)
    const lockBtn = document.getElementById('admin-lock-btn');
    if (lockBtn) {
      lockBtn.addEventListener('click', () => {
        if (window.LP && window.LP.adminAuth) {
          window.LP.adminAuth.lock();
        }
      });
    }

    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarEl = document.querySelector('.sidebar');
    if (sidebarToggle && sidebarEl) {
      sidebarToggle.addEventListener('click', () => {
        sidebarEl.classList.toggle('is-open');
      });
      // Close mobile sidebar when a nav item is clicked
      navItems.forEach((item) => {
        item.addEventListener('click', () => {
          if (window.matchMedia('(max-width: 900px)').matches) {
            sidebarEl.classList.remove('is-open');
          }
        });
      });
    }

    function startData() {
      if (supabase.channel) {
        supabase
          .channel('lp-bookings-admin')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: tableName },
            () => loadBookings()
          )
          .subscribe();
      }
      loadBookings();
    }

    // Defer data load until the password gate is satisfied. If the auth helper
    // is missing, behave like before (load immediately) so admin still works.
    const auth = window.LP && window.LP.adminAuth;
    if (!auth || auth.isUnlocked()) {
      startData();
    } else {
      document.addEventListener(auth.UNLOCK_EVENT, startData, { once: true });
    }
  });
})();
