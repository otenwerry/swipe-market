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
    // custom validation for end time
    endTimeInput.addEventListener('input', function() {
        if (startTimeInput.value && this.value <= startTimeInput.value) {
            this.setCustomValidity('End time must be later than start time');
        } else {
            this.setCustomValidity('');
        }
    });

    // also check when start time changes
    startTimeInput.addEventListener('input', function() {
        if (endTimeInput.value && endTimeInput.value <= this.value) {
            endTimeInput.setCustomValidity('End time must be later than start time');
        } else {
            endTimeInput.setCustomValidity('');
        }
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
    
    // Store the credential in localStorage
    localStorage.setItem('googleCredential', response.credential);
    localStorage.setItem('userName', responsePayload.name);
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
  
    // Try to populate form fields if they exist
    const posterNameField = document.getElementById('poster_name');
    const posterEmailField = document.getElementById('poster_email');
    
    if (posterNameField) {
      posterNameField.value = responsePayload.name;
    }
    if (posterEmailField) {
      posterEmailField.value = responsePayload.email;
    }
  
    console.log('User logged in:', responsePayload.email);  // Debug log
  }
  
  //removes user's google credential from localStorage when they sign out.
  //also removes other information from localStorage.
  function handleSignOut() {
    localStorage.removeItem('googleCredential');
    localStorage.removeItem('userName');
    localStorage.removeItem('userImage');
    localStorage.removeItem('userEmail');
  
    //hide profile icon and show sign in button
    document.getElementById('profile-menu').style.display = 'none';
    document.getElementById('g_id_signin').style.display = 'block';
  
    console.log('User logged out');  // Debug log
  
    google.accounts.id.revoke(localStorage.getItem('googleCredential'), done => {
      console.log('Token revoked');
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
  
  //closes the form when the user clicks outside of it.
  function closeForm() {
    document.getElementById("myForm").style.display = "none";
  }
  
  //opens popup form when button is clicked,
  //and populates the form with the listing id.
  function openForm(button) {
    const credential = localStorage.getItem('googleCredential');
    if (!credential) {
        document.getElementById('g_id_signin').style.display = 'block';
        return false;
    }

    // Get or initialize contacted listings array from localStorage
    const contactedListings = JSON.parse(localStorage.getItem('contactedListings') || '[]');
    const listingId = button.getAttribute('data-listing-id');
    
    // Add this listing to contacted listings
    if (!contactedListings.includes(listingId)) {
        contactedListings.push(listingId);
        localStorage.setItem('contactedListings', JSON.stringify(contactedListings));
    }

    // Disable the button
    button.disabled = true;
    button.classList.add('contacted');
    
    const form = document.getElementById("myForm");
    const listingIdInput = form.querySelector('input[name="listing_id"]');
    listingIdInput.value = listingId;
    form.style.display = "block";
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
  
        console.log('User is logged in:', payload.email);  // Debug log
      } else {
        // Token expired, remove it
        localStorage.removeItem('googleCredential');
        console.log('Token expired');  // Debug log
      }
    };
  
    document.getElementById('postListingsButton').addEventListener('click', function(event) {
      if(!requireSignIn(event)) return;
    });
  };
  
  // attach click listeners to all contact buttons
  document.querySelectorAll('.contact-button').forEach(function(button) {
    button.addEventListener('click', function(event) {
    if (!requireSignIn(event)) return;
    //pull name/user from local storage set during signin
    var userName = localStorage.getItem('userName');
    var userEmail = localStorage.getItem('userEmail');
  
    //populate hidden fields in contact form
    document.getElementById('sender_name').value = userName;
    document.getElementById('sender_email').value = userEmail;
  
    //pull listing id from contact button
    var listingId = this.getAttribute('data-listing-id');
    if (listingId) {
      document.getElementById('listing_id').value = listingId;
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
    /*
    const poster_email = localStorage.getItem('userEmail');
    const poster_name = localStorage.getItem('userName');*/
    if (!credential) {
        alert('Please sign in to delete listings');
        return;
    }
    if (confirm('Are you sure you want to delete this listing?')) {
        fetch(`/delete_listing/${listingId}`, {
            method: 'POST',
        }).then(() => window.location.reload());
    }
  }

  //shows edit form.
  function editListing(listingId) {
    const credential = localStorage.getItem('googleCredential');
    /*const poster_email = localStorage.getItem('userEmail');
    const poster_name = localStorage.getItem('userName');*/
    console.log('credential: ' + credential)
    if (!credential) {
        alert('Please sign in to edit listings');
        return;
    }
    if (confirm('Are you sure you want to edit this listing?')) {
        window.location.href = `/edit_listing/${listingId}`;
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
        
        // remove the query parameter without refreshing the page
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
    }
  }
  
  
  
  