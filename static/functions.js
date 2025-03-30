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

function getESTDate() {
  const now = new Date();
  const estDateString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  return new Date(estDateString);
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

// Add a global debug function that can be called from console
window.debugLoginState = function() {
console.log("Current login state:");
console.log("userEmail:", localStorage.getItem('userEmail'));
console.log("userName:", localStorage.getItem('userName'));
console.log("googleCredential:", localStorage.getItem('googleCredential') ? "Present (not shown)" : "Not present");

// Check all listing actions to see what's visible
console.log("Checking listing actions...");
document.querySelectorAll('.listing-actions').forEach((actions, index) => {
  const ownerEmail = actions.dataset.ownerEmail;
  const listingId = actions.previousElementSibling?.dataset?.listingId;
  const isVisible = actions.style.display !== 'none';
  console.log(`Listing #${index} (ID: ${listingId}):`, {
    ownerEmail: ownerEmail,
    isVisible: isVisible
  });
});

return "Debug information logged to console";
};

// Also fix how we're storing and using email across the app to ensure consistency
function storeUserEmail(email) {
if (email) {
  // Always store email in lowercase
  email = email.toLowerCase();
  localStorage.setItem('userEmail', email);
  console.log(`Stored user email consistently as: ${email}`);
}
}
// Initialize Google Sign-In when page loads
window.onload = function () {
google.accounts.id.initialize({
  client_id: "YOUR_GOOGLE_CLIENT_ID",
  callback: handleCredentialResponse
});
document.getElementById("g_id_signin").addEventListener("click", function () {
  alert("clicked custom sign in")
  google.accounts.id.prompt(); // Triggers the Google Sign-In popup
});
};
//gets user's google credential and stores it in localStorage.
function handleCredentialResponse(response) {
  // Decode the credential response
  const responsePayload = jwt_decode(response.credential);

  //enforce columbia/barnard email
  if (!responsePayload.email.endsWith('@columbia.edu') && !responsePayload.email.endsWith('@barnard.edu')) {
    alert('Please use your Columbia or Barnard email to sign in.');
    return;
  }

// Store email consistently
storeUserEmail(responsePayload.email);
  
  // Extract UNI from email
  const emailParts = responsePayload.email.split('@');
  const uni = emailParts[0].toLowerCase();
  
  // Check if UNI is banned before proceeding
  fetch('/api/check_banned_uni', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uni: uni }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.banned) {
      alert('You have been banned from Swipe Market. If you think this is a mistake, please contact liondinecu@gmail.com.');
      return;
    }
    
    // Continue with the normal sign-in process
    // Extract just the first name
    const fullName = responsePayload.name;
    const firstName = fullName.split(' ')[0];
    
    // Store the credential in localStorage
    localStorage.setItem('googleCredential', response.credential);
    localStorage.setItem('userName', firstName);
    localStorage.setItem('userImage', responsePayload.picture);
  
    //hide sign in button
    document.getElementById('g_id_signin').style.display = 'none';
  
    //display profile icon
    const profileIcon = document.getElementById('profile-icon');
  if (profileIcon) {
    profileIcon.src = responsePayload.picture;
    profileIcon.style.display = 'block';
  }
  
  const profileMenu = document.getElementById('profile-menu');
  if (profileMenu) {
    profileMenu.style.display = 'inline-block';
  }
  
    //toggle dropdown
  if (profileIcon) {
    profileIcon.addEventListener('click', function(event) {
      event.stopPropagation();
      const profileMenu = this.parentElement;
      profileMenu.classList.toggle('active');
    });
  }

  // Add document click listener to close dropdown when clicking outside
  document.addEventListener('click', function(event) {
    const profileMenu = document.getElementById('profile-menu');
    const profileIcon = document.getElementById('profile-icon');
    
    // Check if click is outside the profile menu and icon
    if (profileMenu && !profileMenu.contains(event.target) && !profileIcon.contains(event.target)) {
      profileMenu.classList.remove('active');
    }
    });

    // Check if user exists in our database
    checkUserExistence(responsePayload.email);
  
    // Try to populate form fields if they exist
    const posterNameField = document.getElementById('poster_name');
    const posterEmailField = document.getElementById('poster_email');
    
    if (posterNameField) {
      posterNameField.value = firstName;
    }
    if (posterEmailField) {
      posterEmailField.value = responsePayload.email;
    }
  
    // Update UI based on user's email
    const userEmail = responsePayload.email;
  console.log('User email from Google sign-in:', userEmail);
    
    // Show edit/delete buttons for listings owned by this user
    document.querySelectorAll('.listing-actions').forEach(actions => {
    const ownerEmail = actions.dataset.ownerEmail;
    console.log('Checking ownership after login:', { 
      ownerEmail: ownerEmail, 
      userEmail: userEmail, 
      isMatch: ownerEmail && userEmail && ownerEmail.toLowerCase() === userEmail.toLowerCase() 
    });
    
    if (userEmail && actions.dataset.ownerEmail) {
      const isOwner = actions.dataset.ownerEmail.toLowerCase() === userEmail.toLowerCase();
      const contactButton = actions.previousElementSibling;
      
      if (isOwner) {
        console.log('Found user listing to enable edit/delete for after login:', ownerEmail);
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
    
    // Fetch contacted listings from the server and update the UI
    fetchContactedListings();
    
    // Check for blocks and update UI accordingly
  //checkBlockedListings();
  
    console.log('User logged in:', responsePayload.email);
  })
  .catch(error => {
    console.error('Error checking banned UNI:', error);
    // If there's an error checking the ban status, deny login to be safe
    alert('An error occurred during sign in. Please try again later.');
  });
}
// Function to check if user exists in our database
function checkUserExistence(email) {
  fetch('/api/check_user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.exists) {
      console.log('User found in database');
      
      // Store the user info in local storage
      if (data.name) {
        localStorage.setItem('userName', data.name);
      }
      // Always update phone in localStorage, even if it's an empty string
      localStorage.setItem('userPhone', data.phone || '');
    } else {
      console.log('New user, prompting for phone number');
      showPhoneNumberModal();
    }
  })
  .catch(error => {
    console.error('Error checking user:', error);
  });
}

