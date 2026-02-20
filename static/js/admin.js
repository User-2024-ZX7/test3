(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
    const usersTableBody = document.getElementById('usersTableBody');
    const archivedUsersTableBody = document.getElementById('archivedUsersTableBody');
    const activeSection = document.getElementById('activeUsersSection');
    const archivedSection = document.getElementById('archivedUsersSection');
    const activeCountBadge = document.getElementById('activeUserCountBadge');
    const archivedCountBadge = document.getElementById('archivedUserCountBadge');
    const resultSummary = document.getElementById('adminResultSummary');
    const lastSync = document.getElementById('adminLastSync');
    const liveRegion = document.getElementById('adminLiveRegion');
    const refreshBtn = document.getElementById('adminRefreshBtn');
    const resetBtn = document.getElementById('adminResetBtn');
    const searchInput = document.getElementById('adminSearch');
    const statusFilter = document.getElementById('adminStatusFilter');
    const sortSelect = document.getElementById('adminSort');
    const toastContainer = document.getElementById('adminToastContainer');
    const defaultAvatar = document.body?.dataset?.defaultAvatar || '/static/images/FitTrack.jpg';

    const state = {
      activeUsers: [],
      archivedUsers: [],
      filters: {
        query: '',
        status: 'all',
        sort: 'username_asc'
      }
    };
    const AUTO_REFRESH_MIN_MS = 15000;
    const FALLBACK_POLL_MS = 30000;
    let lastAutoRefreshAt = 0;

    const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (s) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[s]
    ));
    const toNumber = (value) => Number(value || 0);

    const announce = (message) => {
      if (!liveRegion) return;
      liveRegion.textContent = message;
    };

    const showToast = (message, type = 'success') => {
      if (!toastContainer || !window.bootstrap?.Toast) return;
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
      toastContainer.appendChild(wrapper);
      const toast = new bootstrap.Toast(wrapper, { delay: 2200 });
      wrapper.addEventListener('hidden.bs.toast', () => wrapper.remove());
      toast.show();
    };

    const handleResponse = async (res) => {
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
        window.location.href = '/admin-login';
        throw new Error(code);
      }
      throw new Error(code);
    };

    const postAdmin = async (url) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-CSRFToken': csrfToken }
      });
      return handleResponse(res);
    };

    const getFilteredAndSorted = () => {
      const query = state.filters.query.trim().toLowerCase();
      const status = state.filters.status;
      const sort = state.filters.sort;

      const matchUser = (u) => {
        if (!query) return true;
        const haystack = [
          u.username || '',
          u.email || '',
          u.freq_activity || ''
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      };

      let active = state.activeUsers.filter(matchUser);
      let archived = state.archivedUsers.filter(matchUser);

      if (status === 'active') archived = [];
      if (status === 'archived') active = [];

      const compareBySort = (a, b) => {
        switch (sort) {
          case 'username_desc':
            return String(b.username || '').localeCompare(String(a.username || ''), undefined, { sensitivity: 'base' });
          case 'active_desc':
            return toNumber(b.active_count) - toNumber(a.active_count) || String(a.username || '').localeCompare(String(b.username || ''), undefined, { sensitivity: 'base' });
          case 'avg_cal_desc':
            return toNumber(b.avg_cal) - toNumber(a.avg_cal) || String(a.username || '').localeCompare(String(b.username || ''), undefined, { sensitivity: 'base' });
          case 'archived_desc':
            return toNumber(b.archived_count) - toNumber(a.archived_count) || String(a.username || '').localeCompare(String(b.username || ''), undefined, { sensitivity: 'base' });
          case 'username_asc':
          default:
            return String(a.username || '').localeCompare(String(b.username || ''), undefined, { sensitivity: 'base' });
        }
      };

      active.sort(compareBySort);
      archived.sort(compareBySort);
      return { active, archived };
    };

    const renderRows = (rows) => rows.map((u) => `
      <tr class="align-middle">
        <td data-label="Avatar">
          <img src="${escapeHtml(u.avatar_url || defaultAvatar)}" class="avatar-thumb" alt="Avatar">
        </td>
        <td data-label="Username">${escapeHtml(u.username)}</td>
        <td data-label="Email">${escapeHtml(u.email)}</td>
        <td data-label="Active Workouts">${u.active_count}</td>
        <td data-label="Archived Workouts">${u.archived_count}</td>
        <td data-label="Avg Cal">${u.avg_cal}</td>
        <td data-label="Avg Dur">${u.avg_dur}</td>
        <td data-label="Frequent Activity">${escapeHtml(u.freq_activity)}</td>
        <td data-label="Actions">
          <button class="btn btn-sm btn-outline-primary btn-view" data-user-id="${u.id}" title="View">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="btn btn-sm btn-outline-warning btn-archive" data-user-id="${u.id}" title="Archive">
            <i class="fa-solid fa-box-archive"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger btn-delete" data-user-id="${u.id}" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>`).join('') || '<tr><td colspan="9" class="text-center text-muted">No active users match current filters</td></tr>';

    const renderArchived = (rows) => rows.map((u) => `
      <tr class="align-middle">
        <td data-label="Avatar">
          <img src="${escapeHtml(u.avatar_url || defaultAvatar)}" class="avatar-thumb" alt="Avatar">
        </td>
        <td data-label="Username">${escapeHtml(u.username)}</td>
        <td data-label="Email">${escapeHtml(u.email)}</td>
        <td data-label="Actions">
          <button class="btn btn-sm btn-outline-primary btn-view" data-user-id="${u.id}" title="View">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="btn btn-sm btn-outline-success btn-restore-user" data-user-id="${u.id}" title="Restore">
            <i class="fa-solid fa-rotate-left"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger btn-delete" data-user-id="${u.id}" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted">No archived users match current filters</td></tr>';

    const updateMeta = (activeCount, archivedCount) => {
      if (activeCountBadge) activeCountBadge.textContent = String(activeCount);
      if (archivedCountBadge) archivedCountBadge.textContent = String(archivedCount);
      if (resultSummary) {
        resultSummary.textContent = `Showing ${activeCount + archivedCount} users (${activeCount} active, ${archivedCount} archived)`;
      }
    };

    const wireActions = () => {
      document.querySelectorAll('.btn-view').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.userId;
          if (!id) return;
          window.location.href = `/admin/user/${id}`;
        });
      });
      document.querySelectorAll('.btn-archive').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.userId;
          if (!id || !confirm('Archive this user?')) return;
          try {
            await postAdmin(`/admin/users/${id}/archive`);
            showToast('User archived successfully.');
            loadAdminData();
          } catch {
            showToast('Could not archive user.', 'danger');
          }
        });
      });
      document.querySelectorAll('.btn-delete').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.userId;
          if (!id || !confirm('Delete this user and all workouts?')) return;
          try {
            await postAdmin(`/admin/users/${id}/delete`);
            showToast('User deleted permanently.', 'warning');
            loadAdminData();
          } catch {
            showToast('Could not delete user.', 'danger');
          }
        });
      });
      document.querySelectorAll('.btn-restore-user').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.userId;
          if (!id || !confirm('Restore this user?')) return;
          try {
            await postAdmin(`/admin/users/${id}/restore`);
            showToast('User restored successfully.');
            loadAdminData();
          } catch {
            showToast('Could not restore user.', 'danger');
          }
        });
      });
    };

    const applyFiltersAndRender = () => {
      const { active, archived } = getFilteredAndSorted();
      if (usersTableBody) usersTableBody.innerHTML = renderRows(active);
      if (archivedUsersTableBody) archivedUsersTableBody.innerHTML = renderArchived(archived);
      if (activeSection) activeSection.classList.toggle('d-none', state.filters.status === 'archived');
      if (archivedSection) archivedSection.classList.toggle('d-none', state.filters.status === 'active');
      updateMeta(active.length, archived.length);
      wireActions();
    };

    let loadingAdminData = false;
    const loadAdminData = async () => {
      if (loadingAdminData) return;
      loadingAdminData = true;
      if (refreshBtn) refreshBtn.disabled = true;
      try {
        const res = await fetch('/admin/data', { cache: 'no-store' });
        const data = await handleResponse(res);

        const snap = data.today_snapshot || {};
        const activeEl = document.getElementById('adminSnapActiveUsers');
        const workoutsEl = document.getElementById('adminSnapWorkouts');
        const caloriesEl = document.getElementById('adminSnapCalories');
        const avgEl = document.getElementById('adminSnapAvgCalories');
        const heroUsers = document.getElementById('adminHeroUsers');
        const heroWorkouts = document.getElementById('adminHeroWorkouts');
        const heroAvgCalories = document.getElementById('adminHeroAvgCalories');
        if (activeEl) activeEl.textContent = Number(snap.active_users || 0).toLocaleString();
        if (workoutsEl) workoutsEl.textContent = Number(snap.workouts || 0).toLocaleString();
        if (caloriesEl) caloriesEl.textContent = Number(snap.calories || 0).toLocaleString();
        if (avgEl) avgEl.textContent = Number(snap.avg_calories || 0).toLocaleString();
        if (heroUsers) heroUsers.textContent = Number(data.total_users || 0).toLocaleString();
        if (heroWorkouts) heroWorkouts.textContent = Number(data.total_workouts || 0).toLocaleString();
        if (heroAvgCalories) heroAvgCalories.textContent = Number(data.avg_calories || 0).toLocaleString();

        state.activeUsers = data.user_stats || [];
        state.archivedUsers = data.archived_users || [];
        applyFiltersAndRender();

        const now = new Date();
        if (lastSync) {
          lastSync.textContent = `Last sync: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        }
        lastAutoRefreshAt = Date.now();
        announce('Admin data updated.');
      } catch {
        showToast('Could not refresh admin dashboard data.', 'danger');
      } finally {
        if (refreshBtn) refreshBtn.disabled = false;
        loadingAdminData = false;
      }
    };

    const maybeAutoRefresh = () => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastAutoRefreshAt < AUTO_REFRESH_MIN_MS) return;
      loadAdminData().catch(() => {});
    };

    let fallbackTimer = null;
    const startFallbackPolling = () => {
      if (fallbackTimer) return;
      fallbackTimer = setInterval(() => {
        maybeAutoRefresh();
      }, FALLBACK_POLL_MS);
    };

    if (window.EventSource) {
      const es = new EventSource('/events');
      es.onmessage = () => {
        maybeAutoRefresh();
      };
      es.onerror = () => {
        startFallbackPolling();
      };
    } else {
      startFallbackPolling();
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadAdminData().catch(() => {});
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.filters = { query: '', status: 'all', sort: 'username_asc' };
        if (searchInput) searchInput.value = '';
        if (statusFilter) statusFilter.value = 'all';
        if (sortSelect) sortSelect.value = 'username_asc';
        applyFiltersAndRender();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        state.filters.query = searchInput.value || '';
        applyFiltersAndRender();
      });
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        state.filters.status = statusFilter.value;
        applyFiltersAndRender();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        state.filters.sort = sortSelect.value;
        applyFiltersAndRender();
      });
    }

    loadAdminData();

    document.querySelectorAll('#appSidebar a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const target = document.querySelector(link.getAttribute('href') || '');
        if (!target) return;
        event.preventDefault();
        const sidebarEl = document.getElementById('appSidebar');
        const sidebar = bootstrap.Offcanvas.getInstance(sidebarEl) || new bootstrap.Offcanvas(sidebarEl);
        sidebar.hide();
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.replaceState(null, '', link.getAttribute('href'));
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
})();
