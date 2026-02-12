// dashboard.js
// DB-backed dashboard using Flask API (/api/workouts)

// ---------- Utilities ----------
function offsetDate(offsetDays){
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0,10);
}
function qs(sel){ return document.querySelector(sel) }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)) }
function numberOrZero(v){ return Number(v) || 0 }

async function apiGet(url){
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if(!res.ok) throw new Error('Request failed');
  return res.json();
}
async function apiPost(url){
  const res = await fetch(url, { method:'POST', headers: { 'Accept': 'application/json' } });
  if(!res.ok) throw new Error('Request failed');
  return res.json();
}

qs('#today').textContent = new Date().toLocaleString(undefined, { weekday:'long', month:'short', day:'numeric' });

// ---------- Chart instances ----------
let caloriesChart = null;
let typesChart = null;

// ---------- Initialize UI ----------
let allWorkouts = [];
let eventSource = null;

document.addEventListener('DOMContentLoaded', () => {
  renderAll();
  if (eventSource) eventSource.close();
  eventSource = new EventSource('/events');
  eventSource.onmessage = () => {
    renderAll();
  };

  // Events
  qs('#searchBtn').addEventListener('click', ()=> applySearch());
  qs('#searchInput').addEventListener('keydown', (e)=> { if(e.key === 'Enter') applySearch(); });
  qs('#filterBtn').addEventListener('click', ()=> applyDateFilter());
  qs('#clearFilter').addEventListener('click', ()=> { qs('#fromDate').value=''; qs('#toDate').value=''; renderAll(); });
  qs('#refreshBtn').addEventListener('click', renderAll);
  qs('#clearAll').addEventListener('click', async ()=> {
    if(!confirm('Clear all workouts?')) return;
    for(const w of allWorkouts){
      await apiPost(`/workouts/${w.id}/delete`);
    }
    await renderAll();
  });

  qs('#exportCsv').addEventListener('click', ()=> exportCSV(allWorkouts, 'fittrack_export_all.csv'));
  qs('#exportVisible').addEventListener('click', ()=> exportCSV(getVisibleRowsData(), 'fittrack_export_visible.csv'));
});

// ---------- Rendering pipeline ----------
async function renderAll(){
  try {
    const data = await apiGet('/api/workouts');
    allWorkouts = [...(data.active || []), ...(data.archived || [])];
  } catch {
    window.location.href = '/login';
    return;
  }
  const sorted = allWorkouts.slice().sort((a,b)=> b.date.localeCompare(a.date));
  renderHistory(sorted);
  updateStats(sorted);
  renderCharts(sorted);
  populateTypeFilter(); // ensure types up to date
}

