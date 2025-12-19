// Wait 500ms to show spinner, then clear session & redirect
setTimeout(() => {
    // Remove active user and optionally avatar
    localStorage.removeItem('ft_active_user');

    // Optional: clear per-user data from session (active workouts / archive remain per-user)
    // localStorage.removeItem(`ft_active_${activeUser.email}`);
    // localStorage.removeItem(`ft_archive_${activeUser.email}`);

    // Redirect to login page
    window.location.href = 'login.html';
}, 500);



