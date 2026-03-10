document.addEventListener('DOMContentLoaded', function() {
    // Initialize AOS
    AOS.init();

    const calendarInput = document.getElementById('availability-calendar');
    const dateSearch = document.getElementById('date-search');
    const searchBtn = document.getElementById('search-btn');
    const resultDiv = document.getElementById('availability-result');
    const bookedDatesList = document.getElementById('booked-dates-list');
    const checkToday = document.getElementById('check-today');
    const checkTomorrow = document.getElementById('check-tomorrow');
    const clearDate = document.getElementById('clear-date');

    let bookedDates = [];
    let fp = null;

    // Fetch booked dates
    fetch('booked-dated.json')
        .then(response => response.json())
        .then(data => {
            bookedDates = data;
            initializeCalendar();
            displayBookedDates();
        })
        .catch(error => {
            console.error('Error loading booked dates:', error);
            bookedDatesList.innerHTML = '<div class="loading-dates" style="color: #dc2626;">Failed to load booked dates</div>';
        });

    // Initialize calendar
    function initializeCalendar() {
        fp = flatpickr(calendarInput, {
            dateFormat: "Y-m-d",
            minDate: "today",
            showMonths: 1,
            disableMobile: true,
            disable: bookedDates.map(date => new Date(date)),
            onChange: function(selectedDates, dateStr) {
                if (selectedDates.length > 0) {
                    checkAvailability(dateStr);
                    dateSearch.value = dateStr;
                }
            },
            onDayCreate: function(dObj, dStr, fp, dayElem) {
                const dateStr = dayElem.dateObj.toISOString().split('T')[0];
                
                if (bookedDates.includes(dateStr)) {
                    dayElem.classList.add('booked');
                }
                
                const today = new Date().toISOString().split('T')[0];
                if (dateStr === today) {
                    dayElem.classList.add('today');
                }
            }
        });
    }

    // Check availability function
    function checkAvailability(date) {
        const isBooked = bookedDates.includes(date);
        const today = new Date().toISOString().split('T')[0];
        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        let statusHTML = '';
        
        if (isBooked) {
            statusHTML = `
                <div class="status-message booked">
                    <i class="bi bi-x-circle-fill"></i>
                    <div class="message-content">
                        <h3>Date is Booked</h3>
                        <p>${formattedDate} is already booked. Please select another date.</p>
                    </div>
                </div>
            `;
        } else {
            let message = date < today ? 'This date has passed' : 'Date is available!';
            statusHTML = `
                <div class="status-message available">
                    <i class="bi bi-check-circle-fill"></i>
                    <div class="message-content">
                        <h3>${date < today ? 'Date Passed' : 'Available'}</h3>
                        <p>${formattedDate} - ${message}</p>
                    </div>
                </div>
            `;
        }

        resultDiv.innerHTML = statusHTML;
    }

    // Display booked dates list
    function displayBookedDates() {
        if (bookedDates.length === 0) {
            bookedDatesList.innerHTML = '<div class="loading-dates">No booked dates yet</div>';
            return;
        }

        const sortedDates = bookedDates.sort((a, b) => new Date(a) - new Date(b));
        let datesHTML = '';

        sortedDates.forEach(date => {
            const dateObj = new Date(date);
            const formatted = dateObj.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            
            datesHTML += `
                <div class="booked-date-item" data-date="${date}">
                    <span class="date"><i class="bi bi-calendar-x"></i> ${formatted}</span>
                    <span class="badge">Booked</span>
                </div>
            `;
        });

        bookedDatesList.innerHTML = datesHTML;

        // Add click event to booked dates
        document.querySelectorAll('.booked-date-item').forEach(item => {
            item.addEventListener('click', function() {
                const date = this.dataset.date;
                checkAvailability(date);
                dateSearch.value = date;
                if (fp) {
                    fp.setDate(date);
                }
            });
        });
    }

    // Search button click
    searchBtn.addEventListener('click', function() {
        const searchDate = dateSearch.value.trim();
        if (searchDate) {
            // Validate date format
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (dateRegex.test(searchDate)) {
                if (fp) {
                    fp.setDate(searchDate);
                }
                checkAvailability(searchDate);
            } else {
                alert('Please enter date in YYYY-MM-DD format');
            }
        }
    });

    // Enter key in search
    dateSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });

    // Check today
    checkToday.addEventListener('click', function() {
        const today = new Date().toISOString().split('T')[0];
        if (fp) {
            fp.setDate(today);
        }
        dateSearch.value = today;
        checkAvailability(today);
    });

    // Check tomorrow
    checkTomorrow.addEventListener('click', function() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        if (fp) {
            fp.setDate(tomorrowStr);
        }
        dateSearch.value = tomorrowStr;
        checkAvailability(tomorrowStr);
    });

    // Clear selection
    clearDate.addEventListener('click', function() {
        if (fp) {
            fp.clear();
        }
        dateSearch.value = '';
        resultDiv.innerHTML = `
            <div class="result-placeholder">
                <i class="bi bi-calendar2-week"></i>
                <p>Select a date to check availability</p>
            </div>
        `;
    });
});