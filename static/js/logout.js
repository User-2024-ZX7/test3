// logout.js

// Function to log out the user
function logoutUser() {
    // Clear session / local storage
    sessionStorage.clear();
    localStorage.removeItem('ft_active_user'); // remove active user info

    // Redirect to homepage
    window.location.href = 'index.html';
}

// Attach logout to Home button
function attachHomeLogout() {
    const homeLink = document.querySelector('.nav-link[href="#home"]');
    if (homeLink) {
        homeLink.addEventListener('click', (e) => {
            e.preventDefault(); // prevent default scroll
            logoutUser();
        });
    }
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
    attachHomeLogout();
});
