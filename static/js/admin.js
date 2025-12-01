const userTableBody = document.getElementById("userTableBody");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const clearSearch = document.getElementById("clearSearch");
const exportCSV = document.getElementById("exportCSV");
const exportJSON = document.getElementById("exportJSON");
const logoutBtn = document.getElementById("logout-btn");
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");

const statTotalUsers = document.getElementById("totalUsers");
const statActiveUsers = document.getElementById("activeUsers");
const statTotalWorkouts = document.getElementById("totalWorkouts");
const statTotalCalories = document.getElementById("totalCalories");

let USERS = [];

// ==================== FETCH USERS ====================
const loadUsers = async () => {
try {
const res = await fetch("/admin/get_users");
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
};

// ==================== RENDER TABLE ====================
const renderTable = (users) => {
userTableBody.innerHTML = users.length
? users.map(user => `             <tr>                 <td><strong>${user.username}</strong></td>                 <td>${user.email}</td>                 <td><span class="badge ${user.status === "active" ? "bg-success" : "bg-secondary"}">${user.status}</span></td>                 <td>${user.workouts ?? 0}</td>                 <td>${user.calories ?? 0}</td>                 <td>${user.lastLogin ?? "—"}</td>                 <td class="text-center">                     <button class="btn btn-sm btn-warning me-1 toggle-status-btn" data-username="${user.username}">                         <i class="fa-solid fa-user-gear"></i>                     </button>                     <button class="btn btn-sm btn-danger delete-btn" data-username="${user.username}">                         <i class="fa-solid fa-trash"></i>                     </button>                 </td>             </tr>
        `).join('')
: `<tr><td colspan="7" class="text-center p-4 text-muted">No users found</td></tr>`;
};

// ==================== SEARCH ====================
const searchUsers = () => {
const query = searchInput.value.toLowerCase().trim();
renderTable(USERS.filter(u => u.username.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)));
};

searchBtn.addEventListener("click", searchUsers);
clearSearch.addEventListener("click", () => {
searchInput.value = "";
renderTable(USERS);
});
searchInput.addEventListener("input", searchUsers);

// ==================== EXPORT ====================
const exportData = (format) => {
let blob, filename;
if (format === "csv") {
const csv = ["Username,Email,Status,Workouts,Calories,Last Login",
...USERS.map(u => `${u.username},${u.email},${u.status},${u.workouts},${u.calories},${u.lastLogin}`)].join("\n");
blob = new Blob([csv], { type: "text/csv" });
filename = "fittrack_users.csv";
} else {
blob = new Blob([JSON.stringify(USERS, null, 2)], { type: "application/json" });
filename = "fittrack_users.json";
}
const link = document.createElement("a");
link.href = URL.createObjectURL(blob);
link.download = filename;
link.click();
};

exportCSV.addEventListener("click", () => exportData("csv"));
exportJSON.addEventListener("click", () => exportData("json"));

// ==================== USER ACTIONS ====================
userTableBody.addEventListener("click", (e) => {
const username = e.target.closest("button")?.dataset.username;
if (!username) return;

```
if (e.target.closest(".delete-btn")) deleteUser(username);
if (e.target.closest(".toggle-status-btn")) toggleStatus(username);
```

});

const deleteUser = (username) => {
if (!confirm(`Delete user "${username}"?`)) return;
USERS = USERS.filter(u => u.username !== username);
localStorage.setItem("fittrack_users", JSON.stringify(USERS));
renderTable(USERS);
updateStats();
};

const toggleStatus = (username) => {
USERS = USERS.map(u => u.username === username ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u);
renderTable(USERS);
updateStats();
};

// ==================== DASHBOARD STATS ====================
const updateStats = () => {
animateNumber(statTotalUsers, USERS.length);
animateNumber(statActiveUsers, USERS.filter(u => u.status === "active").length);
animateNumber(statTotalWorkouts, USERS.reduce((a, u) => a + (u.workouts ?? 0), 0));
animateNumber(statTotalCalories, USERS.reduce((a, u) => a + (u.calories ?? 0), 0));
};

const animateNumber = (el, value) => {
let start = 0;
const duration = 900;
const step = value / (duration / 16);
const update = () => {
start += step;
el.textContent = start >= value ? value : Math.floor(start);
if (start < value) requestAnimationFrame(update);
};
update();
};

// ==================== SIDEBAR (MOBILE) ====================
menuToggle?.addEventListener("click", () => sidebar.classList.toggle("open"));

// ==================== LOGOUT ====================
logoutBtn.addEventListener("click", () => {
localStorage.removeItem("fittrack_session");
window.location.href = "logout.html";
});

// ==================== INIT ====================
loadUsers();
