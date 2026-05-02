/**
 * Loyal Production - Booking form (user side)
 *
 * Loads accepted bookings from Supabase to disable already-taken dates
 * in the Flatpickr calendar, validates the form, and inserts a new
 * booking request. Stores `event_date` as ISO "YYYY-MM-DD" so the
 * availability calendar can do exact-match lookups.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const supabase = window.LP && window.LP.supabase;
    const dates = window.LP && window.LP.dates;
    const tableName = (window.LP && window.LP.bookingsTable) || 'bookings';

    const form = document.getElementById('booking-form');
    const dateInput = document.getElementById('event-date');
    const feedback = document.getElementById('form-feedback');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

    if (!form || !dateInput || !feedback) {
      console.error('[booking] Required form elements missing.');
      return;
    }

    if (!supabase) {
      feedback.innerHTML =
        '<p class="form-msg form-msg-error">Booking system is unavailable right now. Please refresh or try again later.</p>';
      return;
    }

    let bookedISO = new Set();
    let fpInstance = null;

    /** Fetch dates that are already accepted so users cannot rebook them. */
    async function loadBookedDates() {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('event_date,status')
          .in('status', ['accepted']);
        if (error) throw error;
        bookedISO = new Set(
          (data || [])
            .map((row) => dates.normalizeEventDate(row.event_date))
            .filter(Boolean)
        );
      } catch (err) {
        console.error('[booking] Failed to load booked dates:', err);
        bookedISO = new Set();
      }
    }

    /** Initialize Flatpickr with the booked dates disabled. */
    function initCalendar() {
      if (typeof flatpickr === 'undefined') {
        console.error('[booking] Flatpickr not loaded.');
        return;
      }
      fpInstance = flatpickr(dateInput, {
        enableTime: false,
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'F j, Y',
        minDate: 'today',
        disableMobile: true,
        allowInput: false,
        ariaDateFormat: 'F j, Y',
        disable: [
          (date) => bookedISO.has(dates.toISO(date)),
        ],
        onDayCreate: function (_dObj, _dStr, _fp, dayElem) {
          const iso = dates.toISO(dayElem.dateObj);
          if (bookedISO.has(iso)) {
            dayElem.classList.add('lp-booked');
            dayElem.title = 'Already booked';
          }
        },
      });
    }

    /** Toggle visibility/required state of the "other event type" field. */
    window.toggleOtherEventType = function (selectElement) {
      const otherInput = document.getElementById('other-event-type');
      if (!otherInput) return;
      if (selectElement.value === 'other') {
        otherInput.style.display = 'block';
        otherInput.setAttribute('required', 'required');
      } else {
        otherInput.style.display = 'none';
        otherInput.removeAttribute('required');
        otherInput.value = '';
      }
    };

    function setFeedback(kind, html) {
      const cls = {
        info: 'form-msg form-msg-info',
        success: 'form-msg form-msg-success',
        error: 'form-msg form-msg-error',
      }[kind] || 'form-msg';
      feedback.innerHTML = `<div class="${cls}">${html}</div>`;
    }

    function validateRequired() {
      let allValid = true;
      form.querySelectorAll('[required]').forEach((field) => {
        if (!field.value || !String(field.value).trim()) {
          field.classList.add('lp-invalid');
          allValid = false;
        } else {
          field.classList.remove('lp-invalid');
        }
      });
      return allValid;
    }

    /** Build the row to insert. event_date is stored as ISO "YYYY-MM-DD". */
    function buildInsertPayload(raw) {
      const iso = dates.normalizeEventDate(raw.eventDate);
      const payload = {
        event_type: raw.eventType,
        venue: raw.venue ? String(raw.venue).trim() : null,
        event_date: iso,
        service_type: raw.serviceType,
        name: String(raw.name).trim(),
        email: String(raw.email).trim().toLowerCase(),
        phone: String(raw.phone).trim(),
        message: raw.message ? String(raw.message).trim() : null,
        status: 'pending',
        created_at: new Date().toISOString(),
        other_event_type:
          raw.eventType === 'other' && raw.otherEventType
            ? String(raw.otherEventType).trim()
            : null,
      };
      return payload;
    }

    function showConfirmation(row) {
      form.style.display = 'none';
      const ref = row && row.id ? `#${String(row.id).slice(0, 8).toUpperCase()}` : '';
      const eventLabel = dates.formatLong(row.event_date) || row.event_date;
      setFeedback(
        'success',
        `<h3>Booking request received</h3>
         <p>Salamat${row.name ? `, <strong>${row.name}</strong>` : ''}! Naipasa na namin ang request mo for <strong>${eventLabel}</strong>.</p>
         ${ref ? `<p>Reference: <code>${ref}</code></p>` : ''}
         <p>We'll review your request and get back to you via email at <strong>${row.email}</strong> shortly.</p>
         <p><a href="check-availability.html">Check availability</a> &middot; <a href="status.html?email=${encodeURIComponent(row.email)}">Track my booking</a> &middot; <a href="index.html">Back to home</a></p>`
      );
    }

    async function handleSubmit(e) {
      e.preventDefault();
      if (!validateRequired()) {
        setFeedback('error', 'Please fill all required fields.');
        return;
      }

      const raw = Object.fromEntries(new FormData(form).entries());
      const iso = dates.normalizeEventDate(raw.eventDate);
      if (!iso) {
        setFeedback('error', 'Please pick a valid event date.');
        return;
      }

      // Refresh the booked-dates set right before insert to close the
      // race window between page load and submit.
      await loadBookedDates();
      if (bookedISO.has(iso)) {
        if (fpInstance) fpInstance.redraw();
        setFeedback(
          'error',
          `Sorry, <strong>${dates.formatLong(iso)}</strong> is no longer available. Please pick another date.`
        );
        return;
      }

      const payload = buildInsertPayload(raw);
      if (submitBtn) submitBtn.disabled = true;
      setFeedback('info', 'Sending booking request...');

      try {
        const { data, error } = await supabase
          .from(tableName)
          .insert([payload])
          .select()
          .single();

        if (error) {
          console.error('[booking] Insert failed:', error);
          setFeedback('error', `Could not submit your booking: ${error.message}`);
          return;
        }
        showConfirmation(data || payload);
      } catch (err) {
        console.error('[booking] Network/unexpected error:', err);
        setFeedback('error', 'Network error. Please check your connection and try again.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    }

    form.addEventListener('submit', handleSubmit);

    // Boot
    loadBookedDates().then(initCalendar);
  });
})();
