// Initialize AOS
AOS.init({ once: true, duration: 600 });

// -----------------------
// Demo: localStorage keys
// -----------------------
const KEY_ACTIVE = 'ft_active_v3';
const KEY_ARCHIVE = 'ft_archive_v3';
const CAL_GOAL = 4000; // weekly calories target
const WORK_GOAL = 10;  // weekly workouts target

// DOM elements
const dom = {
  activity: document.getElementById('activity'),
  duration: document.getElementById('duration'),
  calories: document.getElementById('calories'),
  date: document.getElementById('date'),
  addForm: document.getElementById('addForm'),
  tableBody: document.getElementById('tableBody'),
  filter: document.getElementById('filter'),
  applyFilter: document.getElementById('applyFilter'),
  clearFilter: document.getElementById('clearFilter'),
  archiveList: document.getElementById('archiveList'),
  exportCSV: document.getElementById('exportCSV'),
  exportJSON: document.getElementById('exportJSON'),
  importFile: document.getElementById('importFile'),
  clearArchive: document.getElementById('clearArchive'),
  restoreAll: document.getElementById('restoreAll'),
  resetSample: document.getElementById('resetSample'),
  avgCal: document.getElementById('avgCal'),
  avgDur: document.getElementById('avgDur'),
  freqAct: document.getElementById('freqAct'),
  longest: document.getElementById('longest'),
  calBar: document.getElementById('calBar'),
  workBar: document.getElementById('workBar')
};

// Default date to today
dom.date.value = new Date().toISOString().slice(0, 10);

// Helper functions
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const safeNum = v => { v = Number(v); return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0; };
const isoToDisplay = iso => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
}
function write(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

function seedSample() {
  const active = [
    { id: uid(), date: addDaysISO(0), activity: 'Running', duration: 30, calories: 300 },
    { id: uid(), date: addDaysISO(-1), activity: 'Cycling', duration: 40, calories: 420 },
    { id: uid(), date: addDaysISO(-2), activity: 'Yoga', duration: 50, calories: 180 },
    { id: uid(), date: addDaysISO(-3), activity: 'Swimming', duration: 60, calories: 520 },
    { id: uid(), date: addDaysISO(-4), activity: 'Weights', duration: 45, calories: 350 },
    { id: uid(), date: addDaysISO(-5), activity: 'Running', duration: 35, calories: 380 },
    { id: uid(), date: addDaysISO(-6), activity: 'Hiking', duration: 80, calories: 700 }
  ];
  write(KEY_ACTIVE, active);
  write(KEY_ARCHIVE, []);
}

function addDaysISO(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Charts
let calChart = null, durChart = null;

function aggregateLast7(arrActive) {
  const today = new Date();
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  const totalsCal = dates.map(dt => arrActive.filter(x => x.date === dt).reduce((s, m) => s + Number(m.calories || 0), 0));
  const totalsDur = dates.map(dt => arrActive.filter(x => x.date === dt).reduce((s, m) => s + Number(m.duration || 0), 0));
  return { dates, totalsCal, totalsDur };
}

function renderCharts() {
  const active = read(KEY_ACTIVE);
  const agg = aggregateLast7(active);
  const labels = agg.dates.map(d => {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  });

  // Calories line chart
  const calCtx = document.getElementById('caloriesChart').getContext('2d');
  if (!calChart) {
    calChart = new Chart(calCtx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Calories', data: agg.totalsCal, borderColor: 'rgba(13,110,253,1)', backgroundColor: 'rgba(13,110,253,0.12)', fill: true, tension: 0.3 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } }, animation: { duration: 600 } }
    });
  } else {
    calChart.data.labels = labels;
    calChart.data.datasets[0].data = agg.totalsCal;
    calChart.update();
  }

  // Duration bar chart
  const durCtx = document.getElementById('durationChart').getContext('2d');
  if (!durChart) {
    durChart = new Chart(durCtx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Duration', data: agg.totalsDur, backgroundColor: 'rgba(0,180,255,0.18)', borderColor: '#00b4ff', borderWidth: 1 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } }, animation: { duration: 600 } }
    });
  } else {
    durChart.data.labels = labels;
    durChart.data.datasets[0].data = agg.totalsDur;
    durChart.update();
  }

  return agg;
}

