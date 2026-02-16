// Initialize AOS
AOS.init({ once: true, duration: 600 });

// LocalStorage keys
const KEY_ACTIVE = 'ft_user_active';
const KEY_ARCHIVE = 'ft_user_archive';
const CAL_GOAL = 4000;
const WORK_GOAL = 10;

// DOM elements
const dom = {
  avatar: document.getElementById('userAvatar'),
  avatarInput: document.getElementById('avatarInput'),
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
  logoutBtn: document.getElementById('logoutBtn')
};

// Default date today
dom.date.value = new Date().toISOString().slice(0, 10);

let calChart = null, durChart = null;

// ---------- Helpers ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const safeNum = v => { v = Number(v); return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0; };
const isoToDisplay = iso => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
};
function read(key) { return JSON.parse(localStorage.getItem(key) || '[]'); }
function write(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// ---------- Avatar ----------
if (dom.avatarInput) {
  dom.avatarInput.addEventListener('change', e => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      dom.avatar.src = reader.result;
      localStorage.setItem('user_avatar', reader.result);
    };
    reader.readAsDataURL(file);
  });
  const savedAvatar = localStorage.getItem('user_avatar');
  if (savedAvatar) dom.avatar.src = savedAvatar;
}

// ---------- CRUD ----------
function renderTable(filter='') {
  const arr = read(KEY_ACTIVE).slice().sort((a,b)=> b.date.localeCompare(a.date));
  const rows = arr.filter(w => {
    if (!filter) return true;
    const s = filter.toLowerCase();
    return w.activity.toLowerCase().includes(s) || isoToDisplay(w.date).includes(s);
  });

  dom.tableBody.innerHTML = rows.map(w => `
    <tr>
      <td>${isoToDisplay(w.date)}</td>
      <td>${w.activity}</td>
      <td>${safeNum(w.duration)} min</td>
      <td>${safeNum(w.calories)}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-danger btn-delete" data-id="${w.id}"><i class="fa-solid fa-trash"></i></button>
          <button class="btn btn-outline-secondary btn-archive" data-id="${w.id}"><i class="fa-solid fa-box-archive"></i></button>
        </div>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="text-center text-muted">No workouts logged</td></tr>`;

  document.querySelectorAll('.btn-delete').forEach(b => b.onclick = () => deleteWorkout(b.dataset.id));
  document.querySelectorAll('.btn-archive').forEach(b => b.onclick = () => archiveWorkout(b.dataset.id));
}

function renderArchive() {
  const arch = read(KEY_ARCHIVE).slice().sort((a,b)=> b.date.localeCompare(a.date));
  dom.archiveList.innerHTML = arch.map(w => `
    <li class="list-group-item d-flex justify-content-between align-items-start">
      <div>
        <strong>${w.activity}</strong>
        <div class="small-muted">${isoToDisplay(w.date)} • ${safeNum(w.duration)} min • ${safeNum(w.calories)} cal</div>
      </div>
      <div class="btn-group">
        <button class="btn btn-sm btn-outline-success btn-restore" data-id="${w.id}"><i class="fa-solid fa-rotate-left"></i></button>
        <button class="btn btn-sm btn-outline-danger btn-del-arch" data-id="${w.id}"><i class="fa-solid fa-trash"></i></button>
      </div>
    </li>
  `).join('') || `<li class="list-group-item text-muted">No archived workouts</li>`;

  document.querySelectorAll('.btn-restore').forEach(b => b.onclick = () => restoreArchived(b.dataset.id));
  document.querySelectorAll('.btn-del-arch').forEach(b => b.onclick = () => {
    if (!confirm('Delete archived item permanently?')) return;
    write(KEY_ARCHIVE, read(KEY_ARCHIVE).filter(x=> x.id!==b.dataset.id));
    renderArchive(); renderAll();
  });
}

// ---------- CRUD Helpers ----------
function addWorkout(obj){ const arr=read(KEY_ACTIVE); arr.push(obj); write(KEY_ACTIVE, arr); renderAll(); }
function deleteWorkout(id){ if (!confirm('Delete this workout?')) return; write(KEY_ACTIVE, read(KEY_ACTIVE).filter(x=>x.id!==id)); renderAll(); }
function archiveWorkout(id){
  const arr = read(KEY_ACTIVE); const item = arr.find(x=>x.id===id); if(!item)return;
  write(KEY_ACTIVE, arr.filter(x=>x.id!==id));
  const arch = read(KEY_ARCHIVE); arch.push(item); write(KEY_ARCHIVE, arch);
  renderAll();
}
function restoreArchived(id){
  const arch = read(KEY_ARCHIVE); const item = arch.find(x=>x.id===id); if(!item)return;
  write(KEY_ARCHIVE, arch.filter(x=>x.id!==id));
  const act = read(KEY_ACTIVE); act.push(item); write(KEY_ACTIVE, act);
  renderAll();
}

// ---------- Charts ----------
function aggregateLast7(arr){
  const today = new Date(); const dates = [];
  for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(today.getDate()-i); dates.push(d.toISOString().slice(0,10)); }
  const totalsCal = dates.map(dt=> arr.filter(x=>x.date===dt).reduce((s,m)=> s+(m.calories||0),0));
  const totalsDur = dates.map(dt=> arr.filter(x=>x.date===dt).reduce((s,m)=> s+(m.duration||0),0));
  return { dates, totalsCal, totalsDur };
}

