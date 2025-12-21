// =================== SESSION CHECK =================== 
const KEY_ACTIVE_USER = 'ft_active_user';
const KEY_USERS = 'ft_users';
const KEY_ARCHIVED_USERS = 'ft_archived_users';
const activeUser = JSON.parse(localStorage.getItem(KEY_ACTIVE_USER));

if(!activeUser || activeUser.role !== 'admin') {
    alert('You must login as admin first.');
    window.location.href = 'admin-login.html';
}

// =================== LOGOUT ===================
document.querySelectorAll('.logoutBtn').forEach(btn => {
    btn.onclick = () => {
        localStorage.removeItem(KEY_ACTIVE_USER);
        localStorage.removeItem('ft_admin_view_user'); // Clear admin-view flag
        window.location.href = 'admin-login.html';
    };
});

// =================== HELPERS ===================
const safeNum = v => Number.isFinite(Number(v)) ? Math.max(0, Math.round(v)) : 0;
const isoToDisplay = iso => {
    const d = new Date(iso);
    return isNaN(d) ? '' : `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
};
const getUsers = () => JSON.parse(localStorage.getItem(KEY_USERS) || []);
const getArchivedUsers = () => JSON.parse(localStorage.getItem(KEY_ARCHIVED_USERS) || []);

// =================== DOM ELEMENTS ===================
const tbody = document.getElementById('usersTableBody');
const archivedTbody = document.getElementById('archivedUsersTableBody');
const modal = new bootstrap.Modal(document.getElementById('userModal'));
const modalAvatar = document.getElementById('modalAvatar');
const modalUsername = document.querySelectorAll('#modalUsername');
const modalEmail = document.getElementById('modalEmail');
const modalTableBody = document.getElementById('modalTableBody');


// =================== RENDER USERS ===================
function renderUsers() {
    const users = getUsers().filter(u => u.role !== 'admin');
    tbody.innerHTML = users.map(u => {
        const active = JSON.parse(localStorage.getItem(`ft_active_${u.username}`) || '[]');
        const archive = JSON.parse(localStorage.getItem(`ft_archive_${u.username}`) || '[]');
        const allWorkouts = active.concat(archive);

        const avgCal = allWorkouts.length ? Math.round(allWorkouts.reduce((s,w)=>s+w.calories,0)/allWorkouts.length) : 0;
        const avgDur = allWorkouts.length ? Math.round(allWorkouts.reduce((s,w)=>s+w.duration,0)/allWorkouts.length) : 0;
        const freqMap = {};
        allWorkouts.forEach(w => freqMap[w.activity] = (freqMap[w.activity]||0)+1);
        const freqAct = Object.keys(freqMap).length ? Object.entries(freqMap).sort((a,b)=>b[1]-a[1])[0][0] : '-';

        const avatarSrc = localStorage.getItem(`avatar_${u.username}`) || 'https://via.placeholder.com/50';

        return `<tr class="align-middle">
            <td><img src="${avatarSrc}" width="40" class="rounded-circle"></td>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td>${active.length}</td>
            <td>${archive.length}</td>
            <td>${avgCal}</td>
            <td>${avgDur}</td>
            <td>${freqAct}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary btn-view" data-user="${u.username}" title="View Details"><i class="fa-solid fa-eye"></i></button>
                <button class="btn btn-sm btn-outline-warning btn-archive" data-user="${u.username}" title="Archive User"><i class="fa-solid fa-box-archive"></i></button>
                <button class="btn btn-sm btn-outline-danger btn-delete" data-user="${u.username}" title="Delete User"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="9" class="text-center text-muted">No active users</td></tr>`;

    // Attach button events
    document.querySelectorAll('.btn-view').forEach(btn => btn.onclick = () => openUserPageReadOnly(btn.dataset.user));
    document.querySelectorAll('.btn-delete').forEach(btn => btn.onclick = () => deleteUser(btn.dataset.user));
    document.querySelectorAll('.btn-archive').forEach(btn => btn.onclick = () => archiveUser(btn.dataset.user));

    updateDashboardStats(users);
}





// =================== RENDER ARCHIVED USERS ===================
function renderArchivedUsers() {
    const archived = getArchivedUsers(); // function should return archived users array
    archivedTbody.innerHTML = archived.map(u => {
        const archive = JSON.parse(localStorage.getItem(`ft_archive_${u.username}`) || '[]');

        // Number of archived workouts
        const archivedCount = archive.length;

        // Average Calories & Average Duration from archived workouts
        const avgCal = archivedCount ? Math.round(archive.reduce((sum, w) => sum + w.calories, 0) / archivedCount) : 0;
        const avgDur = archivedCount ? Math.round(archive.reduce((sum, w) => sum + w.duration, 0) / archivedCount) : 0;

        // Most frequent activity from archived workouts
        const freqMap = {};
        archive.forEach(w => freqMap[w.activity] = (freqMap[w.activity] || 0) + 1);
        const freqAct = Object.keys(freqMap).length
            ? Object.entries(freqMap).sort((a, b) => b[1] - a[1])[0][0]
            : '-';

        const avatarSrc = localStorage.getItem(`avatar_${u.username}`) || 'https://via.placeholder.com/50';

        return `<tr class="align-middle table-secondary">
            <td><img src="${avatarSrc}" width="40" class="rounded-circle"></td>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td>—</td> <!-- Active Workouts column is not relevant for archived users -->
            <td>${archivedCount}</td>
            <td>${avgCal}</td>
            <td>${avgDur}</td>
            <td>${freqAct}</td> <!-- Frequent Activity only shows activity like Running/Swimming -->
            <td>
                <button class="btn btn-sm btn-outline-success btn-rearchive" data-user="${u.username}" title="Re-activate User">
                    <i class="fa-solid fa-rotate-left"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger btn-del-archived" data-user="${u.username}" title="Delete User">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="9" class="text-center text-muted">No archived users</td></tr>`;

    // Attach Actions button events
    document.querySelectorAll('.btn-rearchive').forEach(btn => btn.onclick = () => rearchiveUser(btn.dataset.user));
    document.querySelectorAll('.btn-del-archived').forEach(btn => btn.onclick = () => deleteArchivedUser(btn.dataset.user));
}





