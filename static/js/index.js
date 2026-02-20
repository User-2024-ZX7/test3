(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (window.AOS) {
      AOS.init({
        once: true,
        duration: prefersReducedMotion ? 0 : 700,
        disable: prefersReducedMotion
      });
    }

    const sectionIds = ['home', 'benefits', 'how', 'stories', 'faq'];
    const homeNav = document.querySelector('.ft-nav');
    const sectionSurface = {
      home: 'dark',
      benefits: 'light',
      how: 'light',
      stories: 'light',
      faq: 'light'
    };
    const sectionLinkMap = new Map();
    document.querySelectorAll('.navbar .nav-link[href^="#"], .home-sidebar .sidebar-nav .nav-link[href^="#"]').forEach((link) => {
      const targetId = (link.getAttribute('href') || '').replace('#', '');
      if (!targetId) return;
      if (!sectionLinkMap.has(targetId)) sectionLinkMap.set(targetId, []);
      sectionLinkMap.get(targetId).push(link);
    });

    let activeSectionId = '';
    function setActiveSection(sectionId) {
      if (!sectionId || !sectionSurface[sectionId]) return;
      if (sectionId === activeSectionId) return;
      activeSectionId = sectionId;
      const darkSurface = sectionSurface[sectionId] === 'dark';
      if (homeNav) {
        homeNav.classList.toggle('is-glass', darkSurface);
        homeNav.classList.toggle('is-solid', !darkSurface);
      }
      sectionLinkMap.forEach((links, id) => {
        links.forEach((link) => {
          const active = id === sectionId;
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current', 'page');
          else link.removeAttribute('aria-current');
        });
      });
    }

    setActiveSection('home');

    const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
    if ('IntersectionObserver' in window && sections.length) {
      const sectionVisibility = new Map(sections.map((section) => [section.id, 0]));

      function pickMostVisibleSection() {
        let winnerId = activeSectionId || 'home';
        let winnerRatio = -1;
        sectionVisibility.forEach((ratio, id) => {
          if (ratio > winnerRatio) {
            winnerRatio = ratio;
            winnerId = id;
          }
        });
        if (winnerRatio > 0) return winnerId;

        const navOffset = (homeNav?.offsetHeight || 0) + 20;
        const nearest = sections
          .map((section) => ({ id: section.id, distance: Math.abs(section.getBoundingClientRect().top - navOffset) }))
          .sort((a, b) => a.distance - b.distance)[0];
        return nearest ? nearest.id : 'home';
      }

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const id = entry?.target?.id;
          if (!id) return;
          sectionVisibility.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });
        setActiveSection(pickMostVisibleSection());
      }, {
        threshold: [0, 0.2, 0.4, 0.6, 0.8],
        rootMargin: '-20% 0px -55% 0px'
      });
      sections.forEach((section) => observer.observe(section));
    }

    const calEl = document.getElementById('snapCalories');
    const totalEl = document.getElementById('snapTotal');
    const goalEl = document.getElementById('snapGoal');
    const bars = Array.from(document.querySelectorAll('.snapshot-bars .bar'));
    const weekRangeEl = document.getElementById('snapWeekRange');
    const prevWeekBtn = document.getElementById('snapPrevWeek');
    const nextWeekBtn = document.getElementById('snapNextWeek');
    const weekJumpInput = document.getElementById('snapWeekJump');
    const HOME_LOCALE = 'en-GB';
    const DAY_MS = 24 * 60 * 60 * 1000;
    let snapshotWeekOffset = 0;
    let snapshotMaxOffset = 0;

    function formatSnapshotRange(startIso, endIso) {
      if (!startIso || !endIso) return 'This week (Mon-Sun)';
      const start = new Date(`${startIso}T00:00:00`);
      const end = new Date(`${endIso}T00:00:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'This week (Mon-Sun)';

      const sameYear = start.getFullYear() === end.getFullYear();
      const startText = start.toLocaleDateString(HOME_LOCALE, { day: '2-digit', month: 'short' });
      const endText = end.toLocaleDateString(
        HOME_LOCALE,
        sameYear ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: 'short', year: 'numeric' }
      );
      return sameYear
        ? `${startText} - ${endText}, ${end.getFullYear()}`
        : `${startText} - ${endText}`;
    }

    function getWeekStartMonday(sourceDate) {
      const date = new Date(sourceDate);
      date.setHours(0, 0, 0, 0);
      const day = date.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
      const mondayDelta = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + mondayDelta);
      return date;
    }

    function getIsoWeekParts(sourceDate) {
      const date = new Date(sourceDate);
      date.setHours(0, 0, 0, 0);
      const dayIndex = (date.getDay() + 6) % 7; // Mon=0 ... Sun=6
      date.setDate(date.getDate() - dayIndex + 3); // Thursday of current ISO week

      const isoYear = date.getFullYear();
      const firstThursday = new Date(isoYear, 0, 4);
      const firstDayIndex = (firstThursday.getDay() + 6) % 7;
      firstThursday.setDate(firstThursday.getDate() - firstDayIndex + 3);

      const weekNo = 1 + Math.round((date - firstThursday) / DAY_MS / 7);
      return { isoYear, weekNo };
    }

    function formatWeekInputValue(sourceDate) {
      const { isoYear, weekNo } = getIsoWeekParts(sourceDate);
      return `${isoYear}-W${String(weekNo).padStart(2, '0')}`;
    }

    function parseWeekInputValue(value) {
      const match = /^(\d{4})-W(\d{2})$/.exec(String(value || '').trim());
      if (!match) return null;
      const year = Number(match[1]);
      const week = Number(match[2]);
      if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;

      const jan4 = new Date(year, 0, 4);
      jan4.setHours(0, 0, 0, 0);
      const jan4Day = (jan4.getDay() + 6) % 7;
      const week1Monday = new Date(jan4);
      week1Monday.setDate(jan4.getDate() - jan4Day);

      const monday = new Date(week1Monday);
      monday.setDate(week1Monday.getDate() + (week - 1) * 7);
      monday.setHours(0, 0, 0, 0);
      return monday;
    }

    function setSnapshotNavState() {
      if (prevWeekBtn) prevWeekBtn.disabled = snapshotWeekOffset >= snapshotMaxOffset;
      if (nextWeekBtn) nextWeekBtn.disabled = snapshotWeekOffset <= 0;
    }

    setSnapshotNavState();

    async function loadSnapshot() {
      if (!calEl || !totalEl || !goalEl || bars.length !== 7) return;

      try {
        const res = await fetch(`/api/public-stats?week_offset=${snapshotWeekOffset}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();

        snapshotMaxOffset = Math.max(0, Number(data.max_week_offset || 0));
        calEl.textContent = Number(data.calories_7d || 0).toLocaleString(HOME_LOCALE);
        totalEl.textContent = Number(data.weekly_workouts || 0).toLocaleString(HOME_LOCALE);
        goalEl.textContent = Number(data.weekly_goal_pct || 0).toLocaleString(HOME_LOCALE);
        if (weekRangeEl) {
          weekRangeEl.textContent = formatSnapshotRange(data.week_start, data.week_end);
        }
        if (weekJumpInput) {
          const currentWeekStart = getWeekStartMonday(new Date());
          const earliestWeekStart = new Date(currentWeekStart);
          earliestWeekStart.setDate(currentWeekStart.getDate() - (snapshotMaxOffset * 7));
          const selectedWeekStart = data.week_start
            ? new Date(`${data.week_start}T00:00:00`)
            : currentWeekStart;
          weekJumpInput.max = formatWeekInputValue(currentWeekStart);
          weekJumpInput.min = formatWeekInputValue(earliestWeekStart);
          weekJumpInput.value = formatWeekInputValue(selectedWeekStart);
          weekJumpInput.disabled = false;
        }
        setSnapshotNavState();

        const weekly = Array.isArray(data.weekly_calories) ? data.weekly_calories.slice(0, 7) : [];
        const labels = Array.isArray(data.weekly_labels) ? data.weekly_labels.slice(0, 7) : [];
        if (weekly.length !== 7) return;

        const maxValue = Math.max(...weekly, 1);
        bars.forEach((bar, index) => {
          const value = Number(weekly[index] || 0);
          const label = labels[index] || `Day ${index + 1}`;
          const heightPct = value > 0 ? Math.max(14, Math.round((value / maxValue) * 100)) : 10;
          bar.style.height = `${heightPct}%`;
          bar.style.opacity = value > 0 ? '1' : '0.35';
          bar.title = `${label}: ${value} kcal`;
          bar.setAttribute('aria-label', `${label}: ${value} calories`);
        });
      } catch {
        // keep fallback values
      }
    }

    loadSnapshot();
    const SNAPSHOT_INTERVAL_MS = 15000;
    let snapshotTimer = null;
    function startSnapshotPolling() {
      if (snapshotTimer) return;
      snapshotTimer = setInterval(() => {
        if (document.visibilityState === 'visible') loadSnapshot();
      }, SNAPSHOT_INTERVAL_MS);
    }
    function stopSnapshotPolling() {
      if (!snapshotTimer) return;
      clearInterval(snapshotTimer);
      snapshotTimer = null;
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        loadSnapshot();
        startSnapshotPolling();
      } else {
        stopSnapshotPolling();
      }
    });
    startSnapshotPolling();

    prevWeekBtn?.addEventListener('click', () => {
      if (snapshotWeekOffset >= snapshotMaxOffset) return;
      snapshotWeekOffset += 1;
      loadSnapshot();
    });

    nextWeekBtn?.addEventListener('click', () => {
      if (snapshotWeekOffset <= 0) return;
      snapshotWeekOffset -= 1;
      loadSnapshot();
    });

    weekJumpInput?.addEventListener('change', () => {
      const pickedStart = parseWeekInputValue(weekJumpInput.value);
      if (!pickedStart) return;
      const currentWeekStart = getWeekStartMonday(new Date());
      const diffDays = Math.floor((currentWeekStart - pickedStart) / DAY_MS);
      let nextOffset = Math.floor(diffDays / 7);
      if (!Number.isFinite(nextOffset)) return;
      nextOffset = Math.min(Math.max(nextOffset, 0), snapshotMaxOffset);
      if (nextOffset === snapshotWeekOffset) return;
      snapshotWeekOffset = nextOffset;
      loadSnapshot();
    });

    document.querySelectorAll('.home-sidebar a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const targetId = link.getAttribute('href');
        const target = targetId ? document.querySelector(targetId) : null;
        if (!target) return;
        event.preventDefault();
        const offcanvasEl = document.getElementById('homeSidebar');
        const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl) || new bootstrap.Offcanvas(offcanvasEl);
        offcanvas.hide();
        setTimeout(() => {
          target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
          history.replaceState(null, '', targetId);
          setActiveSection(targetId.replace('#', ''));
        }, 220);
      });
    });

    document.querySelectorAll('.navbar .nav-link[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => {
        const targetId = (link.getAttribute('href') || '').replace('#', '');
        if (targetId) setActiveSection(targetId);
      });
    });

    document.querySelectorAll('.home-sidebar a[href]:not([href^="#"])').forEach((link) => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        if (!href) return;
        event.preventDefault();
        const offcanvasEl = document.getElementById('homeSidebar');
        const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl) || new bootstrap.Offcanvas(offcanvasEl);
        offcanvas.hide();
        setTimeout(() => {
          window.location.href = href;
        }, 180);
      });
    });
  });
})();
