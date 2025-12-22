// ------------------- INITIALIZATION ------------------- 
AOS.init({ once: true, duration: 600 });

// ------------------- CONSTANTS -------------------
const CAL_GOAL = 4000;
const WORK_GOAL = 10;
const KEY_ACTIVE_USER = 'ft_active_user';
const ADMIN_VIEW_KEY = 'ft_admin_view_user';

// ------------------- SESSION CHECK -------------------
let activeUser = JSON.parse(localStorage.getItem(KEY_ACTIVE_USER));
let adminViewUser = localStorage.getItem(ADMIN_VIEW_KEY);
let isAdminView = false;

if (adminViewUser && localStorage.getItem('ft_is_admin') === 'true') {
    isAdminView = true;
    activeUser = JSON.parse(localStorage.getItem('ft_users') || '[]')
        .find(u => u.username === adminViewUser);
    if (!activeUser) {
        alert('User not found.');
        location.href = 'admin.html';
    }
} else {
    localStorage.removeItem(ADMIN_VIEW_KEY);
    if (!activeUser || !activeUser.username) {
        alert('No active user found. Please login.');
        location.href = 'login.html';
    }
}

// ------------------- STORAGE KEYS -------------------
const USER_KEY_ACTIVE = `ft_active_${activeUser.username}`;
const USER_KEY_ARCHIVE = `ft_archive_${activeUser.username}`;
const USER_KEY_AVATAR = `avatar_${activeUser.username}`;

// ------------------- DOM ELEMENTS -------------------
const dom = {
    avatar: document.getElementById('userAvatar'),
    avatarInput: document.getElementById('avatarInput'),
    userName: document.getElementById('userName'),

    addForm: document.getElementById('addFormUser'),
    activity: document.getElementById('activityUser'),
    duration: document.getElementById('durationUser'),
    calories: document.getElementById('caloriesUser'),
    date: document.getElementById('dateUser'),

    tableBody: document.getElementById('tableBodyUser'),
    archiveList: document.getElementById('archiveListUser'),

    avgCal: document.getElementById('avgCalUser'),
    avgDur: document.getElementById('avgDurUser'),
    freqAct: document.getElementById('freqActUser'),
    longest: document.getElementById('longestUser'),
    mostCal: document.getElementById('mostCalUser'),

    calBar: document.getElementById('calBarUser'),
    workBar: document.getElementById('workBarUser'),

    exportCSV: document.getElementById('exportCSVUser'),
    exportJSON: document.getElementById('exportJSONUser'),
    importFile: document.getElementById('importFileUser'),

    clearArchive: document.getElementById('clearArchiveUser'),
    restoreAll: document.getElementById('restoreAllUser'),

    logoutBtn: document.querySelectorAll('.logoutBtn'),
    adminButton: document.getElementById('adminButton'),

    charts: {
        calories: document.getElementById('caloriesChartUser'),
        duration: document.getElementById('durationChartUser')
    }
};





 
// ------------------- USER INFO -------------------
dom.userName.textContent = activeUser.username;
dom.date.value = new Date().toISOString().slice(0, 10);

const savedAvatar = localStorage.getItem(USER_KEY_AVATAR);
if (savedAvatar) dom.avatar.src = savedAvatar;

// ------------------- HELPERS -------------------
const uid = () => crypto.randomUUID();
const safeNum = v => Math.max(0, Number(v) || 0);
const read = k => JSON.parse(localStorage.getItem(k) || '[]');
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const isoToDisplay = d => new Date(d).toLocaleDateString();

// ------------------- ADMIN BUTTON VISIBILITY -------------------
if (dom.adminButton) {
    dom.adminButton.style.display = 'none';
    if (sessionStorage.getItem('fromAdminFlow') === 'true') {
        dom.adminButton.style.display = 'inline-block';
        sessionStorage.removeItem('fromAdminFlow');
    }
}

// ------------------- HOME BUTTON -------------------
const homeBtn = document.getElementById('homeButton');
if (homeBtn) {
    homeBtn.onclick = () => {
        // Clear active user session
        localStorage.removeItem(KEY_ACTIVE_USER);
        localStorage.removeItem(ADMIN_VIEW_KEY);

        // Clear flags for admin button visibility
        sessionStorage.removeItem('fromAdminFlow');
        sessionStorage.removeItem('fromHomeAdmin');

        // Redirect to Home page
        location.href = 'index.html';
    }
}



// ------------------- AVATAR -------------------
if (!isAdminView) {
    dom.avatarInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const r = new FileReader();
        r.onload = () => {
            dom.avatar.src = r.result;
            localStorage.setItem(USER_KEY_AVATAR, r.result);
        };
        r.readAsDataURL(file);
    });
} else {
    dom.avatarInput.style.display = 'none';
}