// =================== DASHBOARD STATS ===================
function updateDashboardStats(users){
    document.getElementById('totalUsers').textContent = users.length;
    const totalWorkouts = users.reduce((sum,u) => {
        const active = JSON.parse(localStorage.getItem(`ft_active_${u.username}`) || '[]');
        const archive = JSON.parse(localStorage.getItem(`ft_archive_${u.username}`) || '[]');
        return sum + active.length + archive.length;
    },0);
    document.getElementById('totalWorkouts').textContent = totalWorkouts;

    const avgCalories = users.reduce((sum,u) => {
        const active = JSON.parse(localStorage.getItem(`ft_active_${u.username}`) || '[]');
        const archive = JSON.parse(localStorage.getItem(`ft_archive_${u.username}`) || '[]');
        const all = active.concat(archive);
        return sum + (all.reduce((s,w)=>s+w.calories,0)/(all.length||1));
    },0);
    document.getElementById('avgCalories').textContent = Math.round(avgCalories);
}

// =================== OPEN USER PAGE (READ-ONLY) ===================
function openUserPageReadOnly(username) {
    localStorage.setItem('ft_admin_view_user', username);
    window.location.href = 'user.html';
}

// =================== ARCHIVE / RE-ACTIVATE / DELETE ===================
function archiveUser(username){
    if(!confirm('Archive (deactivate) this user?')) return;

    const users = getUsers();
    const user = users.find(u=>u.username===username);
    if(!user) return;

    localStorage.setItem(KEY_USERS, JSON.stringify(users.filter(u=>u.username!==username)));
    const archived = getArchivedUsers();
    localStorage.setItem(KEY_ARCHIVED_USERS, JSON.stringify([...archived, user]));

    renderUsers();
    renderArchivedUsers();
}

function rearchiveUser(username){
    if(!confirm('Re-activate this user?')) return;

    const archived = getArchivedUsers();
    const user = archived.find(u=>u.username===username);
    if(!user) return;

    localStorage.setItem(KEY_ARCHIVED_USERS, JSON.stringify(archived.filter(u=>u.username!==username)));
    const users = getUsers();
    localStorage.setItem(KEY_USERS, JSON.stringify([...users, user]));

    renderUsers();
    renderArchivedUsers();
}

