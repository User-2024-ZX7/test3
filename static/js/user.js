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

if (adminViewUser) {
    // Admin read-only mode
    isAdminView = true;
    activeUser = JSON.parse(localStorage.getItem('ft_users') || '[]').find(u => u.username === adminViewUser);
    if (!activeUser) {
        alert('User not found.');
        window.location.href = 'admin.html';
    }
} else {
    if (!activeUser || !activeUser.username) {
        alert('No active user found. Please login.');
        window.location.href = 'login.html';
    }
}

// ------------------- KEYS -------------------
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
    calBar: document.getElementById('calBarUser'),
    workBar: document.getElementById('workBarUser'),
    exportCSV: document.getElementById('exportCSVUser'),
    exportJSON: document.getElementById('exportJSONUser'),
    importFile: document.getElementById('importFileUser'),
    clearArchive: document.getElementById('clearArchiveUser'),
    restoreAll: document.getElementById('restoreAllUser'),
    logoutBtn: document.querySelectorAll('.logoutBtn'),
    charts: {
        calories: document.getElementById('caloriesChartUser'),
        duration: document.getElementById('durationChartUser')
    }
};

// ------------------- DISPLAY USER INFO -------------------
dom.userName.textContent = activeUser.username;
dom.date.value = new Date().toISOString().slice(0, 10);

// Load avatar
const savedAvatar = localStorage.getItem(USER_KEY_AVATAR);
if (savedAvatar) dom.avatar.src = savedAvatar;

// ------------------- HELPER FUNCTIONS -------------------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const safeNum = v => { v = Number(v); return Number.isFinite(v)?Math.max(0,Math.round(v)):0; };
const isoToDisplay = iso => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
};
const read = key => JSON.parse(localStorage.getItem(key) || '[]');
const write = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// ------------------- AVATAR -------------------
if (!isAdminView) {
    dom.avatarInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            dom.avatar.src = reader.result;
            localStorage.setItem(USER_KEY_AVATAR, reader.result);
        };
        reader.readAsDataURL(file);
    });
} else {
    dom.avatarInput.style.display = 'none';
}

// ------------------- WORKOUT CRUD -------------------
function addWorkout(item) {
    if (isAdminView) return;
    const arr = read(USER_KEY_ACTIVE);
    arr.push(item);
    write(USER_KEY_ACTIVE, arr);
    renderAll();
}

function deleteWorkout(id) {
    if (isAdminView) return;
    if (!confirm('Delete this workout?')) return;
    const arr = read(USER_KEY_ACTIVE).filter(w => w.id !== id);
    write(USER_KEY_ACTIVE, arr);
    renderAll();
}

function archiveWorkout(id) {
    if (isAdminView) return;
    const activeArr = read(USER_KEY_ACTIVE);
    const item = activeArr.find(w => w.id === id);
    if (!item) return;
    write(USER_KEY_ACTIVE, activeArr.filter(w => w.id !== id));
    const archiveArr = read(USER_KEY_ARCHIVE);
    archiveArr.push(item);
    write(USER_KEY_ARCHIVE, archiveArr);
    renderAll();
}

function restoreArchived(id) {
    if (isAdminView) return;
    const archiveArr = read(USER_KEY_ARCHIVE);
    const item = archiveArr.find(w => w.id === id);
    if (!item) return;
    write(USER_KEY_ARCHIVE, archiveArr.filter(w => w.id !== id));
    const activeArr = read(USER_KEY_ACTIVE);
    activeArr.push(item);
    write(USER_KEY_ACTIVE, activeArr);
    renderAll();
}

// ------------------- RENDER TABLES -------------------
function renderTable() {
    const arr = read(USER_KEY_ACTIVE).sort((a,b)=>b.date.localeCompare(a.date));
    dom.tableBody.innerHTML = arr.map(w=>`
    <tr>
        <td>${isoToDisplay(w.date)}</td>
        <td>${w.activity}</td>
        <td>${safeNum(w.duration)} min</td>
        <td>${safeNum(w.calories)}</td>
        <td class="text-end">
            <div class="btn-group btn-group-sm">
                ${!isAdminView?`<button class="btn btn-outline-danger btn-delete" data-id="${w.id}"><i class="fa-solid fa-trash"></i></button>`:''}
                ${!isAdminView?`<button class="btn btn-outline-secondary btn-archive" data-id="${w.id}"><i class="fa-solid fa-box-archive"></i></button>`:''}
            </div>
        </td>
    </tr>`).join('') || `<tr><td colspan="5" class="text-center text-muted">No workouts logged</td></tr>`;

    if (!isAdminView) {
        document.querySelectorAll('.btn-delete').forEach(b => b.onclick = () => deleteWorkout(b.dataset.id));
        document.querySelectorAll('.btn-archive').forEach(b => b.onclick = () => archiveWorkout(b.dataset.id));
    }
}

