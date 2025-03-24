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
    // Make sure the email is stored in lowercase for consistency
    storeUserEmail(userEmail);
    
    const posterNameField = document.getElementById('poster_name');
    const posterEmailField = document.getElementById('poster_email');
    
    if (posterNameField) {
      posterNameField.value = userName;
    }
    if (posterEmailField) {
      posterEmailField.value = userEmail.toLowerCase();
    }
  }
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
  
    console.log('User logged in:', responsePayload.email);
  })
  .catch(error => {
    console.error('Error checking banned UNI:', error);
    // If there's an error checking the ban status, deny login to be safe
    alert('An error occurred during sign in. Please try again later.');
  });
};

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
};

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
};

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
};
  
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

  // Reload the page to clear blocked listings filter
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.delete('email');
  
  google.accounts.id.revoke(localStorage.getItem('googleCredential'), done => {
    console.log('Token revoked');
    // Redirect to the new URL without the email parameter
    window.location.href = currentUrl.href;
  });
};