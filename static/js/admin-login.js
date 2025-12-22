// ------------------ CONSTANTS ------------------
const KEY_ACTIVE_USER = 'ft_active_user';
const KEY_USERS = 'ft_users';
const loginForm = document.getElementById('adminLoginForm');
const feedback = document.getElementById('loginFeedback');

// Fixed admin credentials
const ADMIN_CREDENTIALS = {
  email: 'admin@fittrack.com',
  username: 'FitAdmin',
  password: 'SuperSecret123',
  role: 'admin'
};

// Ensure admin exists in users
let users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
if(!users.some(u => u.role==='admin')) {
  users.push(ADMIN_CREDENTIALS);
  localStorage.setItem(KEY_USERS, JSON.stringify(users));
}

// ------------------ LOGIN ------------------
loginForm.addEventListener('submit', e => {
  e.preventDefault();

  const email = document.getElementById('adminEmail').value.trim().toLowerCase();
  const username = document.getElementById('adminName').value.trim();
  const password = document.getElementById('adminPassword').value.trim();

  // Check credentials
  if(email===ADMIN_CREDENTIALS.email.toLowerCase() &&
     username===ADMIN_CREDENTIALS.username &&
     password===ADMIN_CREDENTIALS.password) {
    
    // Save active user
    localStorage.setItem(KEY_ACTIVE_USER, JSON.stringify(ADMIN_CREDENTIALS));

    // Redirect to admin page
    window.location.href = 'admin.html';
  } else {
    feedback.textContent = 'Incorrect credentials. Please try again.';
  }
});