// ------------------- CRUD -------------------
function addWorkout(w) {
    if (isAdminView) return;
    write(USER_KEY_ACTIVE, [...read(USER_KEY_ACTIVE), w]);
    renderAll();
}

function deleteWorkout(id) {
    if (isAdminView) return;
    if (!confirm('Delete workout?')) return;
    write(USER_KEY_ACTIVE, read(USER_KEY_ACTIVE).filter(w => w.id !== id));
    renderAll();
}

function archiveWorkout(id) {
    if (isAdminView) return;
    const act = read(USER_KEY_ACTIVE);
    const item = act.find(w => w.id === id);
    if (!item) return;
    write(USER_KEY_ACTIVE, act.filter(w => w.id !== id));
    write(USER_KEY_ARCHIVE, [...read(USER_KEY_ARCHIVE), item]);
    renderAll();
}

function restoreArchived(id) {
    if (isAdminView) return;
    const arch = read(USER_KEY_ARCHIVE);
    const item = arch.find(w => w.id === id);
    if (!item) return;
    write(USER_KEY_ARCHIVE, arch.filter(w => w.id !== id));
    write(USER_KEY_ACTIVE, [...read(USER_KEY_ACTIVE), item]);
    renderAll();
}

// ------------------- TABLES -------------------
function renderTable() {
    const arr = read(USER_KEY_ACTIVE).sort((a, b) => b.date.localeCompare(a.date));
    dom.tableBody.innerHTML = arr.length ? arr.map(w => `
        <tr>
            <td>${isoToDisplay(w.date)}</td>
            <td>${w.activity}</td>
            <td>${safeNum(w.duration)} min</td>
            <td>${safeNum(w.calories)}</td>
            <td class="text-end">
                ${!isAdminView ? `
                <button class="btn btn-sm btn-danger del" data-id="${w.id}">✖</button>
                <button class="btn btn-sm btn-secondary arc" data-id="${w.id}">📦</button>` : ``}
            </td>
        </tr>`).join('') :
        `<tr><td colspan="5" class="text-muted text-center">No workouts</td></tr>`;

    document.querySelectorAll('.del').forEach(b => b.onclick = () => deleteWorkout(b.dataset.id));
    document.querySelectorAll('.arc').forEach(b => b.onclick = () => archiveWorkout(b.dataset.id));
}

function renderArchive() {
    const arr = read(USER_KEY_ARCHIVE);
    dom.archiveList.innerHTML = arr.length ? arr.map(w => `
        <li class="list-group-item d-flex justify-content-between">
            ${w.activity} • ${safeNum(w.calories)} cal
            ${!isAdminView ? `<button class="btn btn-sm btn-success res" data-id="${w.id}">↩</button>` : ``}
        </li>`).join('') :
        `<li class="list-group-item text-muted">No archived workouts</li>`;

    document.querySelectorAll('.res').forEach(b => b.onclick = () => restoreArchived(b.dataset.id));
}

// ------------------- CHART DATA AGGREGATION -------------------
function aggregateLast7Safe(arr) {
    const dates = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
    });

    const totalsCal = dates.map(d => {
        const total = arr.filter(w => w.date === d).reduce((s, w) => s + safeNum(w.calories), 0);
        return Math.max(0, total);
    });

    const totalsDur = dates.map(d => {
        const total = arr.filter(w => w.date === d).reduce((s, w) => s + safeNum(w.duration), 0);
        return Math.max(0, total);
    });

    return { dates, totalsCal, totalsDur };
}

// ------------------- CHARTS -------------------
let calChart, durChart;

function renderCharts() {
    const agg = aggregateLast7Safe(read(USER_KEY_ACTIVE));
    const labels = agg.dates.map(d => new Date(d).toLocaleDateString(undefined, { weekday: 'short' }));

    if (!calChart) {
        calChart = new Chart(dom.charts.calories, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Calories (Weekly Progress)', data: agg.totalsCal, borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,.15)', fill: true, tension: .35, pointRadius: 5 }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, suggestedMin: 0 } } }
        });
    } else {
        calChart.data.labels = labels;
        calChart.data.datasets[0].data = agg.totalsCal;
        calChart.options.scales.y.beginAtZero = true;
        calChart.update();
    }

    if (!durChart) {
        durChart = new Chart(dom.charts.duration, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Minutes (Last 7 Days)', data: agg.totalsDur, backgroundColor: 'rgba(25,135,84,.25)', borderColor: '#198754', borderWidth: 1, borderRadius: 6 }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, suggestedMin: 0 } } }
        });
    } else {
        durChart.data.labels = labels;
        durChart.data.datasets[0].data = agg.totalsDur;
        durChart.options.scales.y.beginAtZero = true;
        durChart.update();
    }

    return agg;
}

