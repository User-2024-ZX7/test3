(() => {
  const nav = document.querySelector('.ft-nav');
  if (!nav) return;

  const updateNavState = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 8);
    const doc = document.documentElement;
    const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
    const pct = Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100));
    nav.style.setProperty('--ft-scroll', `${pct}%`);
  };

  updateNavState();
  window.addEventListener('scroll', updateNavState, { passive: true });
})();