// Function to show the phone number modal for first-time users
function showPhoneNumberModal() {
  // Create modal if it doesn't exist
  if (!document.getElementById('phone-modal')) {
    const modal = document.createElement('div');
    modal.id = 'phone-modal';
    modal.className = 'modal';
    
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Complete Your Profile</h2>
        <p>Please provide your phone number to complete your profile.</p>
        <input type="tel" id="new-phone" placeholder="Your phone number" required>
        <div class="modal-buttons">
          <button id="save-phone-btn">Save</button>
          <button id="skip-phone-btn">Skip for now</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add styles for the modal
    const style = document.createElement('style');
    style.textContent = `
      .modal {
        display: block;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgba(0,0,0,0.4);
      }
      
      .modal-content {
        background-color: #fff;
        margin: 15% auto;
        padding: 20px;
        border-radius: 8px;
        width: 80%;
        max-width: 500px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      }
      
      .modal-content h2 {
        margin-top: 0;
      }
      
      .modal-content input {
        width: 100%;
        padding: 10px;
        margin: 15px 0;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 16px;
      }
      
      .modal-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      
      .modal-buttons button {
        padding: 10px 15px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      
      #save-phone-btn {
        background-color: #4285f4;
        color: white;
      }
      
      #skip-phone-btn {
        background-color: #f1f1f1;
        color: #333;
      }
    `;
    
    document.head.appendChild(style);
    
    // Add event listeners
    document.getElementById('save-phone-btn').addEventListener('click', function() {
      const phone = document.getElementById('new-phone').value.trim();
      
      // Validate phone number format
      if (phone) {
        const phoneRegex = /^[0-9()+\-\s]*$/;
        if (!phoneRegex.test(phone)) {
          alert('Phone number can only contain digits 0-9 and the characters +, -, (, and )');
          return;
        }
        saveNewUser(phone);
        modal.style.display = 'none';
      } else {
        alert('Please enter a valid phone number');
      }
    });
    
    document.getElementById('skip-phone-btn').addEventListener('click', function() {
      saveNewUser('');
      modal.style.display = 'none';
    });
  } else {
    document.getElementById('phone-modal').style.display = 'block';
  }
}

// Function to save a new user
function saveNewUser(phone) {
  const name = localStorage.getItem('userName');
  const email = localStorage.getItem('userEmail');
  
  if (!name || !email) {
    console.error('Missing user information');
    return;
  }
  
  fetch('/api/save_user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name,
      email: email,
      phone: phone
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('User saved successfully');
      // Always update the phone in localStorage, even if it's an empty string
      localStorage.setItem('userPhone', phone);
      // Make sure the name is updated in localStorage too
      localStorage.setItem('userName', data.name);
    } else {
      console.error('Error saving user:', data.error);
    }
  })
  .catch(error => {
    console.error('Error saving user:', error);
  });
}