// ------------------- STATS -------------------
function updateStats(agg) {
    const active = read(USER_KEY_ACTIVE);
    const archive = read(USER_KEY_ARCHIVE);
    const combined = active.concat(archive).map(w => ({ ...w, duration: safeNum(w.duration), calories: safeNum(w.calories) }));

    // Average calories/day
    const totalCal = combined.reduce((s, w) => s + w.calories, 0);
    dom.avgCal.textContent = `${Math.round(totalCal / 7)} cal/day`;

    // Average duration
    const avgDur = combined.length ? Math.round(combined.reduce((s, w) => s + w.duration, 0) / combined.length) : 0;
    dom.avgDur.textContent = `${avgDur} min`;

    // Most frequent activity
    const freq = {};
    combined.forEach(w => freq[w.activity] = (freq[w.activity] || 0) + 1);
    dom.freqAct.textContent = Object.keys(freq).length ? Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] : '-';

    // Longest workout
    const longest = combined.length ? combined.reduce((a, b) => b.duration > a.duration ? b : a) : null;
    dom.longest.textContent = longest ? `${longest.activity} - ${longest.duration} min` : '-';

    // Most burned calories
    const most = combined.length ? combined.reduce((a, b) => b.calories > a.calories ? b : a) : null;
    dom.mostCal.textContent = most && most.activity && most.calories > 0 ? `${most.activity} - ${most.calories} cal` : '—';

    // Progress bars
    const calTotal = agg.totalsCal.reduce((s, v) => s + safeNum(v), 0);
    const calPct = Math.min(100, Math.max(0, Math.round(calTotal / CAL_GOAL * 100)));
    const workPct = Math.min(100, Math.max(0, Math.round(active.length / WORK_GOAL * 100)));

    dom.calBar.style.width = calPct + '%'; dom.calBar.textContent = calPct + '%';
    dom.workBar.style.width = workPct + '%'; dom.workBar.textContent = workPct + '%';
}

// ------------------- RENDER EVERYTHING -------------------
function renderAll() {
    const agg = renderCharts();
    renderTable();
    renderArchive();
    updateStats(agg);
}

// ------------------- ADMIN HARD LOCK -------------------
if (isAdminView) {
    document.querySelectorAll('input, select, textarea, button')
        .forEach(el => {
            if (el === dom.exportCSV || el === dom.exportJSON || el.classList.contains('logoutBtn')) return;
            el.disabled = true;
        });
    dom.addForm?.addEventListener('submit', e => e.preventDefault());
}

// ------------------- LOGOUT -------------------
dom.logoutBtn.forEach(b => b.onclick = () => {
    localStorage.removeItem(KEY_ACTIVE_USER);
    localStorage.removeItem(ADMIN_VIEW_KEY);
    location.href = 'login.html';
});

// ------------------- EVENT LISTENERS -------------------
document.addEventListener('DOMContentLoaded', () => {
    if (!isAdminView) {
        dom.addForm?.addEventListener('submit', e => {
            e.preventDefault();
            const item = {
                id: uid(),
                activity: dom.activity.value.trim(),
                duration: safeNum(dom.duration.value),
                calories: safeNum(dom.calories.value),
                date: dom.date.value || new Date().toISOString().slice(0, 10)
            };
            if (!item.activity || item.duration <= 0 || item.calories <= 0) return alert('Enter valid values');
            addWorkout(item);
            dom.activity.value = '';
            dom.duration.value = 30;
            dom.calories.value = 300;
            dom.date.value = new Date().toISOString().slice(0, 10);
        });

        dom.importFile?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const arr = JSON.parse(reader.result);
                    if (Array.isArray(arr)) write(USER_KEY_ACTIVE, arr);
                    renderAll();
                } catch {
                    alert('Invalid JSON file');
                }
            };
            reader.readAsText(file);
        });
    }

    dom.exportCSV?.addEventListener('click', () => {
        const arr = read(USER_KEY_ACTIVE);
        const csv = ["Date,Activity,Duration,Calories", ...arr.map(w => `${w.date},${w.activity},${w.duration},${w.calories}`)].join("\n");
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'workouts.csv'; a.click();
    });

    dom.exportJSON?.addEventListener('click', () => {
        const arr = read(USER_KEY_ACTIVE);
        const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'workouts.json'; a.click();
    });
});

// ------------------- INITIAL RENDER -------------------
renderAll();