// Table render
function renderTable(filter = '') {
  const arr = read(KEY_ACTIVE).slice().sort((a, b) => b.date.localeCompare(a.date));
  const rows = arr.filter(w => {
    if (!filter) return true;
    const s = filter.toLowerCase();
    return (w.activity || '').toLowerCase().includes(s) || isoToDisplay(w.date).includes(s) || w.date.includes(s);
  });

  dom.tableBody.innerHTML = rows.map(w => `
    <tr>
      <td>${isoToDisplay(w.date)}</td>
      <td>${escapeHtml(w.activity)}</td>
      <td>${safeNum(w.duration)} min</td>
      <td>${safeNum(w.calories)}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-danger btn-delete" data-id="${w.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
          <button class="btn btn-outline-secondary btn-archive" data-id="${w.id}" title="Archive"><i class="fa-solid fa-box-archive"></i></button>
        </div>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="text-muted text-center">No workouts logged</td></tr>`;

  // Button actions
  document.querySelectorAll('.btn-delete').forEach(btn => btn.onclick = () => {
    if (!confirm('Delete this workout?')) return;
    deleteWorkout(btn.dataset.id);
  });
  document.querySelectorAll('.btn-archive').forEach(btn => btn.onclick = () => {
    if (!confirm('Archive this workout?')) return;
    archiveWorkout(btn.dataset.id);
  });
}

// Archive render
function renderArchive() {
  const arch = read(KEY_ARCHIVE).slice().sort((a, b) => b.date.localeCompare(a.date));
  dom.archiveList.innerHTML = arch.map(w => `
    <li class="list-group-item d-flex justify-content-between align-items-start">
      <div>
        <strong>${escapeHtml(w.activity)}</strong>
        <div class="small-muted">${isoToDisplay(w.date)} • ${safeNum(w.duration)} min • ${safeNum(w.calories)} cal</div>
      </div>
      <div class="btn-group">
        <button class="btn btn-sm btn-outline-success btn-restore" data-id="${w.id}" title="Restore"><i class="fa-solid fa-rotate-left"></i></button>
        <button class="btn btn-sm btn-outline-danger btn-del-arch" data-id="${w.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </li>
  `).join('') || `<li class="list-group-item text-muted">No archived workouts</li>`;

  document.querySelectorAll('.btn-restore').forEach(b => b.onclick = () => {
    if (!confirm('Restore this archived workout?')) return;
    restoreArchived(b.dataset.id);
  });
  document.querySelectorAll('.btn-del-arch').forEach(b => b.onclick = () => {
    if (!confirm('Delete archived item permanently?')) return;
    const newArch = read(KEY_ARCHIVE).filter(x => x.id !== b.dataset.id);
    write(KEY_ARCHIVE, newArch); renderArchive(); renderAll();
  });
}

// CRUD helpers
function addWorkout(obj) {
  const arr = read(KEY_ACTIVE);
  arr.push(obj);
  write(KEY_ACTIVE, arr);
  renderAll();
}
function deleteWorkout(id) {
  const arr = read(KEY_ACTIVE).filter(x => x.id !== id);
  write(KEY_ACTIVE, arr);
  renderAll();
}
function archiveWorkout(id) {
  const arr = read(KEY_ACTIVE);
  const item = arr.find(x => x.id === id);
  if (!item) return;
  write(KEY_ACTIVE, arr.filter(x => x.id !== id));
  const arch = read(KEY_ARCHIVE); arch.push(item); write(KEY_ARCHIVE, arch);
  renderAll();
}
function restoreArchived(id) {
  const arch = read(KEY_ARCHIVE);
  const item = arch.find(x => x.id === id);
  if (!item) return;
  write(KEY_ARCHIVE, arch.filter(x => x.id !== id));
  const act = read(KEY_ACTIVE); act.push(item); write(KEY_ACTIVE, act);
  renderAll();
}

// Stats update
function updateStats(agg) {
  const active = read(KEY_ACTIVE);
  const archived = read(KEY_ARCHIVE);
  const combined = active.concat(archived).map(w => ({ ...w, duration: safeNum(w.duration), calories: safeNum(w.calories) }));

  const totalCalories = combined.reduce((s, w) => s + w.calories, 0);
  const avgCalPerDay = Math.round(totalCalories / 7) || 0;
  dom.avgCal.textContent = `${avgCalPerDay} cal/day`;

  const totalWorkouts = combined.length || 0;
  const avgDur = totalWorkouts ? Math.round((combined.reduce((s, w) => s + w.duration, 0) / totalWorkouts) * 10) / 10 : 0;
  dom.avgDur.textContent = `${avgDur} min`;

  const freq = {};
  combined.forEach(w => freq[w.activity] = (freq[w.activity] || 0) + 1);
  const freqAct = Object.keys(freq).length ? Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] : '-';
  dom.freqAct.textContent = freqAct;

  const longest = combined.slice().sort((a, b) => b.duration - a.duration)[0];
  dom.longest.textContent = longest ? `${longest.activity} — ${longest.duration} min` : '-';

  // progress bars based on active only in last 7 days
  const activeLast7 = agg.totalsCal.reduce((s, v) => s + v, 0);
  const workoutsLast7 = read(KEY_ACTIVE).filter(w => agg.dates.includes(w.date)).length;
  const calPct = Math.min(100, Math.round((activeLast7 / CAL_GOAL) * 100));
  const workPct = Math.min(100, Math.round((workoutsLast7 / WORK_GOAL) * 100));
  dom.calBar.style.width = calPct + '%'; dom.calBar.textContent = calPct + '%';
  dom.workBar.style.width = workPct + '%'; dom.workBar.textContent = workPct + '%';
}

