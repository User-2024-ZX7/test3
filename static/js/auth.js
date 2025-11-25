// static/js/auth.js
document.addEventListener('DOMContentLoaded', () => {
  const currentUser = JSON.parse(localStorage.getItem('fittrack_session'));

  // If no user, redirect to login page
  if (!currentUser) {
    alert('You must log in to access this page.');
    window.location.href = 'login.html';
    return;
  }

  // Display username in navbar (optional)
  const nav = document.querySelector('.navbar .container nav ul');
  if (nav && !document.querySelector('#nav-user')) {
    const li = document.createElement('li');
    li.id = 'nav-user';
    li.innerHTML = `<a href="#">👋 ${currentUser.username}</a>`;
    nav.appendChild(li);
  }

  // Logout handler
  const logoutLink = document.querySelector('a[href="logout.html"]');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('fittrack_session');
      alert('Logged out successfully.');
      window.location.href = 'login.html';
    });
  }
});
