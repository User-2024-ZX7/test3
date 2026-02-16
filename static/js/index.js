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

    async function loadSnapshot() {
      const calEl = document.getElementById('snapCalories');
      const totalEl = document.getElementById('snapTotal');
      const goalEl = document.getElementById('snapGoal');
      const bars = Array.from(document.querySelectorAll('.snapshot-bars .bar'));
      if (!calEl || !totalEl || !goalEl || bars.length !== 7) return;

      try {
        const res = await fetch('/api/public-stats', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();

        calEl.textContent = Number(data.calories_7d || 0).toLocaleString();
        totalEl.textContent = Number(data.total_workouts || 0).toLocaleString();
        goalEl.textContent = Number(data.weekly_goal_pct || 0).toLocaleString();

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
