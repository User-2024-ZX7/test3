// ------------------- INITIALIZATION -------------------
if (window.AOS) {
    AOS.init({ once: true, duration: 600 });
}

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
    archiveCount: document.getElementById('archiveCountUser'),
    workoutSearch: document.getElementById('workoutSearchUser'),
    workoutSort: document.getElementById('workoutSortUser'),
    workoutMinCalories: document.getElementById('workoutMinCaloriesUser'),
    workoutReset: document.getElementById('workoutResetUser'),
    workoutResultSummary: document.getElementById('workoutResultSummaryUser'),
    workoutLastSync: document.getElementById('workoutLastSyncUser'),
    heroTotalWorkouts: document.getElementById('heroTotalWorkoutsUser'),
    heroTotalCalories: document.getElementById('heroTotalCaloriesUser'),
    heroGoal: document.getElementById('heroGoalUser'),
    weekPrev: document.getElementById('weekPrevUser'),
    weekNext: document.getElementById('weekNextUser'),
    weekRange: document.getElementById('weekRangeUser'),
    liveRegion: document.getElementById('userLiveRegion'),
    toastContainer: document.getElementById('userToastContainer'),

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
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
let eventSource = null;
let loadingWorkouts = false;
let avatarHydrated = false;
let lastAutoRefreshAt = 0;
const AUTO_REFRESH_MIN_MS = 15000;
const FALLBACK_POLL_MS = 30000;
const uiState = {
    query: '',
    sort: 'date_desc',
    minCalories: 0
};
let chartWeekOffset = 0;

// ------------------- HELPERS -------------------
const safeNum = v => Math.max(0, Number(v) || 0);
const isoToDisplay = d => new Date(d).toLocaleDateString();
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, s => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[s]
));
const isSmallViewport = () => window.matchMedia('(max-width: 576px)').matches;

function showToast(message, type = 'success') {
    if (!dom.toastContainer || !window.bootstrap?.Toast) return;
    const tone = type === 'danger' ? 'danger' : (type === 'warning' ? 'warning' : 'success');
    const wrapper = document.createElement('div');
    wrapper.className = `toast align-items-center text-bg-${tone} border-0`;
    wrapper.setAttribute('role', 'status');
    wrapper.setAttribute('aria-live', 'polite');
    wrapper.setAttribute('aria-atomic', 'true');
    wrapper.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>`;
    dom.toastContainer.appendChild(wrapper);
    const toast = new bootstrap.Toast(wrapper, { delay: 2200 });
    wrapper.addEventListener('hidden.bs.toast', () => wrapper.remove());
    toast.show();
}

function announce(message) {
    if (dom.liveRegion) dom.liveRegion.textContent = message;
}

function updateSyncMeta() {
    if (!dom.workoutLastSync) return;
    const now = new Date();
    dom.workoutLastSync.textContent = `Last sync: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

function getVisibleActiveWorkouts() {
    const query = uiState.query.trim().toLowerCase();
    const minCal = Math.max(0, Number(uiState.minCalories) || 0);

    const filtered = activeWorkouts.filter(w => {
        const activity = String(w.activity || '').toLowerCase();
        const date = String(w.date || '').toLowerCase();
        const calories = safeNum(w.calories);
        const matchesQuery = !query || activity.includes(query) || date.includes(query);
        const matchesCalories = calories >= minCal;
        return matchesQuery && matchesCalories;
    });

    filtered.sort((a, b) => {
        switch (uiState.sort) {
            case 'date_asc':
                return String(a.date || '').localeCompare(String(b.date || ''));
            case 'calories_desc':
                return safeNum(b.calories) - safeNum(a.calories) || String(b.date || '').localeCompare(String(a.date || ''));
            case 'duration_desc':
                return safeNum(b.duration) - safeNum(a.duration) || String(b.date || '').localeCompare(String(a.date || ''));
            case 'date_desc':
            default:
                return String(b.date || '').localeCompare(String(a.date || ''));
        }
    });
    return filtered;
}

function updateWorkoutMeta(visibleCount) {
    if (dom.workoutResultSummary) {
        dom.workoutResultSummary.textContent = `Showing ${visibleCount} of ${activeWorkouts.length} active workouts`;
    }
    if (dom.archiveCount) {
        dom.archiveCount.textContent = archivedWorkouts.length;
    }
}

function buildChartOptions() {
    const small = isSmallViewport();
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    boxWidth: small ? 10 : 14,
                    font: { size: small ? 10 : 12 }
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    maxRotation: 0,
                    minRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 7,
                    font: { size: small ? 10 : 12 }
                }
            },
            y: {
                beginAtZero: true,
                suggestedMin: 0,
                ticks: {
                    font: { size: small ? 10 : 12 }
                }
            }
        }
    };
}


