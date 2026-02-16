

/*
// ==================== INITIALIZATION ====================
AOS.init({ once: true, duration: 600 });

// ==================== ADMIN SESSION ====================
const ADMIN_VIEW_KEY = 'ft_admin_view_user';
const viewedUser = localStorage.getItem(ADMIN_VIEW_KEY);

if (!viewedUser) {
    alert('No user selected.');
    window.location.href = 'admin.html';
    throw new Error('Admin view missing');
}

// ==================== STORAGE KEYS (SHARED WITH user.js) ====================
const USER_KEY_ACTIVE  = `ft_active_${viewedUser}`;
const USER_KEY_ARCHIVE = `ft_archive_${viewedUser}`;
const USER_KEY_AVATAR  = `avatar_${viewedUser}`;

// ==================== DOM ====================
const dom = {
    avatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    tableBody: document.getElementById('tableBodyUser'),

    avgCal: document.getElementById('avgCalUser'),
    avgDur: document.getElementById('avgDurUser'),
    freqAct: document.getElementById('freqActUser'),
    longest: document.getElementById('longestUser'),
    mostCal: document.getElementById('mostCalUser'),

    calBar: document.getElementById('calBarUser'),
    workBar: document.getElementById('workBarUser'),

    archiveList: document.getElementById('archiveListUser'),

    charts: {
        calories: document.getElementById('caloriesChartUser'),
        duration: document.getElementById('durationChartUser')
    },

    logoutBtns: document.querySelectorAll('.logoutBtn'),
    nav: document.querySelector('.navbar-nav')
};

// ==================== USER INFO ====================
dom.userName.textContent = viewedUser;
const avatar = localStorage.getItem(USER_KEY_AVATAR);
if (avatar) dom.avatar.src = avatar;

// ==================== INSERT ADMIN BUTTON ====================
if (dom.nav && !document.getElementById('adminNavBtn')) {
    const adminLi = document.createElement('li');
    adminLi.className = 'nav-item';
    adminLi.id = 'adminNavBtn';

    adminLi.innerHTML = `<a class="nav-link fw-semibold text-warning" href="admin.html">Admin</a>`;

    const logoutItem = [...dom.nav.children].find(li =>
        li.textContent.toLowerCase().includes('logout')
    );

    if (logoutItem) dom.nav.insertBefore(adminLi, logoutItem);
    else dom.nav.appendChild(adminLi);
}

// ==================== HELPERS ====================
const safeNum = v => Math.max(0, Number(v) || 0);

const read = key => {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
};

const isoToDisplay = d => {
    const dt = new Date(d);
    return isNaN(dt) ? '-' : `${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}/${dt.getFullYear()}`;
};

// ==================== TABLE (READ-ONLY STRICT) ====================
function renderTable() {
    const active = read(USER_KEY_ACTIVE);
    const archive = read(USER_KEY_ARCHIVE);
    const all = [...active, ...archive].sort((a,b)=>b.date.localeCompare(a.date));

    dom.tableBody.innerHTML = all.length ? all.map(w=>`
        <tr>
            <td>${isoToDisplay(w.date)}</td>
            <td>${w.activity || '-'}</td>
            <td>${safeNum(w.duration)}</td>
            <td>${safeNum(w.calories)}</td>
            <td>
                <span class="badge ${active.some(a=>a.id===w.id)?'bg-success':'bg-secondary'}">
                    ${active.some(a=>a.id===w.id)?'Active':'Archived'}
                </span>
            </td>
        </tr>
    `).join('') :
    `<tr><td colspan="5" class="text-center text-muted">No workouts</td></tr>`;
}

// ==================== ARCHIVE ====================
function renderArchive() {
    const archive = read(USER_KEY_ARCHIVE);
    dom.archiveList.innerHTML = archive.length
        ? archive.map(w=>`
            <li class="list-group-item small">
                ${isoToDisplay(w.date)} — ${w.activity}
                (${safeNum(w.duration)} min, ${safeNum(w.calories)} cal)
            </li>
        `).join('')
        : `<li class="list-group-item small text-muted">No archived workouts</li>`;
}

// ==================== CHARTS ====================
let calChart, durChart;

function renderCharts() {
    const days = [...Array(7)].map((_,i)=>{
        const d=new Date(); d.setDate(d.getDate()-(6-i));
        return d.toISOString().slice(0,10);
    });

    const active = read(USER_KEY_ACTIVE);

    const cal = days.map(d=>active.filter(w=>w.date===d).reduce((s,w)=>s+safeNum(w.calories),0));
    const dur = days.map(d=>active.filter(w=>w.date===d).reduce((s,w)=>s+safeNum(w.duration),0));
    const labels = days.map(d=>new Date(d).toLocaleDateString(undefined,{weekday:'short'}));

    if(!calChart){
        calChart = new Chart(dom.charts.calories,{
            type:'line',
            data:{labels,datasets:[{data:cal,label:'Calories',fill:true,tension:.3}]},
            options:{scales:{y:{beginAtZero:true}}}
        });
    } else {
        calChart.data.labels = labels;
        calChart.data.datasets[0].data = cal;
        calChart.update();
    }

    if(!durChart){
        durChart = new Chart(dom.charts.duration,{
            type:'bar',
            data:{labels,datasets:[{data:dur,label:'Minutes'}]},
            options:{scales:{y:{beginAtZero:true}}}
        });
    } else {
        durChart.data.labels = labels;
        durChart.data.datasets[0].data = dur;
        durChart.update();
    }

    return { cal, dur, active };
}

// ==================== STATS ====================
function updateStats(ctx){
    const a = ctx.active;

    dom.avgCal.textContent = a.length
        ? `${Math.round(a.reduce((s,w)=>s+safeNum(w.calories),0)/a.length)} cal`
        : '-';

    dom.avgDur.textContent = a.length
        ? `${Math.round(a.reduce((s,w)=>s+safeNum(w.duration),0)/a.length)} min`
        : '-';

    const freq = {};
    a.forEach(w=>freq[w.activity]=(freq[w.activity]||0)+1);
    dom.freqAct.textContent = Object.keys(freq).length
        ? Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0]
        : '-';

    const longest = a.reduce((x,y)=>y.duration>(x?.duration||0)?y:x,null);
    dom.longest.textContent = longest ? `${longest.activity} - ${longest.duration} min` : '-';

    const most = a.reduce((x,y)=>y.calories>(x?.calories||0)?y:x,null);
    dom.mostCal.textContent = most ? `${most.activity} - ${most.calories} cal` : '-';
}

// ==================== LOGOUT (ADMIN ONLY) ====================
dom.logoutBtns.forEach(btn=>{
    btn.onclick = ()=>{
        localStorage.removeItem(ADMIN_VIEW_KEY); // ONLY admin session
        window.location.href = 'admin.html';
    };
});

// ==================== RENDER ====================
function renderAll(){
    if(!localStorage.getItem(USER_KEY_ACTIVE) && !localStorage.getItem(USER_KEY_ARCHIVE)){
        alert('User account deleted.');
        window.location.href = 'admin.html';
        return;
    }

    renderTable();             // table fully read-only
    renderArchive();
    const ctx = renderCharts();
    updateStats(ctx);
}

renderAll();
setInterval(renderAll, 2000);
*/