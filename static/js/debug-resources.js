// debug-resources.js — prints resource load & DOM checks to console
(function(){
  function log(...args){ console.log('%c[DEBUG]','background:#0d6efd;color:#fff;padding:2px 6px;border-radius:3px;',...args); }
  // list of expected static files
  const expect = [
    'static/css/style.css',
    'static/css/style-fixes.css',
    'static/js/auth.js',
    'static/js/register.js',
    'static/js/login.js',
    'static/js/add_workout.js',
    'static/js/dashboard.js',
    'static/js/admin.js'
  ];

  // Check network availability of CSS/JS by creating a HEAD fetch for each (works on file://? no; but OK for http/localhost)
  Promise.all(expect.map(p => fetch(p, {method:'HEAD'}).then(r => ({path:p, ok: r.ok, status: r.status})).catch(e => ({path:p, ok:false, error:e.message}))))
    .then(results => {
      log('Resource availability check (HEAD):', results);
    });

  // Check important DOM elements
  document.addEventListener('DOMContentLoaded', () => {
    const checks = {
      hero: !!document.getElementById('hero'),
      navbar: !!document.querySelector('.navbar'),
      styleSheets: Array.from(document.styleSheets).map(s => s.href).filter(Boolean),
      scripts: Array.from(document.scripts).map(s => s.src).filter(Boolean),
      localStorageSample: (() => { try { localStorage.setItem('__ft_debug','ok'); localStorage.removeItem('__ft_debug'); return true;} catch(e){ return false; }})()
    };
    log('DOM checks:', checks);
  });
})();
