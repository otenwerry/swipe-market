document.addEventListener('DOMContentLoaded', function() {
  // Get banned words list from script tag data attribute
  const banScript = document.querySelector('script[data-banned-words]');
  if (!banScript) {
    console.error('Banned words script tag not found');
    return;
  }
  
  let bannedWords = [];
  try {
    bannedWords = JSON.parse(banScript.getAttribute('data-banned-words'));
  } catch (error) {
    console.error('Error parsing banned words:', error);
    return;
  }
  
  // Populate form with user data from localStorage
  const userName = localStorage.getItem('userName');
  const userEmail = localStorage.getItem('userEmail');
  const userPhone = localStorage.getItem('userPhone');
  
  if (userName) document.getElementById('name').value = userName;
  if (userEmail) document.getElementById('email').value = userEmail;
  if (userPhone) document.getElementById('phone').value = userPhone;
  
  // Function to validate phone number format
  function isValidPhoneNumber(phone) {
    // Regex to allow only digits 0-9 and characters + - ( )
    const phoneRegex = /^[0-9()+\-\s]*$/;
    return phoneRegex.test(phone);
  }
  
  // Function to check for banned words
  function containsBannedWord(text) {
    if (!text || !bannedWords || !bannedWords.length) return false;
    
    const lowerText = text.toLowerCase();
    for (const word of bannedWords) {
      if (word && lowerText.includes(word.toLowerCase())) {
        return true;
      }
    }
    return false;
  }
  
  // Handle save button click
  document.getElementById('save-profile').addEventListener('click', function() {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    
    // Validate inputs
    if (!name || !email) {
      showError('Name and email are required');
      return;
    }
    
    // Check for banned words in name
    if (containsBannedWord(name)) {
      showError('Invalid name');
      return;
    }
    
    // Validate phone number format
    if (phone && !isValidPhoneNumber(phone)) {
      alert('Phone number can only contain digits 0-9 and the characters +, -, (, and )');
      // Reset phone field to original value
      document.getElementById('phone').value = localStorage.getItem('userPhone') || '';
      return;
    }
    
    // Save to server
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
        // Update localStorage
        localStorage.setItem('userPhone', phone);
        localStorage.setItem('userName', name);
        showSuccess('Profile updated successfully');
      } else {
        showError(data.error || 'Error updating profile');
      }
    })
    .catch(error => {
      showError('Error connecting to server');
      console.error('Error:', error);
    });
  });
  
  // Block User Functionality
  const blockUniInput = document.getElementById('block-uni');
  const blockButton = document.getElementById('block-button');
  const blockedUnisList = document.getElementById('blocked-unis-list');
  const noBlocksMessage = document.getElementById('no-blocks-message');
  
  // Function to load blocked UNIs
  function loadBlockedUsers() {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) return;
    
    fetch('/api/get_blocked_users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail
      }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const blockedUnis = data.blocked_unis || [];
        updateBlockedUnisList(blockedUnis);
      } else {
        showError(data.error || 'Error loading blocked users');
      }
    })
    .catch(error => {
      showError('Error connecting to server');
      console.error('Error:', error);
    });
  }
  
  // Function to update the blocked UNIs list in the UI
  function updateBlockedUnisList(blockedUnis) {
    blockedUnisList.innerHTML = '';
    
    if (blockedUnis.length === 0) {
      noBlocksMessage.style.display = 'block';
      return;
    }
    
    noBlocksMessage.style.display = 'none';
    
    blockedUnis.forEach(uni => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.alignItems = 'center';
      li.style.padding = '8px 0';
      li.style.borderBottom = '1px solid #eee';
      
      const uniSpan = document.createElement('span');
      uniSpan.textContent = uni;
      uniSpan.style.fontWeight = '500';
      
      const unblockButton = document.createElement('button');
      unblockButton.textContent = 'Unblock';
      unblockButton.style.backgroundColor = '#f1f1f1';
      unblockButton.style.color = '#333';
      unblockButton.style.border = 'none';
      unblockButton.style.padding = '8px 12px';
      unblockButton.style.borderRadius = '4px';
      unblockButton.style.cursor = 'pointer';
      unblockButton.style.fontSize = '14px';
      unblockButton.style.transition = 'background-color 0.3s';
      
      unblockButton.addEventListener('mouseover', function() {
        this.style.backgroundColor = '#e0e0e0';
      });
      
      unblockButton.addEventListener('mouseout', function() {
        this.style.backgroundColor = '#f1f1f1';
      });
      
      unblockButton.addEventListener('click', function() {
        unblockUser(uni);
      });
      
      li.appendChild(uniSpan);
      li.appendChild(unblockButton);
      blockedUnisList.appendChild(li);
    });
  }
  
  // Function to block a user
  function blockUser(uni) {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
      showError('You must be logged in to block users');
      return;
    }
    
    fetch('/api/block_user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        blocker_email: userEmail,
        blocked_uni: uni
      }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showSuccess(data.message || 'User blocked successfully');
        window.location.reload();
      } else {
        showError(data.error || 'Error blocking user');
      }
    })
    .catch(error => {
      showError('Error connecting to server');
      console.error('Error:', error);
    });
  }
  
  // Function to unblock a user
  function unblockUser(uni) {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
      showError('You must be logged in to unblock users');
      return;
    }
    
    fetch('/api/unblock_user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        blocker_email: userEmail,
        blocked_uni: uni
      }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showSuccess(data.message || 'User unblocked successfully');
        window.location.reload();
      } else {
        showError(data.error || 'Error unblocking user');
      }
    })
    .catch(error => {
      showError('Error connecting to server');
      console.error('Error:', error);
    });
  }
  
  // Handle block button click
  blockButton.addEventListener('click', function() {
    const uni = blockUniInput.value.trim().toLowerCase();
    
    if (!uni) {
      showError('Please enter a UNI to block');
      return;
    }
    
    // Basic UNI validation (simple pattern check)
    const uniPattern = /^[a-z0-9]{2,8}$/;
    if (!uniPattern.test(uni)) {
      showError('Please enter a valid UNI (letters and numbers only, 2-8 characters)');
      return;
    }
    
    blockUser(uni);
  });
  
  // Load blocked UNIs on page load
  loadBlockedUsers();
  
  function showSuccess(message) {
    const successMsg = document.getElementById('success-message');
    successMsg.textContent = message;
    successMsg.style.display = 'block';
    
    setTimeout(() => {
      successMsg.style.display = 'none';
    }, 3000);
  }
  
  function showError(message) {
    const errorMsg = document.getElementById('error-message');
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
    
    setTimeout(() => {
      errorMsg.style.display = 'none';
    }, 3000);
  }
});