// Export / Import
function exportJSON() {
  const payload = { active: read(KEY_ACTIVE), archived: read(KEY_ARCHIVE), exported_at: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `fittrack_export_${Date.now()}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function exportCSV() {
  const arr = read(KEY_ACTIVE);
  const rows = [['id','date','activity','duration','calories']];
  arr.forEach(r => rows.push([r.id, r.date, r.activity, r.duration, r.calories]));
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `fittrack_active_${Date.now()}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const obj = JSON.parse(e.target.result);
      if (Array.isArray(obj.active)) write(KEY_ACTIVE, obj.active.map(normalizeWorkout));
      if (Array.isArray(obj.archived)) write(KEY_ARCHIVE, obj.archived.map(normalizeWorkout));
      renderAll();
      alert('Import completed');
    } catch(err) { alert('Invalid JSON file'); }
  };
  reader.readAsText(file);
}
function normalizeWorkout(w) {
  return { id: w.id || uid(), date: w.date || new Date().toISOString().slice(0,10), activity: (w.activity||'').trim(), duration: safeNum(w.duration), calories: safeNum(w.calories) };
}

// Utilities
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }

// Orchestrator
function renderAll() {
  const agg = renderCharts();
  renderTable(dom.filter.value.trim());
  renderArchive();
  updateStats(agg);
}

// Event listeners
dom.addForm.addEventListener('submit', e => {
  e.preventDefault();
  const activity = (dom.activity.value || '').trim();
  const duration = safeNum(dom.duration.value);
  const calories = safeNum(dom.calories.value);
  const dateVal = dom.date.value || new Date().toISOString().slice(0,10);

  if (!activity) { alert('Enter an activity name'); return; }
  if (duration <= 0) { alert('Duration must be > 0'); return; }
  if (calories <= 0) { alert('Calories must be > 0'); return; }

  const item = { id: uid(), activity, duration, calories, date: dateVal };
  addWorkout(item);

  dom.activity.value = '';
  dom.duration.value = 30;
  dom.calories.value = 300;
  dom.date.value = new Date().toISOString().slice(0,10);
});

dom.applyFilter.addEventListener('click', () => renderTable(dom.filter.value.trim()));
dom.clearFilter.addEventListener('click', () => { dom.filter.value = ''; renderTable(); });
dom.exportJSON.addEventListener('click', exportJSON);
dom.exportCSV.addEventListener('click', exportCSV);
dom.importFile.addEventListener('change', e => importJSON(e.target.files[0]));
dom.clearArchive.addEventListener('click', () => {
  if (!confirm('Clear archive permanently?')) return;
  write(KEY_ARCHIVE, []); renderArchive(); renderAll();
});
dom.restoreAll.addEventListener('click', () => {
  const arch = read(KEY_ARCHIVE);
  if (!arch.length) return alert('No archived items');
  if (!confirm('Restore all archived workouts into active list?')) return;
  const act = read(KEY_ACTIVE); write(KEY_ACTIVE, act.concat(arch)); write(KEY_ARCHIVE, []); renderAll();
});
dom.resetSample.addEventListener('click', () => {
  if (!confirm('Reset demo sample data? This will overwrite active workouts.')) return;
  seedSample(); renderAll();
});

// Initial setup
(function init() {
  if (!localStorage.getItem(KEY_ACTIVE) && !localStorage.getItem(KEY_ARCHIVE)) seedSample();
  else {
    write(KEY_ACTIVE, read(KEY_ACTIVE).map(normalizeWorkout));
    write(KEY_ARCHIVE, read(KEY_ARCHIVE).map(normalizeWorkout));
  }
  renderAll();
})();
