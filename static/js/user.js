// ------------------- INITIALIZATION -------------------
AOS.init({ once: true, duration: 600 });

// ------------------- CONSTANTS -------------------
const CAL_GOAL = 4000;
const WORK_GOAL = 10;

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
    exportPDF: document.getElementById('exportPDFUser'),
    importJson: document.getElementById('importJsonUser'),
    importCsv: document.getElementById('importCsvUser'),
    importFeedback: document.getElementById('importFeedback'),

    clearArchive: document.getElementById('clearArchiveUser'),
    restoreAll: document.getElementById('restoreAllUser'),

    charts: {
        calories: document.getElementById('caloriesChartUser'),
        duration: document.getElementById('durationChartUser')
    }
};

// ------------------- STATE -------------------
let activeWorkouts = [];
let archivedWorkouts = [];
const adminView = document.body?.dataset?.adminView === '1';
const viewUserId = document.body?.dataset?.viewUserId;
let eventSource = null;

// ------------------- HELPERS -------------------
const safeNum = v => Math.max(0, Number(v) || 0);
const isoToDisplay = d => new Date(d).toLocaleDateString();

async function apiGet(url) {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
}

async function apiPost(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: body ? JSON.stringify(body) : null
    });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
}

// ------------------- DATA LOAD -------------------
async function loadWorkouts() {
    try {
        const data = adminView && viewUserId
            ? await apiGet(`/admin/api/workouts/${viewUserId}`)
            : await apiGet('/api/workouts');
        activeWorkouts = data.active || [];
        archivedWorkouts = data.archived || [];
        if (!adminView) {
            const avatar = await apiGet('/api/avatar');
            if (avatar && avatar.avatar_url) {
                dom.avatar.src = avatar.avatar_url;
            }
        }
        renderAll();
    } catch {
        alert('Please login again.');
        window.location.href = '/login';
    }
}

// ------------------- CRUD -------------------
async function addWorkout(w) {
    if (adminView) return;
    await apiPost('/workouts', w);
    await loadWorkouts();
}

async function deleteWorkout(id) {
    if (adminView) return;
    if (!confirm('Delete workout?')) return;
    await apiPost(`/workouts/${id}/delete`);
    await loadWorkouts();
}

async function archiveWorkout(id) {
    if (adminView) return;
    await apiPost(`/workouts/${id}/archive`);
    await loadWorkouts();
}

async function restoreArchived(id) {
    if (adminView) return;
    await apiPost(`/workouts/${id}/restore`);
    await loadWorkouts();
}

async function restoreAllArchived() {
    if (adminView) return;
    await apiPost('/workouts/restore-all');
    await loadWorkouts();
}

async function clearArchived() {
    if (adminView) return;
    if (!confirm('Clear all archived workouts?')) return;
    await apiPost('/workouts/clear-archive');
    await loadWorkouts();
}

function setImportFeedback(msg, isError = false) {
    if (!dom.importFeedback) return;
    dom.importFeedback.textContent = msg;
    dom.importFeedback.className = `small mt-2 ${isError ? 'text-danger' : 'text-success'}`;
}

function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const idx = {
        date: header.indexOf('date'),
        activity: header.indexOf('activity'),
        duration: header.indexOf('duration'),
        calories: header.indexOf('calories')
    };
    if (Object.values(idx).some(i => i === -1)) return [];
    return lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        return {
            date: cols[idx.date],
            activity: cols[idx.activity],
            duration: safeNum(cols[idx.duration]),
            calories: safeNum(cols[idx.calories])
        };
    }).filter(w => w.date && w.activity && w.duration > 0 && w.calories > 0);
}

async function importWorkouts(arr) {
    if (!arr.length) {
        setImportFeedback('No valid workouts found.', true);
        return;
    }
    for (const w of arr) {
        await apiPost('/workouts', {
            activity: w.activity,
            duration: w.duration,
            calories: w.calories,
            date: w.date
        });
    }
    await loadWorkouts();
    setImportFeedback('Import completed successfully.');
}

// ------------------- TABLES -------------------
function renderTable() {
    const arr = [...activeWorkouts].sort((a, b) => b.date.localeCompare(a.date));
    dom.tableBody.innerHTML = arr.length ? arr.map(w => `
        <tr>
            <td>${isoToDisplay(w.date)}</td>
            <td>${w.activity}</td>
            <td>${safeNum(w.duration)} min</td>
            <td>${safeNum(w.calories)}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-danger del" data-id="${w.id}">✖</button>
                <button class="btn btn-sm btn-secondary arc" data-id="${w.id}">📦</button>
            </td>
        </tr>`).join('') :
        `<tr><td colspan="5" class="text-muted text-center">No workouts</td></tr>`;

    document.querySelectorAll('.del').forEach(b => b.onclick = () => deleteWorkout(b.dataset.id));
    document.querySelectorAll('.arc').forEach(b => b.onclick = () => archiveWorkout(b.dataset.id));
}

