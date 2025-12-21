const form = document.getElementById('login-form');
const feedback = document.getElementById('login-feedback');

const KEY_USERS = 'ft_users';
const KEY_ACTIVE_USER = 'ft_active_user';
const KEY_ARCHIVED_USERS = 'ft_archived_users';

// -------------------- SINGLE ADMIN --------------------
const ADMIN = {
    username: 'admin',
    email: 'admin@fittrack.com',
    password: 'admin123',
    role: 'admin'
};

// Ensure admin exists (ONLY ONCE)
let users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
if (!users.some(u => u.role === 'admin')) {
    users.push(ADMIN);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
}

// -------------------- LOGIN --------------------
form.addEventListener('submit', e => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        feedback.textContent = 'Both fields are required!';
        feedback.style.color = 'red';
        return;
    }

    const users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
    const archived = JSON.parse(localStorage.getItem(KEY_ARCHIVED_USERS) || '[]');

    // 🔒 BLOCK archived users
    const isArchived = archived.some(
        u => u.email.toLowerCase() === email
    );

    if (isArchived) {
        feedback.textContent = 'This account has been disabled by admin.';
        feedback.style.color = 'red';
        return;
    }

    const user = users.find(
        u => u.email.toLowerCase() === email && u.password === password
    );

    if (!user) {
        feedback.textContent = 'Incorrect email or password!';
        feedback.style.color = 'red';
        return;
    }

    // Save active identity (ADMIN or USER)
    localStorage.setItem(KEY_ACTIVE_USER, JSON.stringify(user));

    // Redirect based on role
    if (user.role === 'admin') {
        window.location.href = 'admin.html';
    } else {
        window.location.href = 'user.html';
    }
});
