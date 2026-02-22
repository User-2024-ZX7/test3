(function () {
  'use strict';

  function resolveInput(toggleButton) {
    const selector = toggleButton.getAttribute('data-toggle-password');
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch (error) {
      return null;
    }
  }

  function setToggleState(toggleButton, input, reveal) {
    input.type = reveal ? 'text' : 'password';
    toggleButton.setAttribute('aria-pressed', reveal ? 'true' : 'false');
    toggleButton.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');

    const icon = toggleButton.querySelector('i');
    if (!icon) return;
    icon.classList.toggle('fa-eye', !reveal);
    icon.classList.toggle('fa-eye-slash', reveal);
  }

  document.addEventListener('click', function (event) {
    const toggleButton = event.target.closest('button[data-toggle-password]');
    if (!toggleButton) return;

    const input = resolveInput(toggleButton);
    if (!input) return;

    const shouldReveal = input.type === 'password';
    setToggleState(toggleButton, input, shouldReveal);
  });

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('button[data-toggle-password]').forEach(function (toggleButton) {
      const input = resolveInput(toggleButton);
      if (!input) return;
      setToggleState(toggleButton, input, input.type === 'text');
    });
  });
})();
