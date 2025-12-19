// ------------------- SESSION CHECK -------------------
const KEY_ACTIVE_USER = 'ft_active_user';
const KEY_USERS = 'ft_users';
const activeUser = JSON.parse(localStorage.getItem(KEY_ACTIVE_USER));

if(!activeUser || activeUser.role!=='admin') {
    alert('You must login as admin first.');
    window.location.href = 'admin-login.html';
}

// ------------------- LOGOUT -------------------
document.querySelectorAll('.logoutBtn').forEach(btn=>{
    btn.onclick = ()=>{
        localStorage.removeItem(KEY_ACTIVE_USER);
        window.location.href = 'admin-login.html';
    };
});

// ------------------- HELPERS -------------------
const safeNum = v=>Number.isFinite(Number(v))?Math.max(0,Math.round(v)):0;
const isoToDisplay = iso=>{
  const d=new Date(iso);
  return isNaN(d)?'':`${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
};
const getUsers = ()=>JSON.parse(localStorage.getItem(KEY_USERS)||'[]');

// ------------------- RENDER USERS -------------------
const tbody = document.getElementById('usersTableBody');
const modal = new bootstrap.Modal(document.getElementById('userModal'));
const modalAvatar = document.getElementById('modalAvatar');
const modalUsername = document.querySelectorAll('#modalUsername');
const modalEmail = document.getElementById('modalEmail');
const modalTableBody = document.getElementById('modalTableBody');

function renderUsers() {
    const users = getUsers().filter(u=>u.role!=='admin'); // exclude admin
    tbody.innerHTML = users.map(u=>{
        const active = JSON.parse(localStorage.getItem(`ft_active_${u.username}`)||'[]');
        const archive = JSON.parse(localStorage.getItem(`ft_archive_${u.username}`)||'[]');
        const allWorkouts = active.concat(archive);
        const avgCal = allWorkouts.length ? Math.round(allWorkouts.reduce((s,w)=>s+w.calories,0)/allWorkouts.length) : 0;
        const avgDur = allWorkouts.length ? Math.round(allWorkouts.reduce((s,w)=>s+w.duration,0)/allWorkouts.length) : 0;
        const freqMap = {};
        allWorkouts.forEach(w=>freqMap[w.activity]=(freqMap[w.activity]||0)+1);
        const freqAct = Object.keys(freqMap).length ? Object.entries(freqMap).sort((a,b)=>b[1]-a[1])[0][0] : '-';
        const avatarSrc = localStorage.getItem(`avatar_${u.username}`)||'https://via.placeholder.com/50';
        return `<tr>
            <td><img src="${avatarSrc}" width="40"></td>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td>${active.length}</td>
            <td>${archive.length}</td>
            <td>${avgCal}</td>
            <td>${avgDur}</td>
            <td>${freqAct}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary btn-view" data-user="${u.username}"><i class="fa-solid fa-eye"></i></button>
                <button class="btn btn-sm btn-outline-danger btn-delete" data-user="${u.username}"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');

    document.querySelectorAll('.btn-view').forEach(btn=>{
        btn.onclick=()=>openModal(btn.dataset.user);
    });
    document.querySelectorAll('.btn-delete').forEach(btn=>{
        btn.onclick=()=>deleteUser(btn.dataset.user);
    });

    // Update stats cards
    document.getElementById('totalUsers').textContent = users.length;
    const totalWorkouts = users.reduce((sum,u)=>{
        const active = JSON.parse(localStorage.getItem(`ft_active_${u.username}`)||'[]');
        const archive = JSON.parse(localStorage.getItem(`ft_archive_${u.username}`)||'[]');
        return sum+active.length+archive.length;
    },0);
    document.getElementById('totalWorkouts').textContent = totalWorkouts;
    const avgCalories = users.reduce((sum,u)=>{
        const active = JSON.parse(localStorage.getItem(`ft_active_${u.username}`)||'[]');
        const archive = JSON.parse(localStorage.getItem(`ft_archive_${u.username}`)||'[]');
        const all = active.concat(archive);
        return sum + (all.reduce((s,w)=>s+w.calories,0) / (all.length||1));
    },0);
    document.getElementById('avgCalories').textContent = Math.round(avgCalories);
}

// ------------------- MODAL -------------------
function openModal(username){
    const user = getUsers().find(u=>u.username===username);
    if(!user) return;
    modalAvatar.src = localStorage.getItem(`avatar_${username}`)||'https://via.placeholder.com/100';
    modalUsername.forEach(el=>el.textContent=user.username);
    modalEmail.textContent=user.email;

    const active = JSON.parse(localStorage.getItem(`ft_active_${username}`)||'[]');
    const archive = JSON.parse(localStorage.getItem(`ft_archive_${username}`)||'[]');
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
        btn.onclick=()=>{
            const user=btn.dataset.user;
            const id=btn.dataset.id;
            const active = JSON.parse(localStorage.getItem(`ft_active_${user}`)||'[]');
            const archive = JSON.parse(localStorage.getItem(`ft_archive_${user}`)||'[]');
            localStorage.setItem(`ft_active_${user}`, JSON.stringify(active.filter(w=>w.id!==id)));
            localStorage.setItem(`ft_archive_${user}`, JSON.stringify(archive.filter(w=>w.id!==id)));
            openModal(user);
            renderUsers();
        };
    });
    document.querySelectorAll('.btn-restore-workout').forEach(btn=>{
        btn.onclick=()=>{
            const user=btn.dataset.user;
            const id=btn.dataset.id;
            const archive = JSON.parse(localStorage.getItem(`ft_archive_${user}`)||'[]');
            const active = JSON.parse(localStorage.getItem(`ft_active_${user}`)||'[]');
            const item = archive.find(w=>w.id===id);
            if(item){
                localStorage.setItem(`ft_archive_${user}`, JSON.stringify(archive.filter(w=>w.id!==id)));
                localStorage.setItem(`ft_active_${user}`, JSON.stringify(active.concat(item)));
            }
            openModal(user);
            renderUsers();
        };
    });
}

// ------------------- DELETE USER -------------------
function deleteUser(username){
    if(!confirm('Delete this user and all data?')) return;
    localStorage.removeItem(`ft_active_${username}`);
    localStorage.removeItem(`ft_archive_${username}`);
    localStorage.removeItem(`avatar_${username}`);
    const users = getUsers().filter(u=>u.username!==username);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
    renderUsers();
}

// ------------------- INITIAL RENDER -------------------
renderUsers();
setInterval(renderUsers,2000);

// ------------------- 3D Tilt -------------------
VanillaTilt.init(document.querySelectorAll(".feature-card"), {
    max: 15,
    speed: 400,
    glare: true,
    "max-glare": 0.25
});

// ------------------- AOS Animations -------------------
AOS.init({ once: true, duration: 800 });
