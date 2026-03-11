// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {

  // ----- SUPABASE INITIALIZATION -----
  const supabaseUrl = 'https://wxiwknkeqgptjlhfcwnt.supabase.co';
  const supabaseKey = 'sb_publishable_-QVYmHFZsMHzS7RjAUh5Zg_xtPsHoZg'; // anon key
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

  // ----- FLATPICKR INITIALIZATION -----
  const dateInput = document.getElementById('event-date');
  if (dateInput && typeof flatpickr !== 'undefined') {
    flatpickr(dateInput, {
      enableTime: false,
      dateFormat: "F j, Y",
      minDate: "today",
      disableMobile: true,
      allowInput: true,
      ariaDateFormat: "F j, Y",
    });
  } else {
    console.error('Flatpickr not loaded or input missing');
  }

  // ----- TOGGLE "OTHER" EVENT TYPE -----
  window.toggleOtherEventType = function(selectElement) {
    const otherInput = document.getElementById('other-event-type');
    if (selectElement.value === 'other') {
      otherInput.style.display = 'block';
      otherInput.setAttribute('required', 'required');
    } else {
      otherInput.style.display = 'none';
      otherInput.removeAttribute('required');
    }
  };

  // ----- FORM SUBMISSION HANDLER (SUPABASE INSERT) -----
  const bookingForm = document.getElementById('booking-form');
  const feedbackDiv = document.getElementById('form-feedback');

  if (bookingForm) {
    bookingForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      // Simple client-side validation (browser also enforces 'required')
      const requiredFields = bookingForm.querySelectorAll('[required]');
      let allValid = true;
      requiredFields.forEach(field => {
        if (!field.value.trim()) {
          field.style.borderColor = 'red';
          allValid = false;
        } else {
          field.style.borderColor = '';
        }
      });

      if (!allValid) {
        feedbackDiv.innerHTML = '<p style="color:red;">Please fill all required fields.</p>';
        return;
      }

      // Collect form data
      const formData = new FormData(bookingForm);
      const rawData = Object.fromEntries(formData.entries());

      // Build the object to insert (handle 'other' event type)
      const insertData = {
        event_type: rawData.eventType,
        venue: rawData.venue || null,
        event_date: rawData.eventDate,
        service_type: rawData.serviceType,
        name: rawData.name,
        email: rawData.email,
        phone: rawData.phone,
        message: rawData.message || null,
        created_at: new Date().toISOString() // optional timestamp
      };

      // If event type is 'other', store the custom value in a separate column
      if (rawData.eventType === 'other') {
        insertData.other_event_type = rawData.otherEventType;
      } else {
        insertData.other_event_type = null;
      }

      // Show sending status
      feedbackDiv.innerHTML = '<p style="color:green;">Sending booking request...</p>';

      try {
        // Insert into Supabase table 'bookings'
        const { data, error } = await supabase
          .from('bookings')
          .insert([insertData])
          .select(); // .select() returns the inserted row (optional)

        if (error) {
          console.error('Supabase error:', error);
          feedbackDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
        } else {
          feedbackDiv.innerHTML = '<p style="color:green;">Booking request sent successfully!</p>';
          bookingForm.reset(); // clear the form
          // Optionally reset the "other" input visibility
          document.getElementById('other-event-type').style.display = 'none';
          document.getElementById('other-event-type').removeAttribute('required');
        }
      } catch (err) {
        console.error('Network error:', err);
        feedbackDiv.innerHTML = '<p style="color:red;">Network error. Please try again.</p>';
      }
    });
  }
});