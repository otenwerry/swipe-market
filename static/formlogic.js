//sets default date and time for seller listings.
//formats date and time as YYYY-MM-DD HH:MM.
document.addEventListener('DOMContentLoaded', function() {
  disableContactedListings();
  handlePopup();
  // Check for auto delete parameter
  checkAutoDelete();
  // set default date to today
  const today = new Date();
  const dateInput = document.getElementById('date');
  const startTimeInput = document.getElementById('start_time');
  const endTimeInput = document.getElementById('end_time');
  const isEditPage = window.location.pathname.includes('/edit_listing/');

  if (!isEditPage) {
    // format today's date as YYYY-MM-DD
    const formattedDate = today.toISOString().split('T')[0];
    dateInput.value = formattedDate;
    dateInput.min = formattedDate; // prevent selecting past dates

    // set default start time to current time (rounded to nearest 15 minutes)
    const minutes = today.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    today.setMinutes(roundedMinutes);
    today.setSeconds(0);
    today.setMilliseconds(0);
    
    // format time as HH:MM
    const hours = String(today.getHours()).padStart(2, '0');
    const mins = String(today.getMinutes()).padStart(2, '0');
    startTimeInput.value = `${hours}:${mins}`;
  } else {
    // For edit page, still set the minimum date to today
    const formattedDate = today.toISOString().split('T')[0];
    dateInput.min = formattedDate; // prevent selecting past dates
  }
  
  // Function to validate start time for today's date
  function validateStartTime() {
    // Check if date is today
    if (dateInput.value === today.toISOString().split('T')[0]) {
      // Get current time
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      
      // Get selected time
      const [selectedHours, selectedMinutes] = startTimeInput.value.split(':').map(Number);
      
      // Compare times
      if (selectedHours < currentHours || (selectedHours === currentHours && selectedMinutes < currentMinutes)) {
        startTimeInput.setCustomValidity('For today, start time must be later than current time');
      } else {
        startTimeInput.setCustomValidity('');
      }
    } else {
      // If date is not today, no time restriction
      startTimeInput.setCustomValidity('');
    }
  }
  
  // Add event listeners for both date and time fields to trigger validation
  startTimeInput.addEventListener('input', validateStartTime);
  dateInput.addEventListener('input', validateStartTime);
  
  // Run validation at page load
  validateStartTime();
  
  // custom validation for end time
  endTimeInput.addEventListener('input', function() {
      if (startTimeInput.value && this.value <= startTimeInput.value) {
          this.setCustomValidity('End time must be later than start time');
      } else {
          this.setCustomValidity('');
      }
      
      // Also re-validate start time to make sure both validations work together
      validateStartTime();
  });

  // also check when start time changes
  startTimeInput.addEventListener('input', function() {
      if (endTimeInput.value && endTimeInput.value <= this.value) {
          endTimeInput.setCustomValidity('End time must be later than start time');
      } else {
          endTimeInput.setCustomValidity('');
      }
      
      // The validateStartTime function will be called from the general input event listener above
  });

  const form = document.querySelector('form');
  const diningHallSelect = document.getElementById('dining_hall');
  const paymentMethodsSelect = document.getElementById('payment_methods');

  // Add validation for multiple select fields
  diningHallSelect.addEventListener('change', function() {
      if (this.selectedOptions.length === 0 || (this.selectedOptions.length === 1 && this.selectedOptions[0].disabled)) {
          this.setCustomValidity('Please select at least one dining hall');
      } else {
          this.setCustomValidity('');
      }
  });

  paymentMethodsSelect.addEventListener('change', function() {
      if (this.selectedOptions.length === 0 || (this.selectedOptions.length === 1 && this.selectedOptions[0].disabled)) {
          this.setCustomValidity('Please select at least one payment method');
      } else {
          this.setCustomValidity('');
      }
  });

  // Trigger initial validation
  diningHallSelect.dispatchEvent(new Event('change'));
  paymentMethodsSelect.dispatchEvent(new Event('change'));
});

//closes the form when the user clicks outside of it.
function closeForm() {
  const form = document.getElementById("myForm");
  form.style.display = "none";
  // Clear the stored button reference
  form.removeAttribute('data-button-id');
};

//opens popup form when button is clicked,
//and populates the form with the listing id.
function openForm(button) {
  // Don't open form if button is disabled (already contacted)
  if (button.disabled || button.classList.contains('contacted')) {
    // Check if this is a blocked user
    if (button.getAttribute('data-blocked')) {
      showBlockMessage(button.getAttribute('title') || 'This user is blocked');
    }
    return false;
  }
  
  if (!isUserLoggedIn()) {
    document.getElementById('g_id_signin').style.display = 'block';
    alert('Please sign in with your Columbia/Barnard email to contact users.');
    return false;
  }

  const listingId = button.getAttribute('data-listing-id');
  const listingType = button.getAttribute('data-listing-type');
  
  const form = document.getElementById("myForm");
  const listingIdInput = form.querySelector('input[name="listing_id"]');
  const listingTypeInput = form.querySelector('input[name="listing_type"]');
  
  listingIdInput.value = listingId;
  listingTypeInput.value = listingType;
  
  // Set sender info
  const senderNameInput = form.querySelector('input[name="sender_name"]');
  const senderEmailInput = form.querySelector('input[name="sender_email"]');
  
  if (senderNameInput && senderEmailInput) {
    senderNameInput.value = localStorage.getItem('userName');
    const email = localStorage.getItem('userEmail');
    // Ensure we're using lowercase email consistently
    senderEmailInput.value = email ? email.toLowerCase() : email;
  }
  
  form.style.display = "block";
  form.setAttribute('data-button-id', listingId);
}

// checks for valid credential
function requireSignIn(event) {
  if (!isUserLoggedIn()) {
    event.preventDefault(); // Stop the default navigation
    alert('Please sign in with your Columbia/Barnard email to buy or sell a swipe.');
    document.getElementById('g_id_signin').style.display = 'block';
    return false;
  }
  return true;
};

//shows edit/delete buttons to poster only.
//hides contact button from poster.
document.addEventListener('DOMContentLoaded', function() {
  // Show/hide edit/delete buttons based on user email
  const userEmail = localStorage.getItem('userEmail');
  document.querySelectorAll('.listing-actions').forEach(actions => {
      if (userEmail && actions.dataset.ownerEmail) {
        const isOwner = actions.dataset.ownerEmail.toLowerCase() === userEmail.toLowerCase();
        const contactButton = actions.previousElementSibling;
        
        if (isOwner) {
            actions.style.display = 'inline-block';
            contactButton.style.display = 'none';
        } else {
            actions.style.display = 'none';
            contactButton.style.display = 'inline-block';
        }
      } else {
        // If either email is missing, just hide the actions
        actions.style.display = 'none';
        if (actions.previousElementSibling) {
          actions.previousElementSibling.style.display = 'inline-block';
        }
      }
  });
});

