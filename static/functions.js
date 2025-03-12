// --- GOOGLE SIGN IN ---

//triggered when user signs in.
//gets user's basic profile info.
//hides sign in button.
function onSignIn(googleUser) {
    var profile = googleUser.getBasicProfile();
    console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
    console.log('Name: ' + profile.getName());
    console.log('Image URL: ' + profile.getImageUrl());
    console.log('Email: ' + profile.getEmail()); // This is null if the 'email' scope is not present.
    document.getElementById('g_id_signin').style.display = 'none';
  
  }

  document.addEventListener('DOMContentLoaded', function() {
    const userName = localStorage.getItem('userName');
    const userEmail = localStorage.getItem('userEmail');
    
    if (userName && userEmail) {
      const posterNameField = document.getElementById('poster_name');
      const posterEmailField = document.getElementById('poster_email');
      
      if (posterNameField) {
        posterNameField.value = userName;
      }
      if (posterEmailField) {
        posterEmailField.value = userEmail;
      }
    }
  });

  //sets default date and time for seller listings.
  //formats date and time as YYYY-MM-DD HH:MM.
  document.addEventListener('DOMContentLoaded', function() {
    disableContactedListings();
    handlePopup();
    // set default date to today
    const today = new Date();
    const dateInput = document.getElementById('date');
    const startTimeInput = document.getElementById('start_time');
    const endTimeInput = document.getElementById('end_time');
    const isEditPage = window.location.pathname.includes('/edit_listing/');

    if (!isEditPage) {
      // format today's date as YYYY-MM-DD
      const formattedDate = today.toISOString().split('T')[0];
      console.log('made it to edit page')
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
  
  //gets user's google credential and stores it in localStorage.
  function handleCredentialResponse(response) {
    // Decode the credential response
    const responsePayload = jwt_decode(response.credential);
  
    //enforce columbia/barnard email
    if (!responsePayload.email.endsWith('@columbia.edu') && !responsePayload.email.endsWith('@barnard.edu')) {
      alert('Please use your Columbia or Barnard email to sign in.');
      return;
    }
    
    // Extract just the first name
    const fullName = responsePayload.name;
    const firstName = fullName.split(' ')[0];
    
    // Store the credential in localStorage
    localStorage.setItem('googleCredential', response.credential);
    localStorage.setItem('userName', firstName);
    localStorage.setItem('userImage', responsePayload.picture);
    localStorage.setItem('userEmail', responsePayload.email);
  
    //hide sign in button
    document.getElementById('g_id_signin').style.display = 'none';
  
    //display profile icon
    const profileIcon = document.getElementById('profile-icon');
    profileIcon.src = responsePayload.picture;
    document.getElementById('profile-menu').style.display = 'inline-block';
  
    //toggle dropdown
    profileIcon.addEventListener('click', function() {
      this.parentElement.classList.toggle('active');
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
    
    // Show edit/delete buttons for listings owned by this user
    document.querySelectorAll('.listing-actions').forEach(actions => {
      const isOwner = actions.dataset.ownerEmail === userEmail;
      const contactButton = actions.previousElementSibling;
      
      if (isOwner) {
        actions.style.display = 'inline-block';
        contactButton.style.display = 'none';
      } else {
        actions.style.display = 'none';
        contactButton.style.display = 'inline-block';
      }
    });
    
    // Disable contact buttons for previously contacted listings
    disableContactedListings();
  
    console.log('User logged in:', responsePayload.email);
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
        if (phone) {
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
    
    // Clear contacted listings to reset all buttons
    localStorage.removeItem('contactedListings');
    
    // Reset UI: hide profile icon and show sign in button
    document.getElementById('profile-menu').style.display = 'none';
    document.getElementById('g_id_signin').style.display = 'block';
    
    console.log('User logged out');
    
    google.accounts.id.revoke(localStorage.getItem('googleCredential'), done => {
      console.log('Token revoked');
      // Redirect to the homepage 
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
    const credential = localStorage.getItem('googleCredential');
    if (!credential) {
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
      senderEmailInput.value = localStorage.getItem('userEmail');
    }
    
    form.style.display = "block";
    form.setAttribute('data-button-id', listingId);
  }
  
  // checks for valid credential
  function requireSignIn(event) {
    const credential = localStorage.getItem('googleCredential');
    if (!credential) {
      event.preventDefault(); // Stop the default navigation
      alert('Please sign in with your Columbia/Barnard email to post listings.');
      document.getElementById('g_id_signin').style.display = 'block';
      //google.accounts.id.prompt();
      /*
      if (window.google && google.accounts && google.accounts.id) {
        alert('inside if2')
        google.accounts.id.prompt();
      }*/
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

        // Check if user exists in database on page load
        checkUserExistence(payload.email);
      } else {
        // Token expired, remove it
        localStorage.removeItem('googleCredential');
        console.log('Token expired');  // Debug log
      }
    };
  
    document.getElementById('postListingsButton').addEventListener('click', function(event) {
      if(!requireSignIn(event)) return;
    });
    
    // Format time displays on page load
    formatTimeDisplay();
  };
  
  // attach click listeners to all contact buttons
  document.querySelectorAll('.contact-button').forEach(function(button) {
    button.addEventListener('click', function(event) {
      if (!requireSignIn(event)) return;
      
      // Pull name/user from local storage set during signin
      var userName = localStorage.getItem('userName');
      var userEmail = localStorage.getItem('userEmail');
      
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
        const isOwner = actions.dataset.ownerEmail === userEmail;
        const contactButton = actions.previousElementSibling;
        
        if (isOwner) {
            actions.style.display = 'inline-block';
            contactButton.style.display = 'none';
        } else {
            actions.style.display = 'none';
            contactButton.style.display = 'inline-block';
        }
    });
  });

  //deletes listing.
  function deleteListing(listingId) {
    const credential = localStorage.getItem('googleCredential');
    const userEmail = localStorage.getItem('userEmail');
    if (!credential) {
        alert('Please sign in to delete listings');
        return;
    }
    if (confirm('Are you sure you want to delete this listing?')) {
        const formData = new FormData();
        formData.append('user_email', userEmail);
        
        fetch(`/delete_listing/${listingId}`, {
            method: 'POST',
            body: formData
        }).then(() => window.location.reload());
    }
  }

  //shows edit form.
  function editListing(listingId) {
    const credential = localStorage.getItem('googleCredential');
    const userEmail = localStorage.getItem('userEmail');
    
    if (!credential || !userEmail) {
        alert('Please sign in to edit listings');
        return;
    }
    if (confirm('Are you sure you want to edit this listing?')) {
        // Redirect to edit page with user email as query parameter
        window.location.href = `/edit_listing/${listingId}?user_email=${encodeURIComponent(userEmail)}`;
    }
  }

  //check and disable previously contacted listings
  function disableContactedListings() {
    const contactedListings = JSON.parse(localStorage.getItem('contactedListings') || '[]');
    document.querySelectorAll('.contact-button').forEach(button => {
        const listingId = button.getAttribute('data-listing-id');
        if (contactedListings.includes(listingId)) {
            button.disabled = true;
            button.classList.add('contacted');
        }
    });
  }
  
  // add this function to handle the popup
  function handlePopup() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('show_popup') === 'true') {
        const popup = document.getElementById('popup');
        popup.style.display = 'block';
        
        const justContactedId = localStorage.getItem('justContactedId');
        if (justContactedId) {
            const contactedListings = JSON.parse(localStorage.getItem('contactedListings') || '[]');
            if (!contactedListings.includes(justContactedId)) {
                contactedListings.push(justContactedId);
                localStorage.setItem('contactedListings', JSON.stringify(contactedListings));
            }

            const button = document.querySelector(`button[data-listing-id="${justContactedId}"]`);
            if (button) {
                button.disabled = true;
                button.classList.add('contacted');
            }

            localStorage.removeItem('justContactedId');
        }
        
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
    }
  }
  
  // Add this new event listener setup in the DOMContentLoaded event
  document.addEventListener('DOMContentLoaded', function() {
    disableContactedListings();
    handlePopup();
    
    // Format time displays when DOM is loaded
    formatTimeDisplay();
    
    // ... rest of your existing DOMContentLoaded code ...
  });

  
  
  
  