// Grab the CSRF token from the <meta> tag:
const CSRF_TOKEN = document
  .querySelector('meta[name="csrf-token"]')
  .getAttribute('content');
/*
function postJSON(url, data) {
  return fetch(url, {
    method: 'POST',
    credentials: 'same-origin',           // include session cookie
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken           // send the CSRF token
    },
    body: JSON.stringify(data)
  });
}*/

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
