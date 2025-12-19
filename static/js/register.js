const form = document.getElementById('register-form');
const feedback = document.getElementById('register-feedback');
const KEY_USERS = 'ft_users';

function readUsers() {
    return JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
}

form.addEventListener('submit', e => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    if (!username || !email || !password) {
        feedback.textContent = "All fields are required!";
        feedback.style.color = 'red';
        return;
    }

    let users = readUsers();

    if (users.some(u => u.username === username)) {
        feedback.textContent = "Username already registered!";
        feedback.style.color = 'red';
        return;
    }

    if (users.some(u => u.email === email)) {
        feedback.textContent = "Email already registered!";
        feedback.style.color = 'red';
        return;
    }

    // Always normal user, cannot register as admin
    const newUser = { username, email, password, role: 'user' };
    users.push(newUser);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));

    feedback.textContent = "Registration successful! Redirecting...";
    feedback.style.color = 'green';

    setTimeout(() => {
        localStorage.setItem('ft_active_user', JSON.stringify(newUser));
        window.location.href = 'user.html';
    }, 1200);
});