//removes user's google credential from localStorage when they sign out.
//also removes other information from localStorage.
function handleSignOut() {
  // Clear user data
  localStorage.removeItem('googleCredential');
  localStorage.removeItem('userName');
  localStorage.removeItem('userImage');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userPhone');

  //hide profile icon and show sign in button
  
  // Reset UI: hide profile icon and show sign in button
  document.getElementById('profile-menu').style.display = 'none';
  document.getElementById('g_id_signin').style.display = 'block';

  console.log('User logged out');

// Revoke token and redirect to home page
  google.accounts.id.revoke(localStorage.getItem('googleCredential'), done => {
    console.log('Token revoked');
  // Redirect to home page
  window.location.href = '/';
  });
}
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
}
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
  
  // Format to "Day of Week, Month Day" (e.g., "Monday, January 15")
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
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
    alert('Please sign in with your Columbia/Barnard email to buy or sell a swipe.');
    document.getElementById('g_id_signin').style.display = 'block';
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

// --- INITIALIZATION AND EVENT LISTENERS ---

//checks if user is logged in when page loads.
//initialize time and set up event listeners.
window.onload = function() {
  //initialize Google Identity Services
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.initialize({
      client_id: '362313378422-s5g6ki5lkph6vaeoad93lfirrtugvnfl.apps.googleusercontent.com',
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
      profileIcon.addEventListener('click', function(event) {
        event.stopPropagation();
        this.parentElement.classList.toggle('active');
      });

      // Add document click listener to close dropdown when clicking outside
      document.addEventListener('click', function(event) {
        const profileMenu = document.getElementById('profile-menu');
        const profileIcon = document.getElementById('profile-icon');
        
        // Check if click is outside the profile menu and icon
        if (profileMenu && !profileMenu.contains(event.target) && !profileIcon.contains(event.target)) {
          profileMenu.classList.remove('active');
        }
      });

      // Add the dropdown styles if they don't exist
      
      if (!document.getElementById('dropdown-styles')) {
        const style = document.createElement('style');
        style.id = 'dropdown-styles';
        /*
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
        `;*/
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

// Add click listener to post listings button
const postListingsButton = document.getElementById('postListingsButton');
if (postListingsButton) {
  postListingsButton.addEventListener('click', function(event) {
    // No need for requireSignIn check here since we're handling it in form submission
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
    alert('Please sign in with your Columbia/Barnard email to delete a listing.');
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
    alert('Please sign in with your Columbia/Barnard email to edit a listing.');
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
  });
}
});

// add this function to handle the popup
function handlePopup() {
// Check if URL has show_popup=true
  const urlParams = new URLSearchParams(window.location.search);
const showPopup = urlParams.get('show_popup');
const contactedId = urlParams.get('contacted_id');
const error = urlParams.get('error');
//alert('before showPopup')
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
  // Send email to server via POST request
  fetch('/api/set_user_email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: userEmail })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // If we're on a URL with email parameter, clean it up
      const url = new URL(window.location.href);
      if (url.searchParams.has('email')) {
        url.searchParams.delete('email');
        window.history.replaceState({}, '', url);
      }
    }
  })
  .catch(error => {
    console.error('Error setting user email:', error);
  });
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

// Add form submission handlers
document.addEventListener('DOMContentLoaded', function() {
    // Add form submission handler for buy listings form
    const buyForm = document.getElementById('listingForm');
    if (buyForm) {
        buyForm.addEventListener('submit', function(event) {
            if (!isUserLoggedIn()) {
                event.preventDefault(); // Stop the default form submission
                alert('Please sign in with your Columbia/Barnard email to buy or sell a swipe.');
                document.getElementById('g_id_signin').style.display = 'block';
                return;
            }
        });
    }

    // Add form submission handler for sell listings form
    const sellForm = document.getElementById('listingForm');
    if (sellForm) {
        sellForm.addEventListener('submit', function(event) {
            if (!isUserLoggedIn()) {
                event.preventDefault(); // Stop the default form submission
                alert('Please sign in with your Columbia/Barnard email to buy or sell a swipe.');
                document.getElementById('g_id_signin').style.display = 'block';
                return;
            }
        });
    }
});