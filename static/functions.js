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

// --- UTILITY FUNCTIONS ---

//updates the time on the page.
function updateTime() {
  var now = new Date();
  var options = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true,
      timeZone: 'America/New_York'
  };
  const currentTimeString = now.toLocaleString('en-US', options);
  document.getElementById('current-time').textContent = currentTimeString;
};
//updates the time on the page immediately, then every second.
updateTime();
setInterval(updateTime, 1000);

// Function to format date by omitting the year
function formatDateWithoutYear(dateStr) {
  // Return early if dateStr is empty or invalid
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  
  try {
    // Parse the date string (expected format: YYYY-MM-DD)
    const date = new Date(dateStr);
    
    // Format to "Month Day" (e.g., "January 15")
    const options = { month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateStr; // Return original string if there's an error
  }
}

// Function to format time from 24-hour to 12-hour format with AM/PM
function formatTimeDisplay() {
  // Get all table cells that contain time information
  const timeCells = document.querySelectorAll('table tbody tr td:nth-child(3)');
  
  timeCells.forEach(cell => {
    const timeText = cell.textContent.trim();
    
    // Skip empty cells or cells that don't contain time ranges
    if (!timeText || !timeText.includes(' - ')) return;
    
    const [startTime, endTime] = timeText.split(' - ');
    
    // Convert start time to 12-hour format
    const formattedStartTime = formatTo12Hour(startTime);
    
    // Convert end time to 12-hour format
    const formattedEndTime = formatTo12Hour(endTime);
    
    // Update the cell with the new formatted time
    cell.textContent = `${formattedStartTime} - ${formattedEndTime}`;
  });
  
  // Format dates (which are in the second column of each table)
  const dateCells = document.querySelectorAll('table tbody tr td:nth-child(2)');
  
  dateCells.forEach(cell => {
    const dateText = cell.textContent.trim();
    // Format the date without year
    const formattedDate = formatDateWithoutYear(dateText);
    // Update the cell content
    cell.textContent = formattedDate;
  });
}

// Helper function to convert a time string from 24-hour to 12-hour format
function formatTo12Hour(timeStr) {
  // Return early if the timeStr is empty or invalid
  if (!timeStr || !timeStr.includes(':')) return timeStr;
  
  const [hours, minutes] = timeStr.split(':').map(part => parseInt(part, 10));
  
  if (isNaN(hours) || isNaN(minutes)) return timeStr;
  
  const period = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12; // Convert 0 to 12 for 12 AM
  
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

//closes the form when the user clicks outside of it.
function closeForm() {
  const form = document.getElementById("myForm");
  form.style.display = "none";
  // Clear the stored button reference
  form.removeAttribute('data-button-id');
}

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
}


// --- INITIALIZATION AND EVENT LISTENERS ---

//checks if user is logged in when page loads.
//initialize time and set up event listeners.
window.onload = function() {
  //initialize Google Identity Services
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.initialize({
      client_id: '362313378422-s5g6ki5lkph6vaeoad93lfirrtugvnfl.apps.googleusercontent.com', // Replace with your Client ID
      callback: handleCredentialResponse,
      auto_select: false
    });
  }

  const credential = localStorage.getItem('googleCredential');
  if (credential) {
    try {
      const payload = jwt_decode(credential);
      // Check if token is expired
      const expirationTime = payload.exp * 1000;
      if (Date.now() < expirationTime) {
        document.getElementById('g_id_signin').style.display = 'none';

        //display profile icon
        const profileIcon = document.getElementById('profile-icon');
        profileIcon.src = payload.picture;
        document.getElementById('profile-menu').style.display = 'inline-block';

        //toggle dropdown
        profileIcon.addEventListener('click', function() {
          this.parentElement.classList.toggle('active');
        });

        // Add the dropdown styles if they don't exist
        if (!document.getElementById('dropdown-styles')) {
          const style = document.createElement('style');
          style.id = 'dropdown-styles';
          style.textContent = `
            .profile-menu {
              position: relative;
              display: inline-block;
            }
            
            .profile-menu img {
              width: 35px;
              height: 35px;
              border-radius: 50%;
              cursor: pointer;
              transition: opacity 0.3s;
            }
            
            .profile-menu img:hover {
              opacity: 0.8;
            }
            
            .profile-dropdown {
              display: none;
              position: absolute;
              right: 0;
              background-color: white;
              min-width: 150px;
              box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
              z-index: 1;
              border-radius: 4px;
              padding: 5px 0;
            }
            
            .profile-menu.active .profile-dropdown {
              display: block;
            }
            
            .profile-dropdown button, .profile-dropdown a button {
              width: 100%;
              padding: 10px 15px;
              text-align: left;
              background: none;
              border: none;
              cursor: pointer;
              font-size: 14px;
              color: #333;
              transition: background-color 0.3s;
            }
            
            .profile-dropdown button:hover, .profile-dropdown a button:hover {
              background-color: #f1f1f1;
            }
            
            .profile-dropdown a {
              display: block;
              text-decoration: none;
              color: inherit;
            }
          `;
          document.head.appendChild(style);
        }

        console.log('User is logged in:', payload.email);  // Debug log

        // Extract first name in case token was stored before this feature was added
        if (payload.name) {
          const firstName = payload.name.split(' ')[0];
          localStorage.setItem('userName', firstName);
        }

        // Store email consistently
        if (payload.email) {
          storeUserEmail(payload.email);
        }

        // Check if user exists in database on page load
        checkUserExistence(payload.email);
        
        // Send the user's email to the server for block filtering
        sendUserEmailToServer();
      } else {
        // Token expired, remove it and reset UI
        console.log('Token expired on page load');
        handleTokenExpiration();
      }
    } catch (error) {
      // Invalid token, handle as expired
      console.error('Error decoding token:', error);
      handleTokenExpiration();
    }
  } else {
    // If user isn't logged in, make sure UI is correct
    resetUIForLoggedOutUser();
  }

  const postListingsButton = document.getElementById('postListingsButton');
  if (postListingsButton) {
    postListingsButton.addEventListener('click', function(event) {
      if(!requireSignIn(event)) return;
    });
  }
  
  // Format time displays on page load
  formatTimeDisplay();
  
  // Fetch contacted listings from the database only if user is logged in
  if (isUserLoggedIn()) {
    fetchContactedListings();
  }
  
  // Set up periodic token validity checking
  setupTokenExpirationCheck();
};