function deleteUser(username){
    if(!confirm('Delete this user permanently?')) return;

    localStorage.removeItem(`ft_active_${username}`);
    localStorage.removeItem(`ft_archive_${username}`);
    localStorage.removeItem(`avatar_${username}`);

    const users = getUsers().filter(u=>u.username!==username);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));

    renderUsers();
}

function deleteArchivedUser(username){
    if(!confirm('Delete this archived user permanently?')) return;

    localStorage.removeItem(`ft_active_${username}`);
    localStorage.removeItem(`ft_archive_${username}`);
    localStorage.removeItem(`avatar_${username}`);

    const archived = getArchivedUsers().filter(u=>u.username!==username);
    localStorage.setItem(KEY_ARCHIVED_USERS, JSON.stringify(archived));

    renderArchivedUsers();
}

// =================== MODAL ===================
function openModal(username){
    const user = getUsers().concat(getArchivedUsers()).find(u=>u.username===username);
    if(!user) return;

    modalAvatar.src = localStorage.getItem(`avatar_${username}`) || 'https://via.placeholder.com/100';
    modalUsername.forEach(el=>el.textContent=user.username);
    modalEmail.textContent = user.email;

    const active = JSON.parse(localStorage.getItem(`ft_active_${username}`) || '[]');
    const archive = JSON.parse(localStorage.getItem(`ft_archive_${username}`) || '[]');
    const allWorkouts = active.concat(archive).sort((a,b)=>b.date.localeCompare(a.date));

    modalTableBody.innerHTML = allWorkouts.map(w=>{
        const isActive = active.some(a=>a.id===w.id);
        return `<tr>
            <td>${isoToDisplay(w.date)}</td>
            <td>${w.activity}</td>
            <td>${safeNum(w.duration)}</td>
            <td>${safeNum(w.calories)}</td>
            <td><span class="badge ${isActive?'bg-success':'bg-secondary'}">${isActive?'Active':'Archived'}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-danger btn-del-workout" data-id="${w.id}" data-user="${username}"><i class="fa-solid fa-trash"></i></button>
                ${!isActive?`<button class="btn btn-sm btn-outline-success btn-restore-workout" data-id="${w.id}" data-user="${username}"><i class="fa-solid fa-rotate-left"></i></button>`:''}
            </td>
        </tr>`;
    }).join('') || `<tr><td colspan="6" class="text-center text-muted">No workouts logged</td></tr>`;

    attachModalActions();
    modal.show();
}

function attachModalActions(){
    document.querySelectorAll('.btn-del-workout').forEach(btn=>{
        btn.onclick = ()=>{
            const user = btn.dataset.user;
            const id = btn.dataset.id;
            const active = JSON.parse(localStorage.getItem(`ft_active_${user}`)||'[]');
            const archive = JSON.parse(localStorage.getItem(`ft_archive_${user}`)||'[]');
            localStorage.setItem(`ft_active_${user}`, JSON.stringify(active.filter(w=>w.id!==id)));
            localStorage.setItem(`ft_archive_${user}`, JSON.stringify(archive.filter(w=>w.id!==id)));
            openModal(user);
            renderUsers();
            renderArchivedUsers();
        };
    });
    document.querySelectorAll('.btn-restore-workout').forEach(btn=>{
        btn.onclick = ()=>{
            const user = btn.dataset.user;
            const id = btn.dataset.id;
            const archive = JSON.parse(localStorage.getItem(`ft_archive_${user}`)||'[]');
            const active = JSON.parse(localStorage.getItem(`ft_active_${user}`)||'[]');
            const item = archive.find(w=>w.id===id);
            if(item){
                localStorage.setItem(`ft_archive_${user}`, JSON.stringify(archive.filter(w=>w.id!==id)));
                localStorage.setItem(`ft_active_${user}`, JSON.stringify(active.concat(item)));
            }
            openModal(user);
            renderUsers();
            renderArchivedUsers();
        };
    });
}

// =================== INITIAL RENDER ===================
renderUsers();
renderArchivedUsers();
setInterval(()=>{renderUsers(); renderArchivedUsers();},2000);

// =================== 3D Tilt & AOS ===================
VanillaTilt.init(document.querySelectorAll(".feature-card"), { max: 15, speed: 400, glare: true, "max-glare": 0.25 });
AOS.init({ once: true, duration: 800 });
