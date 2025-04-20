// Grab the CSRF token from the <meta> tag:
/*const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

function postJSON(url, data) {
  return fetch(url, {
    method: 'POST',
    credentials: 'same-origin', 
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken
    },
    body: JSON.stringify(data)
  });
}*/

document.addEventListener('DOMContentLoaded', function() {
    // Load existing profile data
    loadProfileData();
    
    // Set up event listeners
    document.getElementById('save-profile').addEventListener('click', saveProfileChanges);
    document.getElementById('block-button').addEventListener('click', blockUser);
    
    // Load blocked users list
    loadBlockedUsers();
});

function loadProfileData() {
    const userEmail = localStorage.getItem('userEmail');
    const userName = localStorage.getItem('userName');
    
    if (userEmail) {
        document.getElementById('email').value = userEmail;
    }
    
    if (userName) {
        document.getElementById('name').value = userName;
    }
    
    // Fetch phone number from server
    fetch('/api/get_profile', {
        method: 'GET',
        credentials: 'same-origin'
    })
    .then(response => response.json())
    .then(data => {
        if (data.phone) {
            document.getElementById('phone').value = data.phone;
        }
    })
    .catch(error => {
        console.error('Error loading profile:', error);
    });
}

// Function to validate phone number format
function isValidPhoneNumber(phone) {
  // Regex to allow only digits 0-9 and characters + - ( )
  const phoneRegex = /^[0-9()+\-\s]*$/;
  return phoneRegex.test(phone);
}

function saveProfileChanges() {
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    
    // Validate phone number format
    if (phone && !isValidPhoneNumber(phone)) {
        alert('Phone number can only contain digits 0-9 and the characters +, -, (, and )');
        // Reset phone field to original value
        document.getElementById('phone').value = localStorage.getItem('userPhone') || '';
        return;
    }
    
    fetch('/api/update_profile', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFTOKEN': csrfToken,
        },
        body: JSON.stringify({
            name: name,
            phone: phone
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            localStorage.setItem('userName', name);
            localStorage.setItem('userPhone', phone);
            showMessage('success-message', 'Profile updated successfully!');
        } else {
            showMessage('error-message', 'Error updating profile: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error updating profile:', error);
        showMessage('error-message', 'Error updating profile. Please try again.');
    });
}

function blockUser() {
    const uniToBlock = document.getElementById('block-uni').value.trim();
    if (!uniToBlock) {
        showMessage('error-message', 'Please enter a UNI to block');
        return;
    }
    
    fetch('/api/block_user', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFTOKEN': csrfToken,
        },
        body: JSON.stringify({
            blocked_uni: uniToBlock
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('block-uni').value = '';
            loadBlockedUsers();
            showMessage('success-message', 'User blocked successfully!');
        } else {
            showMessage('error-message', 'Error blocking user: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error blocking user:', error);
        showMessage('error-message', 'Error blocking user. Please try again.');
    });
}

function loadBlockedUsers() {
    fetch('/api/get_blocked_users', {
        method: 'GET',
        credentials: 'same-origin'
    })
    .then(response => response.json())
    .then(data => {
        const blockedList = document.getElementById('blocked-unis-list');
        const noBlocksMessage = document.getElementById('no-blocks-message');
        
        blockedList.innerHTML = '';
        
        if (data.blocked_users && data.blocked_users.length > 0) {
            noBlocksMessage.style.display = 'none';
            data.blocked_users.forEach(uni => {
                const li = document.createElement('li');
                li.style.margin = '5px 0';
                li.style.padding = '8px';
                li.style.backgroundColor = '#f5f5f5';
                li.style.borderRadius = '4px';
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                
                const uniSpan = document.createElement('span');
                uniSpan.textContent = uni;
                
                const unblockButton = document.createElement('button');
                unblockButton.textContent = 'Unblock';
                unblockButton.style.backgroundColor = '#4CAF50';
                unblockButton.style.color = 'white';
                unblockButton.style.border = 'none';
                unblockButton.style.padding = '5px 10px';
                unblockButton.style.borderRadius = '4px';
                unblockButton.style.cursor = 'pointer';
                unblockButton.onclick = () => unblockUser(uni);
                li.appendChild(uniSpan);
                li.appendChild(unblockButton);
                blockedList.appendChild(li);
            });
        } else {
            noBlocksMessage.style.display = 'block';
        }
    })
    .catch(error => {
        console.error('Error loading blocked users:', error);
    });
}

function unblockUser(uni) {
    fetch('/api/unblock_user', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFTOKEN': csrfToken,
        },
        body: JSON.stringify({
            blocked_uni: uni
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadBlockedUsers();
            showMessage('success-message', 'User unblocked successfully!');
        } else {
            showMessage('error-message', 'Error unblocking user: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error unblocking user:', error);
        showMessage('error-message', 'Error unblocking user. Please try again.');
    });
}

function showMessage(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';
    
    // Hide other message
    const otherElementId = elementId === 'success-message' ? 'error-message' : 'success-message';
    document.getElementById(otherElementId).style.display = 'none';
    
    // Hide message after 3 seconds
    setTimeout(() => {
        element.style.display = 'none';
    }, 3000);
} 