/**
 * Loyal Production - Availability calendar (user side)
 *
 * Fetches accepted bookings from Supabase and renders them on a custom
 * month calendar. Replaces the previous static `js/booked-dates.json`
 * file so the public calendar always reflects what admins have actually
 * accepted.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof AOS !== 'undefined') AOS.init();

    const supabase = window.LP && window.LP.supabase;
    const dates = window.LP && window.LP.dates;
    const tableName = (window.LP && window.LP.bookingsTable) || 'bookings';

    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const resultDiv = document.getElementById('result');
    const bookedList = document.getElementById('bookedList');
    const todayBtn = document.getElementById('todayBtn');
    const tomorrowBtn = document.getElementById('tomorrowBtn');
    const clearBtn = document.getElementById('clearBtn');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const displayMonthYear = document.getElementById('displayMonthYear');
    const calendarDaysGrid = document.getElementById('calendarDaysGrid');

    if (!calendarDaysGrid) {
      console.error('[availability] Calendar container missing.');
      return;
    }

    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    let bookedDates = [];
    let currentDisplayDate = new Date();
    let selectedDateStr = null;

    async function loadBookedDates() {
      if (!supabase) {
        bookedList.innerHTML =
          '<div class="loading" style="color:#dc2626;"><i class="bi bi-exclamation-triangle-fill"></i> Booking system unavailable</div>';
        renderCalendar(currentDisplayDate);
        return;
      }
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('event_date,status')
          .eq('status', 'accepted');
        if (error) throw error;
        bookedDates = (data || [])
          .map((row) => dates.normalizeEventDate(row.event_date))
          .filter(Boolean);
        renderCalendar(currentDisplayDate);
        showBookedDatesList();
      } catch (err) {
        console.error('[availability] Fetch error:', err);
        bookedList.innerHTML =
          '<div class="loading" style="color:#dc2626;"><i class="bi bi-exclamation-triangle-fill"></i> Failed to load dates</div>';
        renderCalendar(currentDisplayDate);
      }
    }

    function renderCalendar(date) {
      const year = date.getFullYear();
      const month = date.getMonth();
      displayMonthYear.textContent = `${MONTH_NAMES[month]} ${year}`;

      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const todayStr = dates.todayISO();

      calendarDaysGrid.innerHTML = '';

      for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        calendarDaysGrid.appendChild(empty);
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        const dateStr = `${year}-${dates.pad2(month + 1)}-${dates.pad2(d)}`;
        cell.textContent = d;
        cell.dataset.date = dateStr;

        if (bookedDates.includes(dateStr)) cell.classList.add('booked');
        if (dateStr === todayStr) cell.classList.add('today');
        if (dateStr === selectedDateStr) cell.classList.add('selected');

        calendarDaysGrid.appendChild(cell);
      }
    }

    function showBookedDatesList() {
      if (!bookedDates.length) {
        bookedList.innerHTML =
          '<div class="loading"><i class="bi bi-calendar-check"></i> No booked dates yet</div>';
        return;
      }
      const sorted = [...new Set(bookedDates)].sort((a, b) => a.localeCompare(b));
      const html = sorted.map((date) => `
        <div class="date-item" data-date="${date}">
          <span class="date"><i class="bi bi-calendar-x"></i> ${dates.formatLong(date)}</span>
          <span class="badge">Booked</span>
        </div>`).join('');
      bookedList.innerHTML = html;

      bookedList.querySelectorAll('.date-item').forEach((item) => {
        item.addEventListener('click', () => goToDate(item.dataset.date));
      });
    }

    function checkDate(dateStr) {
      const isBooked = bookedDates.includes(dateStr);
      const todayStr = dates.todayISO();
      const formatted = dates.formatLong(dateStr);

      let html;
      if (isBooked) {
        html = `<div class="status-message message-booked">
          <i class="bi bi-x-circle-fill"></i>
          <div class="message-content">
            <h3>Booked</h3>
            <p>${formatted} is already taken</p>
          </div>
        </div>`;
      } else {
        const status = dateStr < todayStr ? 'Past' : 'Available';
        const msg = status === 'Available' ? 'Free! Book now' : 'This date has passed';
        html = `<div class="status-message message-available">
          <i class="bi bi-check-circle-fill"></i>
          <div class="message-content">
            <h3>${status}</h3>
            <p>${formatted} - ${msg}</p>
          </div>
        </div>`;
      }
      resultDiv.innerHTML = html;
    }

    function goToDate(dateStr) {
      selectedDateStr = dateStr;
      const [y, m] = dateStr.split('-').map(Number);
      currentDisplayDate = new Date(y, m - 1, 1);
      renderCalendar(currentDisplayDate);
      checkDate(dateStr);
      if (searchInput) searchInput.value = dateStr;
    }

    function changeMonth(delta) {
      currentDisplayDate.setMonth(currentDisplayDate.getMonth() + delta);
      renderCalendar(currentDisplayDate);
    }

    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => changeMonth(1));

    calendarDaysGrid.addEventListener('click', (e) => {
      const cell = e.target.closest('.calendar-day');
      if (!cell || cell.classList.contains('empty')) return;
      const dateStr = cell.dataset.date;
      if (dateStr) goToDate(dateStr);
    });

    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        const val = searchInput.value.trim();
        if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
          goToDate(val);
        } else {
          alert('Please enter date in YYYY-MM-DD format');
        }
      });
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchBtn.click();
      });
    }

    if (todayBtn) {
      todayBtn.addEventListener('click', () => goToDate(dates.todayISO()));
    }
    if (tomorrowBtn) {
      tomorrowBtn.addEventListener('click', () => {
        const tom = new Date();
        tom.setDate(tom.getDate() + 1);
        goToDate(dates.toISO(tom));
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        selectedDateStr = null;
        if (searchInput) searchInput.value = '';
        resultDiv.innerHTML =
          '<div class="placeholder"><i class="bi bi-calendar2-week"></i><p>Select a date</p></div>';
        renderCalendar(currentDisplayDate);
      });
    }

    // Live updates: refresh booked dates whenever bookings change.
    if (supabase && supabase.channel) {
      supabase
        .channel('lp-bookings-availability')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName },
          () => loadBookedDates()
        )
        .subscribe();
    }

    loadBookedDates();
  });
})();
