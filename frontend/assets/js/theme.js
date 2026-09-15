/* SecureLab — theme toggle (light/dark), persisted to localStorage['securelab-theme'] */
(function () {
  'use strict';

  var STORAGE_KEY = 'securelab-theme';

  var SUN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"></circle><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.55 1.55M17.85 17.85l1.55 1.55M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.55-1.55M17.85 6.15l1.55-1.55"></path></svg>';
  var MOON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.4A8.5 8.5 0 1 1 9.6 3.5a7 7 0 0 0 10.9 10.9Z"></path></svg>';

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) { /* ignore storage failures (private mode etc.) */ }
    updateButtons(theme);
  }

  function toggleTheme() {
    var next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  function updateButtons(theme) {
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    buttons.forEach(function (btn) {
      btn.innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON;
      btn.setAttribute('aria-label', theme === 'dark' ? 'Aydınlık temaya geç' : 'Karanlık temaya geç');
      btn.setAttribute('title', theme === 'dark' ? 'Aydınlık tema' : 'Karanlık tema');
    });
  }

  function initTheme() {
    var stored = getStoredTheme();
    if (stored !== 'dark' && stored !== 'light') {
      stored = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', stored);
    updateButtons(stored);
  }

  function createToggleButton(extraClass) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn' + (extraClass ? ' ' + extraClass : '');
    btn.setAttribute('data-theme-toggle', '');
    btn.addEventListener('click', toggleTheme);
    // Set this button's icon directly — it isn't attached to the document yet,
    // so updateButtons()'s querySelectorAll('[data-theme-toggle]') can't find it
    // (that's what caused the empty/blank icon until the first click elsewhere).
    var theme = getCurrentTheme();
    btn.innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON;
    btn.setAttribute('aria-label', theme === 'dark' ? 'Aydınlık temaya geç' : 'Karanlık temaya geç');
    btn.setAttribute('title', theme === 'dark' ? 'Aydınlık tema' : 'Karanlık tema');
    return btn;
  }

  /**
   * Injects a theme toggle button into the topbar actions area (authenticated pages).
   * @param {HTMLElement} container - element to append the button into.
   */
  function mountTopbarToggle(container) {
    if (!container) return null;
    var btn = createToggleButton('topbar-theme-toggle');
    container.appendChild(btn);
    return btn;
  }

  /**
   * Injects a floating theme toggle button for standalone pages (login, qr, public form).
   * @param {HTMLElement} [container] - optional parent; defaults to document.body.
   */
  function mountFloatingToggle(container) {
    var target = container || document.body;
    var wrap = document.createElement('div');
    wrap.className = 'floating-theme-toggle';
    var btn = createToggleButton();
    wrap.appendChild(btn);
    target.appendChild(wrap);
    return btn;
  }

  initTheme();

  window.SecureTheme = {
    init: initTheme,
    apply: applyTheme,
    toggle: toggleTheme,
    getCurrentTheme: getCurrentTheme,
    mountTopbarToggle: mountTopbarToggle,
    mountFloatingToggle: mountFloatingToggle
  };
})();
