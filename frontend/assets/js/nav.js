/* SecureLab — sidebar/topbar wiring for authenticated pages.
   Expects the canonical sidebar/topbar markup (see index.html) to already be
   present in the DOM. Call SecureNav.init(user) once the user object is known
   (after SecureAPI.requireAuth()). */
(function () {
  'use strict';

  function currentFileName() {
    var path = location.pathname.replace(/\\/g, '/');
    var last = path.substring(path.lastIndexOf('/') + 1);
    return last || 'index.html';
  }

  function highlightActiveLink() {
    var file = currentFileName();
    var links = document.querySelectorAll('.sidebar-link');
    links.forEach(function (link) {
      var href = (link.getAttribute('href') || '').split('/').pop();
      if (href === file) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('is-active');
        link.removeAttribute('aria-current');
      }
    });
  }

  function wireMobileToggle() {
    var shell = document.querySelector('.app-shell');
    var menuBtn = document.getElementById('menuToggle');
    var backdrop = document.getElementById('sidebarBackdrop');
    if (!shell) return;

    function openSidebar() {
      shell.classList.add('sidebar-open');
      // Belt-and-suspenders alongside the CSS `:has()` rule (not all browsers
      // support :has() yet) — lock background scroll while the off-canvas
      // menu is open, and make sure it's always restored on close.
      document.documentElement.classList.add('scroll-locked');
      if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    }

    function closeSidebar() {
      shell.classList.remove('sidebar-open');
      document.documentElement.classList.remove('scroll-locked');
      if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    }

    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        if (shell.classList.contains('sidebar-open')) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeSidebar);
    }

    document.querySelectorAll('.sidebar-link').forEach(function (link) {
      link.addEventListener('click', closeSidebar);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSidebar();
    });
  }

  function wireBreadcrumb() {
    var currentEl = document.getElementById('breadcrumbCurrent');
    if (!currentEl) return;
    var label = document.body.getAttribute('data-breadcrumb');
    if (label) currentEl.textContent = label;
  }

  function wireLogout() {
    var btn = document.getElementById('logoutBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      btn.disabled = true;
      try {
        if (window.SecureAPI) {
          await window.SecureAPI.apiRequest('/api/auth/logout', { method: 'POST' }).catch(function () {});
        }
      } finally {
        if (window.SecureAPI) window.SecureAPI.clearToken();
        location.replace('login.html');
      }
    });
  }

  function applyRoleVisibility(user) {
    var rol = user && user.rol;
    document.querySelectorAll('[data-role]').forEach(function (el) {
      var required = el.getAttribute('data-role');
      if (!required) return;
      var allowed = required.split(',').map(function (r) { return r.trim(); });
      if (rol && allowed.indexOf(rol) !== -1) {
        el.hidden = false;
      } else {
        el.hidden = true;
      }
    });
  }

  function fillProfile(user) {
    if (!user) return;
    var nameEl = document.getElementById('profileName');
    var roleEl = document.getElementById('profileRoleBadge');
    var avatarEl = document.getElementById('profileAvatar');

    var fullName = [user.ad, user.soyad].filter(Boolean).join(' ');

    if (nameEl) nameEl.textContent = fullName || user.eposta || 'Kullanıcı';

    if (roleEl) {
      var roleMap = { admin: ['Yönetici', 'badge-warning'], hoca: ['Hoca', 'badge-info'], sistem: ['Sistem', 'badge-neutral'] };
      var info = roleMap[user.rol] || [user.rol || '—', 'badge-neutral'];
      roleEl.textContent = info[0];
      roleEl.className = 'badge ' + info[1];
    }

    if (avatarEl) {
      var initials = ((user.ad || '?').charAt(0) + (user.soyad || '').charAt(0)).toUpperCase();
      avatarEl.textContent = initials || '?';
    }
  }

  function init(user) {
    highlightActiveLink();
    wireMobileToggle();
    wireBreadcrumb();
    wireLogout();
    if (user) {
      applyRoleVisibility(user);
      fillProfile(user);
    }
  }

  window.SecureNav = {
    init: init,
    highlightActiveLink: highlightActiveLink,
    applyRoleVisibility: applyRoleVisibility,
    fillProfile: fillProfile
  };
})();