function compressImageFile(file, maxSide = 320, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                const width = Math.max(1, Math.round(img.width * scale));
                const height = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                URL.revokeObjectURL(objectUrl);
                resolve(dataUrl);
            } catch (err) {
                URL.revokeObjectURL(objectUrl);
                reject(err);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('invalid_image'));
        };
        img.src = objectUrl;
    });
}

async function apiGet(url) {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    return handleApiResponse(res);
}

async function apiPost(url, body) {
    const headers = { 'Accept': 'application/json', 'X-CSRFToken': csrfToken };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : null
    });
    return handleApiResponse(res);
}

async function handleApiResponse(res) {
    let payload = null;
    try {
        payload = await res.json();
    } catch {
        payload = null;
    }
    if (res.ok) return payload || {};
    const code = payload?.error || `http_${res.status}`;
    if (code === 'csrf_token_invalid') {
        alert('Security token expired. The page will reload.');
        window.location.reload();
        throw new Error(code);
    }
    if (res.status === 401 || code === 'unauthorized') {
        window.location.href = '/login';
        throw new Error(code);
    }
    throw new Error(code);
}

async function logImportExport(action, format, records, filename) {
    if (adminView) return;
    try {
        await apiPost('/api/import-export-log', {
            action,
            format,
            records,
            filename: filename || null
        });
    } catch {
        // Silent fail for logging
    }
}

