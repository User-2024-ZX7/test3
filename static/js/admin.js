/* =======================================================
   FitTrack Admin Panel - Senior-Level JavaScript
   Author: 500000005 (Senior-Level UI Development)
   ======================================================= */

/* ------------------------------
   GLOBAL ELEMENTS
------------------------------ */
const userTableBody = document.getElementById("userTableBody");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const clearSearch = document.getElementById("clearSearch");
const exportCSV = document.getElementById("exportCSV");
const exportJSON = document.getElementById("exportJSON");
const logoutBtn = document.getElementById("logout-btn");

/* Mobile sidebar */
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle"); // exists only on mobile topbar

/* Dashboard stats */
const statTotalUsers = document.getElementById("totalUsers");
const statActiveUsers = document.getElementById("activeUsers");
const statTotalWorkouts = document.getElementById("totalWorkouts");
const statTotalCalories = document.getElementById("totalCalories");

let USERS = []; // will store loaded users

/* =======================================================
   SECTION 1 — FETCH USERS (Flask API → fallback localStorage)
======================================================= */
async function loadUsers() {
    try {
        const res = await fetch("/admin/get_users"); // your upcoming Flask route
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        USERS = data.users;
    } catch {
        console.warn("Backend unavailable — using localStorage fallback.");

        USERS = JSON.parse(localStorage.getItem("fittrack_users") || "[]").map(u => ({
            username: u.username,
            email: u.email,
            status: "active",
            workouts: u.workouts || 0,
            calories: u.calories || 0,
            lastLogin: u.lastLogin || "Unknown"
        }));
    }
    renderTable(USERS);
    updateStats();
}

/* =======================================================
   SECTION 2 — RENDER USER TABLE
======================================================= */
function renderTable(users) {
    userTableBody.innerHTML = "";

    if (users.length === 0) {
        userTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center p-4 text-muted">No users found</td>
            </tr>`;
        return;
    }

    users.forEach(user => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td><strong>${user.username}</strong></td>
            <td>${user.email}</td>
            <td>
                <span class="badge ${user.status === "active" ? "bg-success" : "bg-secondary"}">
                    ${user.status}
                </span>
            </td>
            <td>${user.workouts ?? 0}</td>
            <td>${user.calories ?? 0}</td>
            <td>${user.lastLogin ?? "—"}</td>

            <td class="text-center">
                <button class="btn btn-sm btn-warning me-1 action-btn" onclick="toggleStatus('${user.username}')">
                    <i class="fa-solid fa-user-gear"></i>
                </button>
                <button class="btn btn-sm btn-danger action-btn" onclick="deleteUser('${user.username}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;

        userTableBody.appendChild(row);
    });
}

/* =======================================================
   SECTION 3 — SEARCH USER
======================================================= */
function searchUsers() {
    const query = searchInput.value.toLowerCase().trim();
    const filtered = USERS.filter(
        u =>
            u.username.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query)
    );
    renderTable(filtered);
}

searchBtn.onclick = searchUsers;
clearSearch.onclick = () => {
    searchInput.value = "";
    renderTable(USERS);
};

/* Live search */
searchInput.addEventListener("keyup", () => {
    if (searchInput.value.trim() === "") renderTable(USERS);
});

/* =======================================================
   SECTION 4 — EXPORT FUNCTIONS
======================================================= */
exportCSV.onclick = () => {
    let csv = "Username,Email,Status,Workouts,Calories,Last Login\n";
    USERS.forEach(u => {
        csv += `${u.username},${u.email},${u.status},${u.workouts},${u.calories},${u.lastLogin}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "fittrack_users.csv";
    link.click();
};

exportJSON.onclick = () => {
    const blob = new Blob([JSON.stringify(USERS, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "fittrack_users.json";
    link.click();
};

/* =======================================================
   SECTION 5 — USER ACTIONS (Delete, Toggle Status)
======================================================= */
function deleteUser(username) {
    if (!confirm(`Delete user "${username}"?`)) return;

    USERS = USERS.filter(u => u.username !== username);

    // Update localStorage fallback
    localStorage.setItem("fittrack_users", JSON.stringify(USERS));

    renderTable(USERS);
    updateStats();
}

function toggleStatus(username) {
    USERS = USERS.map(u =>
        u.username === username
            ? { ...u, status: u.status === "active" ? "inactive" : "active" }
            : u
    );

    renderTable(USERS);
    updateStats();
}

/* =======================================================
   SECTION 6 — DASHBOARD STATS
======================================================= */
function updateStats() {
    animateNumber(statTotalUsers, USERS.length);

    const activeCount = USERS.filter(u => u.status === "active").length;
    animateNumber(statActiveUsers, activeCount);

    const totalWorkouts = USERS.reduce((a, b) => a + (b.workouts ?? 0), 0);
    animateNumber(statTotalWorkouts, totalWorkouts);

    const totalCalories = USERS.reduce((a, b) => a + (b.calories ?? 0), 0);
    animateNumber(statTotalCalories, totalCalories);
}

/* Smooth counter animation */
function animateNumber(el, value) {
    let start = 0;
    const duration = 900;
    const step = value / (duration / 16);

    function update() {
        start += step;
        if (start >= value) {
            el.textContent = value;
        } else {
            el.textContent = Math.floor(start);
            requestAnimationFrame(update);
        }
    }
    update();
}

/* =======================================================
   SECTION 7 — SIDEBAR (Mobile Toggle)
======================================================= */
if (menuToggle) {
    menuToggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });
}

/* =======================================================
   SECTION 8 — LOGOUT
======================================================= */
logoutBtn.onclick = () => {
    localStorage.removeItem("fittrack_session");
    window.location.href = "login.html";
};

/* =======================================================
   INIT
======================================================= */
loadUsers();