// attach click listeners to all contact buttons
document.querySelectorAll('.contact-button').forEach(function(button) {
  button.addEventListener('click', function(event) {
    if (!requireSignIn(event)) return;
    
    // Pull name/user from local storage set during signin
    var userName = localStorage.getItem('userName');
    var userEmail = localStorage.getItem('userEmail');
    
    // Ensure consistent lowercase email
    if (userEmail) {
      userEmail = userEmail.toLowerCase();
    }
  
    // Populate hidden fields in contact form
    document.getElementById('sender_name').value = userName;
    document.getElementById('sender_email').value = userEmail;
  
    // Pull listing id and type from contact button
    var listingId = this.getAttribute('data-listing-id');
    var listingType = this.getAttribute('data-listing-type');
    
    if (listingId) {
      document.getElementById('listing_id').value = listingId;
      document.getElementById('listing_type').value = listingType;
    }
  
    document.getElementById('myForm').style.display = 'block';
  });
});

// Close the form when clicking outside of it
window.onclick = function(event) {
  const form = document.getElementById("myForm");
  const popup = document.getElementById("popup");
  
  if (event.target == form) {
      closeForm();
  }
  if (event.target == popup) {
      popup.style.display = 'none';
  }
}

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

//deletes listing.
function deleteListing(listingId, listingType) {
  if (!isUserLoggedIn()) {
    alert('Please sign in to delete listings');
    document.getElementById('g_id_signin').style.display = 'block';
    return;
  }
  
  const userEmail = localStorage.getItem('userEmail');
  console.log(`Attempting to delete listing ${listingId} of type ${listingType} as ${userEmail}`);
  
  if (confirm('Are you sure you want to delete this listing?')) {
    const formData = new FormData();
    formData.append('user_email', userEmail);
    formData.append('listing_type', listingType);
    
    fetch(`/delete_listing/${listingId}`, {
      method: 'POST',
      body: formData
    })
    .then(response => {
      if (response.ok) {
        console.log(`Successfully deleted listing ${listingId}`);
        window.location.reload();
      } else {
        return response.text().then(text => {
          console.error(`Error deleting listing: ${text}`);
          alert(`Error: ${text}`);
        });
      }
    })
    .catch(error => {
      console.error('Error in fetch:', error);
      alert('An error occurred while trying to delete the listing.');
    });
  }
}
//shows edit form.
function editListing(listingId, listingType) {
  if (!isUserLoggedIn()) {
    alert('Please sign in to edit listings');
    document.getElementById('g_id_signin').style.display = 'block';
    return;
  }
  
  const userEmail = localStorage.getItem('userEmail');
  console.log(`Attempting to edit listing ${listingId} of type ${listingType} as ${userEmail}`);
  
  window.location.href = `/edit_listing/${listingId}?user_email=${encodeURIComponent(userEmail)}&listing_type=${encodeURIComponent(listingType)}`; 
}

