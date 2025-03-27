function getESTDate() {
  const now = new Date();
  const estDateString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  return new Date(estDateString);
};
//sets default date and time for seller listings.
//formats date and time as YYYY-MM-DD HH:MM.
document.addEventListener('DOMContentLoaded', function() {
  disableContactedListings();
  handlePopup();
  // Check for auto delete parameter
  checkAutoDelete();

  // Add how-it-works popup functionality
  const howItWorksButton = document.getElementById('howItWorksButton');
  const howItWorksPopup = document.getElementById('howItWorksPopup');

  if (howItWorksButton && howItWorksPopup) {
    howItWorksButton.addEventListener('click', function() {
      howItWorksPopup.style.display = 'block';
    });

    // Close popup when clicking outside
    howItWorksPopup.addEventListener('click', function(event) {
      if (event.target === howItWorksPopup) {
        howItWorksPopup.style.display = 'none';
      }
    });

    // Close popup when pressing Escape key
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && howItWorksPopup.style.display === 'block') {
        howItWorksPopup.style.display = 'none';
      }
    });
  }

    // set default date to today
    const today = getESTDate();
    const dateInput = document.getElementById('date');
    const startTimeInput = document.getElementById('start_time');
    const endTimeInput = document.getElementById('end_time');
    const priceInput = document.getElementById('price');
    const isEditPage = window.location.pathname.includes('/edit_listing/');

  // Add validation for price input
  if (priceInput) {
    priceInput.addEventListener('input', function() {
      const price = parseFloat(this.value);
      if (isNaN(price) || price < 0) {
        this.setCustomValidity('Price must be at least 0.');
      } else {
        this.setCustomValidity('');
      }
    });
  }

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
        const now = new getESTDate();
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
  if (diningHallSelect) {
    diningHallSelect.addEventListener('change', function() {
        if (this.selectedOptions.length === 0 || (this.selectedOptions.length === 1 && this.selectedOptions[0].disabled)) {
            this.setCustomValidity('Please select at least one dining hall');
        } else {
            this.setCustomValidity('');
        }
    });
  }

  if (paymentMethodsSelect) {
    paymentMethodsSelect.addEventListener('change', function() {
        if (this.selectedOptions.length === 0 || (this.selectedOptions.length === 1 && this.selectedOptions[0].disabled)) {
            this.setCustomValidity('Please select at least one payment method');
        } else {
            this.setCustomValidity('');
        }
    });
  }

    // Trigger initial validation
    diningHallSelect.dispatchEvent(new Event('change'));
    paymentMethodsSelect.dispatchEvent(new Event('change'));
});

document.addEventListener("DOMContentLoaded", function () {
  // Only apply validation to the listing creation/edit form, not the contact form
  const listingForm = document.getElementById('listingForm');
  if (listingForm) {
    const diningHallCheckboxes = listingForm.querySelectorAll("input[name='dining_hall[]']");
    const paymentMethodCheckboxes = listingForm.querySelectorAll("input[name='payment_methods[]']");

    // Function to check if any checkbox in a group is checked
    function isAnyCheckboxChecked(checkboxList) {
      return Array.from(checkboxList).some(checkbox => checkbox.checked);
    }

    // Function to show error message
    function showError(message) {
      alert(message);
    }

    listingForm.addEventListener("submit", function (event) {
      let hasError = false;
      
      // Check dining halls
      if (!isAnyCheckboxChecked(diningHallCheckboxes)) {
        showError("Please select at least one dining hall.");
        //diningHallCheckboxes.setCustomValidity('Please select at least one dining hall.');
        hasError = true;
        event.preventDefault();
        return;
      }

      // Check payment methods
      if (!isAnyCheckboxChecked(paymentMethodCheckboxes)) {
        //paymentMethodCheckboxes.setCustomValidity('Please select at least one payment method.');
        showError("Please select at least one payment method.");
        hasError = true;
        event.preventDefault();
        return;
      }
    });

    // Add real-time validation feedback
    /*
    diningHallCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        if (!isAnyCheckboxChecked(diningHallCheckboxes)) {
          this.setCustomValidity('Please select at least one dining hall.');
        } else {
          this.setCustomValidity('');
        }
      });
    });
    
    paymentMethodCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', function() {
        if (!isAnyCheckboxChecked(paymentMethodCheckboxes)) {
          this.setCustomValidity('Please select at least one payment method.');
        } else {
          this.setCustomValidity('');
        }
      });
    });*/
  }
});

// Helper function to convert a time string from 24-hour to 12-hour format
function formatTo12Hour(timeStr) {
  // Return early if the timeStr is empty or invalid
  if (!timeStr || !timeStr.includes(':')) return timeStr;
  
  const [hours, minutes] = timeStr.split(':').map(part => parseInt(part, 10));
  
  if (isNaN(hours) || isNaN(minutes)) return timeStr;
  
  const period = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12; // Convert 0 to 12 for 12 AM
  
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

//closes the form when the user clicks outside of it.
function closeForm() {
  const form = document.getElementById("myForm");
  form.style.display = "none";
  // Clear the stored button reference
  form.removeAttribute('data-button-id');
};
