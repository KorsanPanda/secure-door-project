/* SecureLab — gecici-sifre.html (self + admin PIN regeneration) */
(function () {
  'use strict';

  var API = window.SecureAPI;
  var UI = window.SecureUI;
  var currentUser = null;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    var topbarActions = document.getElementById('topbarActions');
    if (topbarActions && window.SecureTheme) {
      window.SecureTheme.mountTopbarToggle(topbarActions);
      var toggle = topbarActions.querySelector('.topbar-theme-toggle');
      if (toggle) topbarActions.insertBefore(toggle, topbarActions.firstChild);
    }

    var user = await API.requireAuth();
    if (!user) return;

    window.SecureNav.init(user);
    currentUser = user;

    wireSelfSection();

    if (user.rol === 'admin') {
      wireAdminSection();
      loadUsersForAdminPicker();
    }
  }

  function renderPinResult(container, veri, subtitle) {
    var cihazlar = Array.isArray(veri.cihazlar) ? veri.cihazlar : [];
    var deviceLabel = function (c) {
      if (c && typeof c === 'object') return c.seriNo || c.ad || c.cihazId || null;
      return (typeof c === 'string' || typeof c === 'number') ? String(c) : null;
    };
    var deviceNames = cihazlar.map(deviceLabel).filter(Boolean);
    var deviceList = cihazlar.length
      ? '<div class="text-meta">Etkilenen cihaz sayısı: <strong>' + cihazlar.length + '</strong>' +
        (deviceNames.length ? ' (' + UI.escapeHtml(deviceNames.join(', ')) + ')' : '') +
        '</div>'
      : '<div class="text-meta">Şu anda aktif cihaz bulunmadığı için PIN hiçbir cihaza iletilmedi.</div>';

    container.innerHTML =
      '<div class="credentials-callout">' +
      '<div class="credentials-callout-warning">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 21 19.5H3L12 3.5Z"></path><path d="M12 9.5v4"></path><path d="M12 16.8h.01"></path></svg>' +
      '<span>Bu PIN bir daha gösterilmeyecektir. Lütfen şimdi not alın veya kopyalayın.</span>' +
      '</div>' +
      (subtitle ? '<div class="text-meta">' + UI.escapeHtml(subtitle) + '</div>' : '') +
      '<div class="pin-display">' +
      '<div class="pin-display-value" id="__pinValue">' + UI.escapeHtml(veri.yeniPin || '—') + '</div>' +
      '<button type="button" class="copy-btn" id="__copyPinBtn">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="1.5"></rect><path d="M5 15V5a1 1 0 0 1 1-1h10"></path></svg>' +
      'Kopyala</button>' +
      '</div>' +
      '<div class="text-meta">Geçerlilik bitişi: <strong>' + UI.escapeHtml(veri.gecerlilikBitis ? UI.formatDate(veri.gecerlilikBitis) : '—') + '</strong></div>' +
      deviceList +
      '</div>';

    UI.wireCopyButton(container.querySelector('#__copyPinBtn'), function () {
      return container.querySelector('#__pinValue').textContent;
    });
  }

  function wireSelfSection() {
    var btn = document.getElementById('selfRenewBtn');
    var btnText = document.getElementById('selfRenewBtnText');
    var container = document.getElementById('selfResultContainer');

    btn.addEventListener('click', async function () {
      btn.disabled = true;
      var originalText = btnText.textContent;
      btnText.textContent = 'Yenileniyor…';

      try {
        var res = await API.apiRequest('/api/kullanicilar/' + currentUser.kullaniciId + '/sifre-yenile', { method: 'POST' });
        renderPinResult(container, res.veri || {}, null);
        UI.toast(res.mesaj || 'PIN yenilendi.', 'success');
      } catch (err) {
        UI.toast(err.message || 'PIN yenilenemedi.', 'error');
      } finally {
        btn.disabled = false;
        btnText.textContent = originalText;
      }
    });
  }

  async function loadUsersForAdminPicker() {
    var select = document.getElementById('adminUserSelect');
    try {
      var users = await API.apiRequest('/api/kullanicilar?durum=&rol=');
      users = Array.isArray(users) ? users : [];
      users.forEach(function (u) {
        var opt = document.createElement('option');
        opt.value = u.kullaniciId;
        opt.textContent = (u.ad || '') + ' ' + (u.soyad || '') + (u.eposta ? ' (' + u.eposta + ')' : '');
        select.appendChild(opt);
      });
    } catch (err) {
      UI.toast('Kullanıcı listesi yüklenemedi.', 'error');
    }
  }

  function wireAdminSection() {
    var select = document.getElementById('adminUserSelect');
    var btn = document.getElementById('adminRenewBtn');
    var btnText = document.getElementById('adminRenewBtnText');
    var container = document.getElementById('adminResultContainer');

    select.addEventListener('change', function () {
      btn.disabled = !select.value;
    });

    btn.addEventListener('click', async function () {
      if (!select.value) return;
      var label = select.options[select.selectedIndex].textContent;

      btn.disabled = true;
      var originalText = btnText.textContent;
      btnText.textContent = 'Yenileniyor…';

      try {
        var res = await API.apiRequest('/api/kullanicilar/' + select.value + '/sifre-yenile', { method: 'POST' });
        renderPinResult(container, res.veri || {}, label + ' için yeni PIN');
        UI.toast(res.mesaj || 'PIN yenilendi.', 'success');
      } catch (err) {
        UI.toast(err.message || 'PIN yenilenemedi.', 'error');
      } finally {
        btn.disabled = false;
        btnText.textContent = originalText;
      }
    });
  }
})();
