
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

