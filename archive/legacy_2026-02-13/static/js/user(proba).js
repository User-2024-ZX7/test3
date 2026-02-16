// ------------------- INIT -------------------
AOS.init({ once: true, duration: 600 });

// ------------------- CONSTANTS -------------------
const CAL_GOAL = 4000;
const WORK_GOAL = 10;

const KEY_ACTIVE_USER = 'ft_active_user';     // AUTH identity
const KEY_ADMIN_VIEW = 'ft_admin_view_user';  // TEMP context
const KEY_USERS = 'ft_users';

// ------------------- AUTH SESSION -------------------
const authUser = JSON.parse(localStorage.getItem(KEY_ACTIVE_USER));

if (!authUser || !authUser.username || !authUser.role) {
    localStorage.removeItem(KEY_ADMIN_VIEW);
    alert('Session expired. Please login.');
    window.location.href = 'login.html';
    throw new Error('No auth session');
}

// ------------------- ADMIN VIEW CONTEXT -------------------
let isAdminView = false;
let viewUser = null;

if (authUser.role === 'admin') {
    const viewUsername = localStorage.getItem(KEY_ADMIN_VIEW);
    if (viewUsername) {
        const users = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
        const found = users.find(u => u.username === viewUsername);
        if (found) {
            viewUser = found;
            isAdminView = true;
        } else {
            localStorage.removeItem(KEY_ADMIN_VIEW);
        }
    }
}

// ------------------- DATA SOURCE (NEVER IDENTITY) -------------------
const dataUser = isAdminView ? viewUser : authUser;

// ------------------- STORAGE KEYS -------------------
const USER_KEY_ACTIVE = `ft_active_${dataUser.username}`;
const USER_KEY_ARCHIVE = `ft_archive_${dataUser.username}`;
const USER_KEY_AVATAR = `avatar_${dataUser.username}`;

// ------------------- DOM -------------------
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
    exportCSV: document.getElementById('exportCSVUser'),
    exportJSON: document.getElementById('exportJSONUser'),
    logoutBtn: document.querySelectorAll('.logoutBtn'),
    charts: {
        calories: document.getElementById('caloriesChartUser'),
        duration: document.getElementById('durationChartUser')
    }
};

// ------------------- UI HEADER -------------------
dom.userName.textContent = dataUser.username;
dom.date.value = new Date().toISOString().slice(0,10);

// ------------------- HELPERS -------------------
const uid = () => crypto.randomUUID();
const safeNum = v => Number.isFinite(+v) ? Math.max(0, Math.round(v)) : 0;
const read = k => JSON.parse(localStorage.getItem(k) || '[]');
const write = (k,v) => localStorage.setItem(k, JSON.stringify(v));

// ------------------- AVATAR -------------------
const savedAvatar = localStorage.getItem(USER_KEY_AVATAR);
if (savedAvatar) dom.avatar.src = savedAvatar;

if (isAdminView) {
    dom.avatarInput.style.display = 'none';
} else {
    dom.avatarInput.onchange = e => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
            dom.avatar.src = r.result;
            localStorage.setItem(USER_KEY_AVATAR, r.result);
        };
        r.readAsDataURL(f);
    };
}

// ------------------- ADMIN READ-ONLY LOCK -------------------
if (isAdminView) {
    dom.activity.disabled = true;
    dom.duration.disabled = true;
    dom.calories.disabled = true;
    dom.date.disabled = true;
    dom.addForm.querySelector('button[type="submit"]')?.setAttribute('disabled', true);

    dom.addForm.insertAdjacentHTML(
        'beforebegin',
        `<div class="alert alert-info">
            Admin is viewing this account in <strong>read-only mode</strong>.
        </div>`
    );
}

// ------------------- CRUD (HARD BLOCK) -------------------
function addWorkout(item) {
    if (isAdminView) return;
    const arr = read(USER_KEY_ACTIVE);
    arr.push(item);
    write(USER_KEY_ACTIVE, arr);
    renderAll();
}

function deleteWorkout(id) {
    if (isAdminView) return;
    write(USER_KEY_ACTIVE, read(USER_KEY_ACTIVE).filter(w => w.id !== id));
    renderAll();
}

// ------------------- TABLE -------------------
function renderTable() {
    const arr = read(USER_KEY_ACTIVE);
    dom.tableBody.innerHTML = arr.map(w => `
        <tr>
            <td>${w.date}</td>
            <td>${w.activity}</td>
            <td>${safeNum(w.duration)} min</td>
            <td>${safeNum(w.calories)}</td>
            <td class="text-end">
                ${!isAdminView ? `
                <button class="btn btn-sm btn-danger del" data-id="${w.id}">🗑</button>` : ''}
            </td>
        </tr>
    `).join('') || `<tr><td colspan="5" class="text-muted text-center">No workouts</td></tr>`;

    if (!isAdminView) {
        document.querySelectorAll('.del')
            .forEach(b => b.onclick = () => deleteWorkout(b.dataset.id));
    }
}

// ------------------- CHARTS (FIXED) -------------------
let calChart, durChart;

function renderCharts() {
    const data = read(USER_KEY_ACTIVE);

    const days = [...Array(7)].map((_,i)=>{
        const d = new Date();
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() - 6 + i);
        return d;
    });

    const labels = days.map(d => d.toLocaleDateString(undefined,{weekday:'short'}));
    const calData = days.map(d=>{
        const k = d.toISOString().slice(0,10);
        return data.filter(w=>w.date===k).reduce((s,w)=>s+safeNum(w.calories),0);
    });
    const durData = days.map(d=>{
        const k = d.toISOString().slice(0,10);
        return data.filter(w=>w.date===k).reduce((s,w)=>s+safeNum(w.duration),0);
    });

    if (!calChart) {
        calChart = new Chart(dom.charts.calories,{
            type:'line',
            data:{labels,datasets:[{data:calData,fill:true,borderColor:'#0d6efd'}]},
            options:{scales:{y:{beginAtZero:true}}}
        });
        durChart = new Chart(dom.charts.duration,{
            type:'bar',
            data:{labels,datasets:[{data:durData,backgroundColor:'#00b4ff'}]},
            options:{scales:{y:{beginAtZero:true}}}
        });
    } else {
        calChart.data.datasets[0].data = calData;
        durChart.data.datasets[0].data = durData;
        calChart.update();
        durChart.update();
    }
}

// ------------------- ADD FORM -------------------
if (!isAdminView) {
    dom.addForm.onsubmit = e => {
        e.preventDefault();
        addWorkout({
            id: uid(),
            activity: dom.activity.value.trim(),
            duration: safeNum(dom.duration.value),
            calories: safeNum(dom.calories.value),
            date: dom.date.value
        });
        dom.addForm.reset();
    };
}

// ------------------- LOGOUT -------------------
dom.logoutBtn.forEach(b => b.onclick = () => {
    localStorage.removeItem(KEY_ACTIVE_USER);
    localStorage.removeItem(KEY_ADMIN_VIEW);
    window.location.href = 'login.html';
});

// ------------------- AUTO-CLEAR ADMIN VIEW -------------------
window.addEventListener('beforeunload', () => {
    if (authUser.role === 'admin') {
        localStorage.removeItem(KEY_ADMIN_VIEW);
    }
});

// ------------------- RENDER -------------------
function renderAll() {
    renderCharts();
    renderTable();
}
renderAll();