// Function to fetch contacted listings from the database
function fetchContactedListings() {
  const userEmail = localStorage.getItem('userEmail');
  if (!userEmail) {
    return;
  }
  
  fetch('/api/get_contacted_listings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: userEmail }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Store the contacted listings in a data attribute on the body for quick access
      const contactedIds = data.contacted_listings.map(item => item.id.toString());
      document.body.setAttribute('data-contacted-listings', JSON.stringify(contactedIds));
      
      // Disable contact buttons for previously contacted listings
      disableContactedListings();
    }
  })
  .catch(error => {
    console.error('Error fetching contacted listings:', error);
  });
}

// Updated function to disable contacted buttons using server data
function disableContactedListings() {
  // Get the current user's email
  const userEmail = localStorage.getItem('userEmail');
  
  // If no user is logged in, don't disable any buttons
  if (!userEmail) {
    return;
  }
  
  // Get contacted listings from data attribute
  const contactedListingsJSON = document.body.getAttribute('data-contacted-listings');
  if (!contactedListingsJSON) {
    return;
  }
  
  const contactedListings = JSON.parse(contactedListingsJSON);
  
  document.querySelectorAll('.contact-button').forEach(button => {
    const listingId = button.getAttribute('data-listing-id');
    if (contactedListings.includes(listingId)) {
      button.disabled = true;
      button.classList.add('contacted');
    }
  });
  
  // We no longer need to check for blocked listings
}

// When the contact form is submitted, we'll let the server handle recording the contact
document.addEventListener('DOMContentLoaded', function() {
  // Fetch contacted listings on page load
  fetchContactedListings();
  
  const contactForm = document.getElementById('myForm');
  
  handlePopup();
});

// add this function to handle the popup
function handlePopup() {
  // Check if URL has show_popup=true
  const urlParams = new URLSearchParams(window.location.search);
  const showPopup = urlParams.get('show_popup');
  const contactedId = urlParams.get('contacted_id');
  const error = urlParams.get('error');
  
  if (showPopup === 'true') {
      const popup = document.getElementById('popup');
      const popupMessage = document.getElementById('popup-message');
      
      // Regular success message
      popupMessage.textContent = 'Connection email sent! Check your inbox';
      popupMessage.style.color = '#000'; // Reset to default color
      
      // Check which listing was contacted
      if (contactedId) {
          const allButtons = document.querySelectorAll(`.contact-button[data-listing-id="${contactedId}"]`);
          allButtons.forEach(button => {
              button.disabled = true;
              button.classList.add('contacted');
          });
      }
      
      popup.style.display = 'block';
      
      // Automatically hide the popup after 3 seconds
      setTimeout(function() {
          popup.style.display = 'none';
      }, 3000);
      
      // Clean up the URL by removing the query parameter
      const url = new URL(window.location);
      url.searchParams.delete('show_popup');
      url.searchParams.delete('contacted_id');
      window.history.replaceState({}, '', url);
  }
  
  if (error === 'true') {
      alert('There was an error sending the connection email. Please try again later.');
      
      // Clean up the URL
      const url = new URL(window.location);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url);
  }
}

// Add styles for contacted buttons if they don't exist
if (!document.getElementById('contacted-button-styles')) {
  const style = document.createElement('style');
  style.id = 'contacted-button-styles';
  style.textContent = `
    .contact-button.contacted {
      background-color: #cccccc;
      color: #777777;
      cursor: not-allowed;
      opacity: 0.7;
      border: 1px solid #aaaaaa;
    }
    
    .contact-button.contacted:hover {
      background-color: #cccccc;
    }
  `;
  document.head.appendChild(style);
}

// Function to ensure user's email is sent to the server for blocking logic
function sendUserEmailToServer() {
  const userEmail = localStorage.getItem('userEmail');
  if (userEmail) {
    // Get the current URL
    const currentUrl = new URL(window.location.href);
    
    // Add or update the email parameter
    currentUrl.searchParams.set('email', userEmail);
    
    // Only redirect if we're not already on a URL with the email parameter
    if (window.location.href !== currentUrl.href) {
      window.location.href = currentUrl.href;
    }
  }
}