function renderHistory(items){
  const tbody = qs('#historyBody');
  if(!tbody) return;
  if(!items.length){
    tbody.innerHTML = `<tr><td colspan="5" class="text-center muted">No workouts yet — add one via Add Workout or the demo.</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(it => {
    return `<tr data-id="${it.id}">
      <td>${it.date}</td>
      <td>${escapeHtml(it.activity)}</td>
      <td>${it.duration}</td>
      <td>${it.calories}</td>
      <td><button class="btn btn-sm btn-outline-danger btn-delete" data-id="${it.id}" title="Delete"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`;
  }).join('');
  // attach delete handlers
  qsa('.btn-delete').forEach(btn => btn.addEventListener('click', onDelete));
}

function onDelete(e){
  const id = e.currentTarget.dataset.id;
  apiPost(`/workouts/${id}/delete`).then(renderAll);
}

// ---------- Stats calculations (careful arithmetic) ----------
function updateStats(items){
  const totalWorkouts = items.length;
  const totalCalories = items.reduce((s, r) => s + numberOrZero(r.calories), 0);
  const avgDuration = totalWorkouts ? (items.reduce((s,r) => s + numberOrZero(r.duration), 0) / totalWorkouts) : 0;
  const weekly = aggregateByLastNDays(items, 7, 'calories');

  qs('#statWorkouts').textContent = totalWorkouts;
  qs('#statCalories').textContent = Math.round(totalCalories);
  qs('#statDuration').textContent = `${avgDuration.toFixed(1)} min`;
  qs('#statWeekly').textContent = Math.round(weekly.reduce((a,b)=>a+b,0));
  // progress: relative to a weekly target (example 3500 kcal)
  const weeklyTotal = weekly.reduce((a,b)=>a+b,0);
  const weeklyTarget = 3500;
  const goalPercent = Math.min(100, Math.round((weeklyTotal / weeklyTarget) * 100));
  const goalBar = document.querySelector('.progress') || null;
  // animate progress bar visually inside stat card if present:
  const goalElem = document.querySelector('.goal-progress .progress');
  if(goalElem) goalElem.style.width = goalPercent + '%';
}

// aggregates numeric field by last N days (returns array of length N)
function aggregateByLastNDays(items, n=7, field='calories'){
  const today = new Date(); today.setHours(0,0,0,0);
  const map = {};
  items.forEach(it => {
    const d = it.date;
    if(!d) return;
    map[d] = map[d] || 0;
    map[d] += numberOrZero(it[field]);
  });
  const out = [];
  for(let i = n-1; i >= 0; i--){
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0,10);
    out.push(map[key] || 0);
  }
  return out;
}

// ---------- Charts (Chart.js) ----------
function renderCharts(items){
  // calories chart: last 14 days aggregated
  const labels = [];
  const today = new Date(); today.setHours(0,0,0,0);
  for(let i=13;i>=0;i--){ const d = new Date(); d.setDate(d.getDate()-i); labels.push(d.toISOString().slice(0,10)); }
  const caloriesAgg = labels.map(l => items.filter(w=> w.date === l).reduce((s,r)=> s + numberOrZero(r.calories), 0));

  const ctx = qs('#caloriesChart').getContext('2d');
  if(caloriesChart) caloriesChart.destroy();
  caloriesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.map(l => (new Date(l)).toLocaleDateString(undefined,{month:'short', day:'numeric'})),
      datasets: [{
        label: 'Calories',
        data: caloriesAgg,
        borderColor: '#007bff',
        backgroundColor: (ctx)=> createGradient(ctx, '#007bff', '#00c6ff'),
        fill: true,
        tension: 0.32,
        pointRadius: 3,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 800, easing: 'easeOutCubic' },
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision:0 } },
        x: { grid: { display: false } }
      }
    }
  });

  // types chart (doughnut)
  const typeCounts = {};
  items.forEach(it => typeCounts[it.activity] = (typeCounts[it.activity] || 0) + 1);
  const types = Object.keys(typeCounts);
  const counts = Object.values(typeCounts);

  const ctx2 = qs('#typesChart').getContext('2d');
  if(typesChart) typesChart.destroy();
  const palette = generatePalette(types.length);
  typesChart = new Chart(ctx2, {
    type: 'doughnut',
    data: { labels: types, datasets: [{ data: counts, backgroundColor: palette }] },
    options: {
      responsive: true,
      animation: { animateRotate: true, duration: 600 },
      plugins: { legend: { display: false } }
    }
  });

  // render legend
  const legend = qs('#legendTypes'); legend.innerHTML = '';
  types.forEach((t, i) => {
    const el = document.createElement('div'); el.className = 'item';
    el.innerHTML = `<span style="width:12px;height:12px;background:${palette[i]};display:inline-block;border-radius:3px;margin-right:8px"></span><strong>${t}</strong><span class="muted ms-2">(${counts[i]})</span>`;
    legend.appendChild(el);
  });
}

function createGradient(ctx, c1, c2){
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0, hexToRgba(c1,0.35));
  g.addColorStop(1, hexToRgba(c2,0.05));
  return g;
}
function hexToRgba(hex, alpha=1){
  const bigint = parseInt(hex.replace('#',''), 16);
  const r = (bigint >> 16) & 255; const g = (bigint >> 8) & 255; const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
function generatePalette(n){
  const base = ['#007bff','#28a745','#ffc107','#dc3545','#17a2b8','#6f42c1','#fd7e14','#20c997'];
  if(n <= base.length) return base.slice(0,n);
  // create extended palette
  const out = [];
  for(let i=0;i<n;i++){
    out.push(base[i % base.length]);
  }
  return out;
}

// ---------- Filtering / Search ----------
function applySearch(){
  const q = (qs('#searchInput').value || '').trim().toLowerCase();
  const arr = allWorkouts.filter(w => {
    return !q || w.activity.toLowerCase().includes(q) || w.date.includes(q);
  }).sort((a,b)=> b.date.localeCompare(a.date));
  renderHistory(arr);
  updateStats(arr);
  renderCharts(arr);
}

function applyDateFilter(){
  const from = qs('#fromDate').value;
  const to = qs('#toDate').value;
  let arr = allWorkouts.slice();
  if(from) arr = arr.filter(w => w.date >= from);
  if(to) arr = arr.filter(w => w.date <= to);
  arr = arr.sort((a,b)=> b.date.localeCompare(a.date));
  renderHistory(arr);
  updateStats(arr);
  renderCharts(arr);
}

function populateTypeFilter(){
  const types = Array.from(new Set(allWorkouts.map(w=> w.activity))).sort();
  const sel = qs('#typeFilter');
  if(!sel) return;
  const current = sel.value || '';
  sel.innerHTML = `<option value="">All types</option>` + types.map(t => `<option value="${t}">${t}</option>`).join('');
  sel.value = current;
  sel.onchange = function(){
    const v = sel.value;
    const arr = v ? allWorkouts.filter(w=> w.activity === v) : allWorkouts;
    renderHistory(arr.sort((a,b)=> b.date.localeCompare(a.date)));
    updateStats(arr);
    renderCharts(arr);
  };
}

// ---------- Export CSV ----------
function exportCSV(data, filename='export.csv'){
  if(!data || !data.length){ alert('No data to export'); return; }
  const header = ['date','activity','duration','calories'];
  const rows = data.map(r => [r.date, r.activity, r.duration, r.calories].map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(','));
  const csv = [header.join(','), ...rows].join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function getVisibleRowsData(){
  // read currently rendered rows
  const nodes = qsa('#historyBody tr[data-id]');
  return nodes.map(tr => {
    const id = tr.dataset.id;
    const tds = tr.querySelectorAll('td');
    return { id, date: tds[0].textContent.trim(), activity: tds[1].textContent.trim(), duration: numberOrZero(tds[2].textContent), calories: numberOrZero(tds[3].textContent) };
  });
}

// ---------- small utils ----------
function escapeHtml(str){
  return String(str || '').replace(/[&<>"']/g, s=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[s]);
}


