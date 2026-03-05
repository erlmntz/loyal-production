// modal.js
document.addEventListener('DOMContentLoaded', function() {
    const checkBtn = document.getElementById('check-availability-btn');
    const modal = document.getElementById('availability-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const dateInput = document.getElementById('date-picker');
    const messageDiv = document.getElementById('availability-message');

    let bookedDates = []; // will hold fetched dates

    // Fetch booked dates from JSON
    fetch('booked-dated.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load booked dates');
            }
            return response.json();
        })
        .then(data => {
            bookedDates = data; // array of strings like "2026-03-05"
        })
        .catch(error => {
            console.error('Error loading booked dates:', error);
            messageDiv.textContent = 'Could not load availability data.';
            messageDiv.classList.add('booked');
        });

    // Open modal when button is clicked
    checkBtn.addEventListener('click', function(e) {
        e.preventDefault(); // prevent navigation to modal.html
        modal.classList.add('active');

        // Initialize flatpickr if not already done
        if (!dateInput._flatpickr) {
            flatpickr(dateInput, {
                dateFormat: "Y-m-d",
                minDate: "today", // optional: prevent past dates
                onDayCreate: function(dObj, dStr, fp, dayElem) {
                    // Highlight booked dates
                    const dateStr = dayElem.dateObj.toISOString().split('T')[0];
                    if (bookedDates.includes(dateStr)) {
                        dayElem.classList.add('booked');
                    }
                },
                onChange: function(selectedDates, dateStr, instance) {
                    if (bookedDates.includes(dateStr)) {
                        messageDiv.textContent = 'This date is fully booked.';
                        messageDiv.className = 'availability-status booked';
                    } else {
                        messageDiv.textContent = 'This date is available!';
                        messageDiv.className = 'availability-status available';
                    }
                }
            });
        }
    });

    // Close modal when X is clicked
    closeBtn.addEventListener('click', function() {
        modal.classList.remove('active');
        // Clear previous selection and message
        dateInput.value = '';
        messageDiv.textContent = '';
        messageDiv.className = 'availability-status';
    });

    // Close modal if overlay is clicked (optional)
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.remove('active');
            dateInput.value = '';
            messageDiv.textContent = '';
            messageDiv.className = 'availability-status';
        }
    });
});