// Function to check if auto_delete parameter is in the URL and trigger delete if it is
function checkAutoDelete() {
  const urlParams = new URLSearchParams(window.location.search);
  const autoDeleteId = urlParams.get('auto_delete');
  const listingType = urlParams.get('listing_type') || 'seller'; // Default to seller if not specified
  
  if (autoDeleteId) {
    // Wait for Google sign-in to complete
    const checkCredentialAndDelete = setInterval(function() {
      const userEmail = localStorage.getItem('userEmail');
      if (userEmail) {
        clearInterval(checkCredentialAndDelete);
        
        // Trigger the delete with confirmation
        if (confirm('Are you sure you want to delete this listing?')) {
          const formData = new FormData();
          formData.append('user_email', userEmail);
          formData.append('listing_type', listingType);
          
          fetch(`/delete_listing/${autoDeleteId}`, {
            method: 'POST',
            body: formData
          })
          .then(response => {
            if (response.ok) {
              // Show success message
              alert('Listing deleted successfully!');
              // Clean URL and reload
              const url = new URL(window.location);
              url.searchParams.delete('auto_delete');
              window.history.replaceState({}, '', url);
              window.location.reload();
            } else {
              alert('You can only delete your own listings.');
            }
          })
          .catch(error => {
            console.error('Error deleting listing:', error);
            alert('Error deleting listing. Please try again.');
          });
        } else {
          // Clean URL if user cancels
          const url = new URL(window.location);
          url.searchParams.delete('auto_delete');
          window.history.replaceState({}, '', url);
        }
      }
    }, 500); // Check every 500ms
    
    // Add a timeout after 10 seconds to avoid infinite checking
    setTimeout(function() {
      clearInterval(checkCredentialAndDelete);
      // Clean URL if authentication didn't happen
      const url = new URL(window.location);
      url.searchParams.delete('auto_delete');
      window.history.replaceState({}, '', url);
    }, 10000);
  }
}

// Add this function to periodically check token validity
function setupTokenExpirationCheck() {
  // Check token validity every 5 minutes
  const checkInterval = 5 * 60 * 1000;
  
  setInterval(() => {
    const credential = localStorage.getItem('googleCredential');
    if (credential) {
      try {
        const payload = jwt_decode(credential);
        const expirationTime = payload.exp * 1000;
        
        // If token is expired, reset UI
        if (Date.now() >= expirationTime) {
          console.log('Token expired during session');
          handleTokenExpiration();
        }
      } catch (error) {
        console.error('Error checking token:', error);
        // If we can't decode the token, consider it invalid
        handleTokenExpiration();
      }
    }
  }, checkInterval);
  
  // Also check on user interaction after potential inactivity
  document.addEventListener('click', () => {
    const credential = localStorage.getItem('googleCredential');
    if (credential) {
      try {
        const payload = jwt_decode(credential);
        const expirationTime = payload.exp * 1000;
        
        if (Date.now() >= expirationTime) {
          console.log('Token expired, detected on user interaction');
          handleTokenExpiration();
        }
      } catch (error) {
        console.error('Error checking token on interaction:', error);
        handleTokenExpiration();
      }
    }
  }, { passive: true });
}

// Handle token expiration (similar to sign out but without explicit revoke)
function handleTokenExpiration() {
  // Clear user data
  localStorage.removeItem('googleCredential');
  localStorage.removeItem('userName');
  localStorage.removeItem('userImage');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userPhone');

  // Reset UI for logged out user
  resetUIForLoggedOutUser();
  
  console.log('Session expired, UI reset');
}

// Function to reset all contact buttons to enabled state
function resetContactButtons() {
  document.querySelectorAll('.contact-button.contacted').forEach(button => {
    button.disabled = false;
    button.classList.remove('contacted');
  });
  
  // Also clear the stored contacted listings
  document.body.removeAttribute('data-contacted-listings');
}

// Function to check if user is properly logged in with valid token
function isUserLoggedIn() {
  const credential = localStorage.getItem('googleCredential');
  if (!credential) return false;
  
  try {
    const payload = jwt_decode(credential);
    const expirationTime = payload.exp * 1000;
    return Date.now() < expirationTime;
  } catch (error) {
    console.error('Error checking login status:', error);
    return false;
  }
}

// Function to reset UI for logged out users
function resetUIForLoggedOutUser() {
  document.getElementById('g_id_signin').style.display = 'block';
  const profileMenu = document.getElementById('profile-menu');
  if (profileMenu) {
    profileMenu.style.display = 'none';
  }
  
  // Hide edit/delete buttons
  document.querySelectorAll('.listing-actions').forEach(actions => {
    actions.style.display = 'none';
  });
  
  // Show all contact buttons
  document.querySelectorAll('.contact-button').forEach(button => {
    button.style.display = 'inline-block';
    button.disabled = false;
    button.classList.remove('contacted');
  });
}