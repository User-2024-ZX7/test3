// -------------------- CONSTANTS --------------------
const KEY_USERS = 'ft_users';
const KEY_ACTIVE_USER = 'ft_active_user';
const ADMIN = {
    username: 'admin',
    email: 'admin@fittrack.com',
    password: 'admin123',
    role: 'admin'
};

// -------------------- ADMIN SETUP --------------------
function ensureAdmin() {
    let users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
    if (!users.some(u => u.role === 'admin')) {
        users.push(ADMIN);
        localStorage.setItem(KEY_USERS, JSON.stringify(users));
    }
}

// -------------------- FEEDBACK --------------------
function showFeedback(msg, color = 'red') {
    const feedback = document.getElementById('login-feedback');
    if (feedback) {
        feedback.textContent = msg;
        feedback.style.color = color;
    }
}

// -------------------- LOGIN --------------------
function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    if (!email || !password) return showFeedback('Both fields are required!');

    const users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
    const user = users.find(u => u.email.toLowerCase() === email && u.password === password);

    if (!user) return showFeedback('Incorrect email or password!');

    localStorage.setItem(KEY_ACTIVE_USER, JSON.stringify(user));

    // Redirect to user page
    window.location.href = 'user.html';
}

// -------------------- LOGOUT --------------------
function logoutUser() {
    sessionStorage.clear();
    localStorage.removeItem(KEY_ACTIVE_USER);
    window.location.href = 'index.html';
}

// -------------------- ACCESS CONTROL --------------------
function checkAccess(required = 'user') {
    const activeUser = JSON.parse(localStorage.getItem(KEY_ACTIVE_USER));
    if (!activeUser) {
        window.location.href = 'login.html';
        return false;
    }
    if (required === 'admin' && activeUser.role !== 'admin') {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// -------------------- HOME BUTTON LOGOUT --------------------
function attachHomeLogout() {
    const homeLink = document.querySelector('.nav-link[href="#home"]');
    if (homeLink) {
        homeLink.addEventListener('click', e => {
            e.preventDefault();
            logoutUser();
        });
    }
}

// -------------------- INIT --------------------
document.addEventListener('DOMContentLoaded', () => {
    ensureAdmin();

    // Attach login form handler if it exists
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    // Attach Home logout button if it exists
    attachHomeLogout();
});