function renderCharts(){
  const active = read(KEY_ACTIVE); const agg = aggregateLast7(active);
  const labels = agg.dates.map(d=> new Date(d).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}));

  // Calories chart
  const calCtx = document.getElementById('caloriesChartUser').getContext('2d');
  if(!calChart){
    calChart = new Chart(calCtx,{ type:'line', data:{ labels, datasets:[{ label:'Calories', data:agg.totalsCal, borderColor:'rgba(13,110,253,1)', backgroundColor:'rgba(13,110,253,0.12)', fill:true, tension:0.3 }]}, options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}, animation:{duration:600} } });
  } else { calChart.data.labels = labels; calChart.data.datasets[0].data = agg.totalsCal; calChart.update(); }

  // Duration chart
  const durCtx = document.getElementById('durationChartUser').getContext('2d');
  if(!durChart){
    durChart = new Chart(durCtx,{ type:'bar', data:{ labels, datasets:[{ label:'Duration', data:agg.totalsDur, backgroundColor:'rgba(0,180,255,0.18)', borderColor:'#00b4ff', borderWidth:1 }]}, options:{ responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}, animation:{duration:600} } });
  } else { durChart.data.labels = labels; durChart.data.datasets[0].data = agg.totalsDur; durChart.update(); }

  return agg;
}

// ---------- Stats ----------
function updateStats(agg){
  const active = read(KEY_ACTIVE); const archived = read(KEY_ARCHIVE);
  const combined = active.concat(archived).map(w=>({...w, duration:safeNum(w.duration), calories:safeNum(w.calories)}));

  const totalCal = combined.reduce((s,w)=>s+w.calories,0); dom.avgCal.textContent = `${Math.round(totalCal/7)||0} cal/day`;
  const totalWorkouts = combined.length; const avgDur = totalWorkouts ? Math.round(combined.reduce((s,w)=>s+w.duration,0)/totalWorkouts*10)/10 : 0; dom.avgDur.textContent = `${avgDur} min`;

  const freq = {}; combined.forEach(w=>freq[w.activity]=(freq[w.activity]||0)+1); dom.freqAct.textContent = Object.keys(freq).length ? Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0] : '-';
  const longest = combined.sort((a,b)=>b.duration-b.duration)[0]; dom.longest.textContent = longest ? `${longest.activity} — ${longest.duration} min` : '-';

  const calPct = Math.min(100, Math.round(agg.totalsCal.reduce((s,v)=>s+v,0)/CAL_GOAL*100));
  const workPct = Math.min(100, Math.round(active.length/WORK_GOAL*100));
  dom.calBar.style.width = calPct+'%'; dom.calBar.textContent = calPct+'%';
  dom.workBar.style.width = workPct+'%'; dom.workBar.textContent = workPct+'%';
}

// ---------- Orchestrator ----------
function renderAll(){ const agg = renderCharts(); renderTable(); renderArchive(); updateStats(agg); }

// ---------- Event Listeners ----------

// Add workout
dom.addForm.addEventListener('submit', e => {
  e.preventDefault();
  const item = { id: uid(), activity: dom.activity.value.trim(), duration: safeNum(dom.duration.value), calories: safeNum(dom.calories.value), date: dom.date.value || new Date().toISOString().slice(0,10) };
  if(!item.activity || item.duration<=0 || item.calories<=0) return alert('Enter valid values');
  addWorkout(item);
  dom.activity.value=''; dom.duration.value=30; dom.calories.value=300; dom.date.value=new Date().toISOString().slice(0,10);
});

// Export CSV
dom.exportCSV.addEventListener('click', ()=>{
  const arr = read(KEY_ACTIVE);
  const csv = ["Date,Activity,Duration,Calories", ...arr.map(w=>`${w.date},${w.activity},${w.duration},${w.calories}`)].join("\n");
  const blob = new Blob([csv], { type:'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download='workouts.csv'; a.click(); URL.revokeObjectURL(url);
});

// Export JSON
dom.exportJSON.addEventListener('click', ()=>{
  const arr = read(KEY_ACTIVE);
  const blob = new Blob([JSON.stringify(arr,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download='workouts.json'; a.click(); URL.revokeObjectURL(url);
});

// Import JSON
dom.importFile.addEventListener('change', e=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try { const arr = JSON.parse(reader.result); if(Array.isArray(arr)) write(KEY_ACTIVE, arr); renderAll(); } 
    catch(err){ alert('Invalid JSON file'); }
  };
  reader.readAsText(file);
});

// Clear/Restore Archive
dom.clearArchive.addEventListener('click', ()=> { if(confirm('Clear all archived workouts?')){ write(KEY_ARCHIVE,[]); renderAll(); } });
dom.restoreAll.addEventListener('click', ()=> { const arch=read(KEY_ARCHIVE); const act=read(KEY_ACTIVE); write(KEY_ACTIVE, act.concat(arch)); write(KEY_ARCHIVE,[]); renderAll(); });

// Logout
dom.logoutBtn.addEventListener('click', ()=> {
  localStorage.removeItem(KEY_ACTIVE);
  localStorage.removeItem(KEY_ARCHIVE);
  localStorage.removeItem('user_avatar');
  location.href='../index.html';
});

// ---------- Init ----------
renderAll();
