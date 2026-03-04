document.addEventListener('DOMContentLoaded', function() {
    // Load booked dates from JSON (same as in main.js)
    let bookedDates = [];
    fetch('js/booked-dates.json')
        .then(response => response.json())
        .then(data => {
            bookedDates = data;
            initDatePicker();
        })
        .catch(error => {
            console.error('Error loading booked dates:', error);
            // Still initialize picker with no disabled dates
            initDatePicker();
        });

    function initDatePicker() {
        // Get date from URL parameter ?date=YYYY-MM-DD
        const urlParams = new URLSearchParams(window.location.search);
        const prefillDate = urlParams.get('date');

        // Initialize Flatpickr on the date input
        const dateInput = document.getElementById('event-date');
        if (dateInput) {
            const picker = flatpickr(dateInput, {
                minDate: 'today',
                dateFormat: 'Y-m-d',
                disable: bookedDates,
                onChange: function(selectedDates, dateStr) {
                    // Optional: validate that the date is not booked (already disabled)
                }
            });

            // Pre-fill date if provided and not in bookedDates
            if (prefillDate && !bookedDates.includes(prefillDate)) {
                picker.setDate(prefillDate);
            }
        }
    }

    // Handle form submission
    const form = document.getElementById('booking-form');
    const feedbackDiv = document.getElementById('form-feedback');

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Simple validation (HTML5 required handles most)
        const eventDate = document.getElementById('event-date').value;
        if (!eventDate) {
            showFeedback('Please select an event date.', 'error');
            return;
        }

        // Simulate sending data (replace with actual fetch to your backend)
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Here you would normally send a POST request to your server
        console.log('Booking data:', data);

        // Show success message
        showFeedback('Your booking request has been sent! We’ll contact you soon.', 'success');
        form.reset(); // optional
    });

    function showFeedback(message, type) {
        feedbackDiv.textContent = message;
        feedbackDiv.className = 'form-feedback ' + type; // 'success' or 'error'
    }
});