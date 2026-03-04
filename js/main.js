document.addEventListener('DOMContentLoaded', function() {
    new TypeIt("#typewriter-text", {
        strings: ["\"We capture life's most precious moments with creativity and professionalism. Whether it's a wedding, debut, or private party, our team ensures every shot tells your story.\""],
        speed: 40,
        waitUntilVisible: true,
        cursor: true,
        cursorChar: '|',
        startDelay: 500,
        nextStringDelay: 10000,
        loop: true,
        loopDelay: 5000 
    }).go();

    const btn = document.getElementById('check-availability-btn');
    let modal = null;

    btn.addEventListener('click', function(e) {
        e.preventDefault();

        if (!modal) {
            fetch('modal.html')
                .then(response => {
                    if (!response.ok) throw new Error('Failed to load modal');
                    return response.text();
                })
                .then(html => {
                    document.body.insertAdjacentHTML('beforeend', html);
                    modal = document.getElementById('availability-modal');
                    const closeBtn = document.querySelector('.close-modal');
                    const availabilityMsg = document.getElementById('availability-message');

                    // Load booked dates FIRST
                    fetch('js/booked-dates.json')
                        .then(res => res.json())
                        .then(bookedDates => {
                            // Show modal
                            modal.style.display = 'block';

                            // Initialize Flatpickr
                            flatpickr('#calendar-container', {
                                inline: true,
                                onChange: function(selectedDates, dateStr) {
                                    if (bookedDates.includes(dateStr)) {
                                        availabilityMsg.innerHTML = `<span style="color: #d9534f;"> Sorry, ${dateStr} is already booked.</span>`;
                                    } else {
                                        availabilityMsg.innerHTML = `<span style="color: #5cb85c;"> ${dateStr} is available!</span>`;
                                    }
                                },
                                onDayCreate: function(dObj, dStr, fp, dayElem) {
                                    // Get date in same format as bookedDates (YYYY-MM-DD)
                                    const dateStr = fp.formatDate(dayElem.dateObj, 'Y-m-d');
                                    if (bookedDates.includes(dateStr)) {
                                        dayElem.classList.add('booked-date');
                                        dayElem.setAttribute('title', 'Fully booked');
                                    }
                                },
                                minDate: 'today',
                                dateFormat: 'Y-m-d'
                                // disable option removed – we want all dates clickable
                            });

                            // Close modal events
                            closeBtn.addEventListener('click', function() {
                                modal.style.display = 'none';
                            });
                            window.addEventListener('click', function(event) {
                                if (event.target == modal) {
                                    modal.style.display = 'none';
                                }
                            });
                        })
                        .catch(err => {
                            console.error('Error loading booked dates:', err);
                            availabilityMsg.innerHTML = '<span style="color: #d9534f;">Error loading availability.</span>';
                        });
                })
                .catch(err => {
                    console.error('Error loading modal:', err);
                    alert('Could not load the availability calendar. Please try again later.');
                });
        } else {
            modal.style.display = 'block';
        }
    });
}); 