function renderArchive() {
    dom.archiveList.innerHTML = archivedWorkouts.length ? archivedWorkouts.map(w => `
        <li class="list-group-item d-flex justify-content-between">
            ${w.activity} • ${safeNum(w.calories)} cal
            <button class="btn btn-sm btn-success res" data-id="${w.id}">↩</button>
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
    const agg = aggregateLast7Safe(activeWorkouts);
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
    const combined = activeWorkouts.concat(archivedWorkouts).map(w => ({
        ...w,
        duration: safeNum(w.duration),
        calories: safeNum(w.calories)
    }));

    const totalCal = combined.reduce((s, w) => s + w.calories, 0);
    dom.avgCal.textContent = `${Math.round(totalCal / 7)} cal/day`;

    const avgDur = combined.length ? Math.round(combined.reduce((s, w) => s + w.duration, 0) / combined.length) : 0;
    dom.avgDur.textContent = `${avgDur} min`;

    const freq = {};
    combined.forEach(w => freq[w.activity] = (freq[w.activity] || 0) + 1);
    dom.freqAct.textContent = Object.keys(freq).length ? Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] : '-';

    const longest = combined.length ? combined.reduce((a, b) => b.duration > a.duration ? b : a) : null;
    dom.longest.textContent = longest ? `${longest.activity} - ${longest.duration} min` : '-';

    const most = combined.length ? combined.reduce((a, b) => b.calories > a.calories ? b : a) : null;
    dom.mostCal.textContent = most && most.activity && most.calories > 0 ? `${most.activity} - ${most.calories} cal` : '—';

    const calTotal = agg.totalsCal.reduce((s, v) => s + safeNum(v), 0);
    const calPct = Math.min(100, Math.max(0, Math.round(calTotal / CAL_GOAL * 100)));
    const workPct = Math.min(100, Math.max(0, Math.round(activeWorkouts.length / WORK_GOAL * 100)));

    dom.calBar.style.width = calPct + '%';
    dom.calBar.textContent = calPct + '%';
    dom.workBar.style.width = workPct + '%';
    dom.workBar.textContent = workPct + '%';
}

// ------------------- RENDER EVERYTHING -------------------
function renderAll() {
    const agg = renderCharts();
    renderTable();
    renderArchive();
    updateStats(agg);
}

// ------------------- EVENT LISTENERS -------------------
document.addEventListener('DOMContentLoaded', () => {
    dom.date.value = new Date().toISOString().slice(0, 10);
    // Avatar upload (save to DB) - disable in admin view
    if (adminView) {
        if (dom.avatarInput) dom.avatarInput.disabled = true;
    } else {
        dom.avatarInput?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
                dom.avatar.src = reader.result;
                try {
                    await apiPost('/api/avatar', { avatar_url: reader.result });
                } catch {
                    alert('Avatar upload failed.');
                }
            };
            reader.readAsDataURL(file);
        });
    }

    dom.addForm?.addEventListener('submit', async e => {
        e.preventDefault();
        if (adminView) return;
        const item = {
            activity: dom.activity.value.trim(),
            duration: safeNum(dom.duration.value),
            calories: safeNum(dom.calories.value),
            date: dom.date.value || new Date().toISOString().slice(0, 10)
        };
        if (!item.activity || item.duration <= 0 || item.calories <= 0) return alert('Enter valid values');
        await addWorkout(item);
        dom.activity.value = '';
        dom.duration.value = 30;
        dom.calories.value = 300;
        dom.date.value = new Date().toISOString().slice(0, 10);
    });

    dom.exportCSV?.addEventListener('click', () => {
        const arr = activeWorkouts;
        const escapeCsv = v => {
            const s = String(v ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = [
            "Date,Activity,Duration,Calories",
            ...arr.map(w => [
                escapeCsv(w.date),
                escapeCsv(w.activity),
                escapeCsv(w.duration),
                escapeCsv(w.calories)
            ].join(','))
        ].join("\n");
        const bom = '\uFEFF'; // UTF-8 BOM for Excel/Unicode compatibility
        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'workouts.csv'; a.click();
    });

    dom.exportPDF?.addEventListener('click', () => {
        window.print();
    });

    dom.importJson?.addEventListener('change', async e => {
        if (adminView) return;
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const text = reader.result;
                const arr = JSON.parse(text);
                await importWorkouts(Array.isArray(arr) ? arr : []);
            } catch {
                setImportFeedback('JSON import failed. Please check file format.', true);
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsText(file, 'utf-8');
    });

    dom.importCsv?.addEventListener('change', async e => {
        if (adminView) return;
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const text = reader.result;
                const arr = parseCsv(text);
                await importWorkouts(arr);
            } catch {
                setImportFeedback('CSV import failed. Please check file format.', true);
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsText(file, 'utf-8');
    });

    dom.clearArchive?.addEventListener('click', () => {
        clearArchived();
    });

    dom.restoreAll?.addEventListener('click', () => {
        restoreAllArchived();
    });

    if (adminView) {
        dom.activity && (dom.activity.disabled = true);
        dom.duration && (dom.duration.disabled = true);
        dom.calories && (dom.calories.disabled = true);
        dom.date && (dom.date.disabled = true);
        dom.clearArchive && (dom.clearArchive.disabled = true);
        dom.restoreAll && (dom.restoreAll.disabled = true);
        dom.importJson && (dom.importJson.disabled = true);
        dom.importCsv && (dom.importCsv.disabled = true);
    }

    loadWorkouts();
    if (eventSource) eventSource.close();
    eventSource = new EventSource('/events');
    eventSource.onmessage = () => {
        loadWorkouts();
    };
});