function renderArchive() {
    const arr = read(USER_KEY_ARCHIVE).sort((a,b)=>b.date.localeCompare(a.date));
    dom.archiveList.innerHTML = arr.map(w => `
    <li class="list-group-item d-flex justify-content-between align-items-start">
        <div>
            <strong>${w.activity}</strong>
            <div class="small-muted">${isoToDisplay(w.date)} • ${safeNum(w.duration)} min • ${safeNum(w.calories)} cal</div>
        </div>
        <div class="btn-group">
            ${!isAdminView?`<button class="btn btn-sm btn-outline-success btn-restore" data-id="${w.id}"><i class="fa-solid fa-rotate-left"></i></button>`:''}
            ${!isAdminView?`<button class="btn btn-sm btn-outline-danger btn-del-arch" data-id="${w.id}"><i class="fa-solid fa-trash"></i></button>`:''}
        </div>
    </li>`).join('') || `<li class="list-group-item text-muted">No archived workouts</li>`;

    if (!isAdminView) {
        document.querySelectorAll('.btn-restore').forEach(b => b.onclick = () => restoreArchived(b.dataset.id));
        document.querySelectorAll('.btn-del-arch').forEach(b => {
            b.onclick = () => {
                if (!confirm('Delete archived item permanently?')) return;
                write(USER_KEY_ARCHIVE, read(USER_KEY_ARCHIVE).filter(x => x.id !== b.dataset.id));
                renderAll();
            }
        });
    }
}

// ------------------- CHARTS & STATS -------------------
let calChart=null, durChart=null;

function aggregateLast7(arr) {
    const today = new Date();
    const dates = [];
    for(let i=6;i>=0;i--){
        const d = new Date(); d.setDate(today.getDate()-i); dates.push(d.toISOString().slice(0,10));
    }
    const totalsCal = dates.map(dt=>arr.filter(x=>x.date===dt).reduce((s,m)=>s+(m.calories||0),0));
    const totalsDur = dates.map(dt=>arr.filter(x=>x.date===dt).reduce((s,m)=>s+(m.duration||0),0));
    return { dates, totalsCal, totalsDur };
}

function renderCharts() {
    const active = read(USER_KEY_ACTIVE);
    const agg = aggregateLast7(active);
    const labels = agg.dates.map(d=> new Date(d).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}));

    // Calories
    const calCtx = dom.charts.calories.getContext('2d');
    if(!calChart){
        calChart = new Chart(calCtx, {
            type:'line',
            data:{ labels, datasets:[{ label:'Calories', data:agg.totalsCal, borderColor:'#0d6efd', backgroundColor:'rgba(13,110,253,0.12)', fill:true, tension:0.3 }]},
            options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}, animation:{duration:600} }
        });
    } else { calChart.data.labels=labels; calChart.data.datasets[0].data=agg.totalsCal; calChart.update(); }

    // Duration
    const durCtx = dom.charts.duration.getContext('2d');
    if(!durChart){
        durChart = new Chart(durCtx, {
            type:'bar',
            data:{ labels, datasets:[{ label:'Duration', data:agg.totalsDur, backgroundColor:'rgba(0,180,255,0.18)', borderColor:'#00b4ff', borderWidth:1 }]},
            options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}, animation:{duration:600} }
        });
    } else { durChart.data.labels=labels; durChart.data.datasets[0].data=agg.totalsDur; durChart.update(); }

    return agg;
}

