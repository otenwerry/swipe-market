
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
};

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
};