// ------------------- DATA LOAD -------------------
async function loadWorkouts() {
    if (loadingWorkouts) return;
    loadingWorkouts = true;
    try {
        const data = adminView && viewUserId
            ? await apiGet(`/admin/api/workouts/${viewUserId}`)
            : await apiGet('/api/workouts');
        activeWorkouts = data.active || [];
        archivedWorkouts = data.archived || [];
        if (!adminView && !avatarHydrated) {
            const avatar = await apiGet('/api/avatar');
            if (avatar && avatar.avatar_url) {
                dom.avatar.src = avatar.avatar_url;
            }
            avatarHydrated = true;
        }
        renderAll();
        updateSyncMeta();
        lastAutoRefreshAt = Date.now();
        announce('Workout data updated.');
    } catch (err) {
        const code = String(err?.message || '');
        if (code !== 'unauthorized' && code !== 'csrf_token_invalid') {
            showToast('Could not refresh workouts right now.', 'danger');
        }
    } finally {
        loadingWorkouts = false;
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
    try {
        await apiPost(`/workouts/${id}/delete`);
        await loadWorkouts();
        showToast('Workout deleted.');
    } catch {
        showToast('Could not delete workout.', 'danger');
    }
}

async function archiveWorkout(id) {
    if (adminView) return;
    try {
        await apiPost(`/workouts/${id}/archive`);
        await loadWorkouts();
        showToast('Workout archived.');
    } catch {
        showToast('Could not archive workout.', 'danger');
    }
}

async function restoreArchived(id) {
    if (adminView) return;
    try {
        await apiPost(`/workouts/${id}/restore`);
        await loadWorkouts();
        showToast('Workout restored.');
    } catch {
        showToast('Could not restore workout.', 'danger');
    }
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

async function importWorkouts(arr, sourceFormat, filename) {
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
    if (sourceFormat) {
        await logImportExport('import', sourceFormat, arr.length, filename);
    }
}

// ------------------- TABLES -------------------
function renderTable() {
    const arr = getVisibleActiveWorkouts();
    updateWorkoutMeta(arr.length);
    dom.tableBody.innerHTML = arr.length ? arr.map(w => `
        <tr>
            <td data-label="Date">${isoToDisplay(w.date)}</td>
            <td data-label="Activity">${escapeHtml(w.activity)}</td>
            <td data-label="Duration">${safeNum(w.duration)} min</td>
            <td data-label="Calories">${safeNum(w.calories)}</td>
            <td data-label="Actions" class="text-end">
                <button class="btn btn-sm btn-outline-danger del" data-id="${w.id}" title="Delete workout">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary arc" data-id="${w.id}" title="Archive workout">
                    <i class="fa-solid fa-box-archive"></i>
                </button>
            </td>
        </tr>`).join('') :
        `<tr><td colspan="5" class="text-muted text-center">No workouts match current filters</td></tr>`;

    document.querySelectorAll('.del').forEach(b => b.onclick = () => deleteWorkout(b.dataset.id));
    document.querySelectorAll('.arc').forEach(b => b.onclick = () => archiveWorkout(b.dataset.id));
}

function renderArchive() {
    if (dom.archiveCount) dom.archiveCount.textContent = archivedWorkouts.length;
    dom.archiveList.innerHTML = archivedWorkouts.length ? archivedWorkouts.map(w => `
        <li class="list-group-item archive-item">
            <span class="archive-item-text">${escapeHtml(w.activity)} • ${safeNum(w.calories)} cal</span>
            <button class="btn btn-sm btn-success res" data-id="${w.id}" title="Restore workout">
                <i class="fa-solid fa-rotate-left"></i>
            </button>
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
    const calOptions = buildChartOptions();
    const durOptions = buildChartOptions();

    if (!calChart) {
        calChart = new Chart(dom.charts.calories, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Calories (Weekly Progress)', data: agg.totalsCal, borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,.15)', fill: true, tension: .35, pointRadius: 5 }] },
            options: calOptions
        });
    } else {
        calChart.data.labels = labels;
        calChart.data.datasets[0].data = agg.totalsCal;
        calChart.options = calOptions;
        calChart.update();
    }

    if (!durChart) {
        durChart = new Chart(dom.charts.duration, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Minutes (Last 7 Days)', data: agg.totalsDur, backgroundColor: 'rgba(25,135,84,.25)', borderColor: '#198754', borderWidth: 1, borderRadius: 6 }] },
            options: durOptions
        });
    } else {
        durChart.data.labels = labels;
        durChart.data.datasets[0].data = agg.totalsDur;
        durChart.options = durOptions;
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
    const calPct = Math.max(0, Math.round(calTotal / CAL_GOAL * 100));
    const workPct = Math.max(0, Math.round(activeWorkouts.length / WORK_GOAL * 100));
    const calFillPct = Math.min(100, calPct);
    const workFillPct = Math.min(100, workPct);

    dom.calBar.style.width = calFillPct + '%';
    dom.calBar.textContent = calPct + '%';
    dom.calBar.classList.toggle('goal-over', calPct > 100);
    dom.workBar.style.width = workFillPct + '%';
    dom.workBar.textContent = workPct + '%';
    dom.workBar.classList.toggle('goal-over', workPct > 100);

    if (dom.heroTotalWorkouts) dom.heroTotalWorkouts.textContent = combined.length.toLocaleString();
    if (dom.heroTotalCalories) dom.heroTotalCalories.textContent = totalCal.toLocaleString();
    if (dom.heroGoal) dom.heroGoal.textContent = `${workPct}%`;
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
    if (dom.workoutSort) dom.workoutSort.value = uiState.sort;
    if (dom.workoutMinCalories) dom.workoutMinCalories.value = String(uiState.minCalories);

    dom.workoutSearch?.addEventListener('input', () => {
        uiState.query = dom.workoutSearch.value || '';
        renderTable();
    });
    dom.workoutSort?.addEventListener('change', () => {
        uiState.sort = dom.workoutSort.value || 'date_desc';
        renderTable();
    });
    dom.workoutMinCalories?.addEventListener('input', () => {
        uiState.minCalories = Math.max(0, Number(dom.workoutMinCalories.value) || 0);
        renderTable();
    });
    dom.workoutReset?.addEventListener('click', () => {
        uiState.query = '';
        uiState.sort = 'date_desc';
        uiState.minCalories = 0;
        if (dom.workoutSearch) dom.workoutSearch.value = '';
        if (dom.workoutSort) dom.workoutSort.value = uiState.sort;
        if (dom.workoutMinCalories) dom.workoutMinCalories.value = '0';
        renderTable();
    });

    // Avatar upload (save to DB) - disable in admin view
    if (adminView) {
        if (dom.avatarInput) dom.avatarInput.disabled = true;
    } else {
        dom.avatarInput?.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                alert('Please choose an image file.');
                e.target.value = '';
                return;
            }
            try {
                const optimizedDataUrl = await compressImageFile(file, 320, 0.82);
                dom.avatar.src = optimizedDataUrl;
                await apiPost('/api/avatar', { avatar_url: optimizedDataUrl });
                showToast('Avatar updated successfully.');
            } catch {
                alert('Avatar upload failed.');
            } finally {
                e.target.value = '';
            }
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
        try {
            await addWorkout(item);
            dom.activity.value = '';
            dom.duration.value = 30;
            dom.calories.value = 300;
            dom.date.value = new Date().toISOString().slice(0, 10);
            showToast('Workout added.');
        } catch {
            showToast('Could not add workout.', 'danger');
        }
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
        URL.revokeObjectURL(a.href);
        showToast('CSV exported.');
        logImportExport('export', 'csv', arr.length, 'workouts.csv');
    });

    dom.exportPDF?.addEventListener('click', () => {
        window.print();
        showToast('PDF export started.');
        logImportExport('export', 'pdf', activeWorkouts.length, 'workouts.pdf');
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
                await importWorkouts(Array.isArray(arr) ? arr : [], 'json', file.name);
                showToast('JSON import completed.');
            } catch {
                setImportFeedback('JSON import failed. Please check file format.', true);
                showToast('JSON import failed.', 'danger');
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
                await importWorkouts(arr, 'csv', file.name);
                showToast('CSV import completed.');
            } catch {
                setImportFeedback('CSV import failed. Please check file format.', true);
                showToast('CSV import failed.', 'danger');
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsText(file, 'utf-8');
    });

    dom.clearArchive?.addEventListener('click', () => {
        clearArchived().then(() => showToast('Archive cleared.')).catch(() => showToast('Could not clear archive.', 'danger'));
    });

    dom.restoreAll?.addEventListener('click', () => {
        restoreAllArchived().then(() => showToast('Archived workouts restored.')).catch(() => showToast('Could not restore archive.', 'danger'));
    });

    if (adminView) {
        dom.activity && (dom.activity.disabled = true);
        dom.duration && (dom.duration.disabled = true);
        dom.calories && (dom.calories.disabled = true);
        dom.date && (dom.date.disabled = true);
        dom.addForm?.querySelector('button[type="submit"]')?.setAttribute('disabled', 'disabled');
        dom.clearArchive && (dom.clearArchive.disabled = true);
        dom.restoreAll && (dom.restoreAll.disabled = true);
        dom.importJson && (dom.importJson.disabled = true);
        dom.importCsv && (dom.importCsv.disabled = true);
        dom.importJson?.closest('label')?.classList.add('disabled');
        dom.importCsv?.closest('label')?.classList.add('disabled');
    }

    loadWorkouts();
    if (eventSource) eventSource.close();
    let fallbackTimer = null;
    const maybeAutoRefresh = () => {
        if (document.hidden) return;
        const now = Date.now();
        if (now - lastAutoRefreshAt < AUTO_REFRESH_MIN_MS) return;
        loadWorkouts();
    };
    const startFallbackPolling = () => {
        if (fallbackTimer) return;
        fallbackTimer = setInterval(() => {
            maybeAutoRefresh();
        }, FALLBACK_POLL_MS);
    };
    if (window.EventSource) {
        eventSource = new EventSource('/events');
        eventSource.onmessage = () => {
            maybeAutoRefresh();
        };
        eventSource.onerror = () => {
            startFallbackPolling();
        };
    } else {
        startFallbackPolling();
    }

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (!calChart || !durChart) return;
            const agg = renderCharts();
            updateStats(agg);
        }, 120);
    });

    document.querySelectorAll('#appSidebar a[href^="#"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href');
            const target = href ? document.querySelector(href) : null;
            if (!target) return;
            event.preventDefault();
            const sidebarEl = document.getElementById('appSidebar');
            const sidebar = bootstrap.Offcanvas.getInstance(sidebarEl) || new bootstrap.Offcanvas(sidebarEl);
            sidebar.hide();
            setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                history.replaceState(null, '', href);
            }, 220);
        });
    });

    document.querySelectorAll('#appSidebar a[href]:not([href^="#"])').forEach((link) => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href');
            if (!href) return;
            event.preventDefault();
            const sidebarEl = document.getElementById('appSidebar');
            const sidebar = bootstrap.Offcanvas.getInstance(sidebarEl) || new bootstrap.Offcanvas(sidebarEl);
            sidebar.hide();
            setTimeout(() => {
                window.location.href = href;
            }, 180);
        });
    });
});