function updateStats(agg){
    const active = read(USER_KEY_ACTIVE);
    const archive = read(USER_KEY_ARCHIVE);
    const combined = active.concat(archive).map(w => ({...w, duration:safeNum(w.duration), calories:safeNum(w.calories)}));

    const totalCal = combined.reduce((s,w)=>s+w.calories,0);
    dom.avgCal.textContent = `${Math.round(totalCal/7)||0} cal/day`;

    const totalWorkouts = combined.length;
    const avgDur = totalWorkouts ? Math.round(combined.reduce((s,w)=>s+w.duration,0)/totalWorkouts*10)/10 : 0;
    dom.avgDur.textContent = `${avgDur} min`;

    const freq = {};
    combined.forEach(w => freq[w.activity]=(freq[w.activity]||0)+1);
    dom.freqAct.textContent = Object.keys(freq).length ? Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0] : '-';

    const longest = combined.sort((a,b)=>b.duration-a.duration)[0];
    dom.longest.textContent = longest ? `${longest.activity} — ${longest.duration} min` : '-';

    const calPct = Math.min(100, Math.round(agg.totalsCal.reduce((s,v)=>s+v,0)/CAL_GOAL*100));
    const workPct = Math.min(100, Math.round(active.length/WORK_GOAL*100));
    dom.calBar.style.width = calPct+'%'; dom.calBar.textContent = calPct+'%';
    dom.workBar.style.width = workPct+'%'; dom.workBar.textContent = workPct+'%';
}

// ------------------- RENDER EVERYTHING -------------------
function renderAll(){
    const agg = renderCharts();
    renderTable();
    renderArchive();
    updateStats(agg);
}

// ------------------- ADD WORKOUT -------------------
if (!isAdminView) {
    dom.addForm.addEventListener('submit', e=>{
        e.preventDefault();
        const item = {
            id: uid(),
            activity: dom.activity.value.trim(),
            duration: safeNum(dom.duration.value),
            calories: safeNum(dom.calories.value),
            date: dom.date.value || new Date().toISOString().slice(0,10)
        };
        if (!item.activity || item.duration<=0 || item.calories<=0) return alert('Enter valid values');
        addWorkout(item);
        dom.activity.value=''; dom.duration.value=30; dom.calories.value=300; dom.date.value=new Date().toISOString().slice(0,10);
    });
}

// ------------------- EXPORT / IMPORT -------------------
function exportCSV() {
    const arr = read(USER_KEY_ACTIVE);
    const csv = ["Date,Activity,Duration,Calories", ...arr.map(w=>`${w.date},${w.activity},${w.duration},${w.calories}`)].join("\n");
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='workouts.csv'; a.click(); URL.revokeObjectURL(url);
}
function exportJSON() {
    const arr = read(USER_KEY_ACTIVE);
    const blob = new Blob([JSON.stringify(arr,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='workouts.json'; a.click(); URL.revokeObjectURL(url);
}
dom.exportCSV.addEventListener('click', exportCSV);
dom.exportJSON.addEventListener('click', exportJSON);

if (!isAdminView) {
    dom.importFile.addEventListener('change', e=>{
        const file=e.target.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = ()=> {
            try{ const arr = JSON.parse(reader.result); if(Array.isArray(arr)) write(USER_KEY_ACTIVE,arr); renderAll(); }
            catch(err){ alert('Invalid JSON file'); }
        };
        reader.readAsText(file);
    });
}

// ------------------- ARCHIVE BUTTONS -------------------
if (!isAdminView) {
    dom.clearArchive.addEventListener('click', ()=>{ if(confirm('Clear all archived workouts?')){ write(USER_KEY_ARCHIVE,[]); renderAll(); } });
    dom.restoreAll.addEventListener('click', ()=>{
        const arch = read(USER_KEY_ARCHIVE); const act = read(USER_KEY_ACTIVE);
        write(USER_KEY_ACTIVE, act.concat(arch)); write(USER_KEY_ARCHIVE,[]); renderAll();
    });
}

// ------------------- LOGOUT -------------------
dom.logoutBtn.forEach(btn=>btn.addEventListener('click', ()=>{
    localStorage.removeItem(KEY_ACTIVE_USER);
    localStorage.removeItem(ADMIN_VIEW_KEY);
    window.location.href = 'login.html';
}));

// ------------------- INITIAL RENDER -------------------
renderAll();
setInterval(renderAll, 2000);
