/* SecureLab — yetkilendirme.html (card approval, live scan panel, permissions) */
(function () {
  'use strict';

  var API = window.SecureAPI;
  var UI = window.SecureUI;

  var currentUser = null;
  var activeUsersCache = null;
  var pollTimer = null;
  var POLL_INTERVAL = 2000;

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('beforeunload', stopPolling);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopPolling();
    } else {
      startPolling();
    }
  });

  async function init() {
    var topbarActions = document.getElementById('topbarActions');
    if (topbarActions && window.SecureTheme) {
      window.SecureTheme.mountTopbarToggle(topbarActions);
      var toggle = topbarActions.querySelector('.topbar-theme-toggle');
      if (toggle) topbarActions.insertBefore(toggle, topbarActions.firstChild);
    }

    var user = await API.requireAuth();
    if (!user) return;

    if (user.rol !== 'admin') {
      location.replace('index.html');
      return;
    }

    window.SecureNav.init(user);
    currentUser = user;

    if (user.rol === 'admin') {
      loadPending();
      loadPermissions();
    }

    fetchLastScan();
    startPolling();
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(fetchLastScan, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /* ---------------- Live last-scan panel ---------------- */

  async function fetchLastScan() {
    var container = document.getElementById('lastScanContainer');
    try {
      var res = await API.apiRequest('/api/kartlar/son-okutulan');
      container.innerHTML =
        '<div class="stack">' +
        '<div class="credential-row"><div><div class="credential-row-label">Kart UID</div>' +
        '<div class="credential-row-value">' + UI.escapeHtml(res.okunanUid || '—') + '</div></div>' +
        (res.sonuc ? UI.renderBadge('sonuc', res.sonuc) : '') +
        '</div>' +
        '<div class="text-meta">Olay zamanı: ' + UI.escapeHtml(UI.formatDateTime(res.olayTamani)) + '</div>' +
        '<div class="text-meta">Kayıt zamanı: ' + UI.escapeHtml(UI.formatDateTime(res.kayitTamani)) + '</div>' +
        '</div>';
    } catch (err) {
      if (err.status === 404) {
        UI.setEmpty(container, 'Henüz kart okutulmadı', 'Bir kapı okuyucusundan kart okutulduğunda burada görünecektir.');
      } else {
        UI.setEmpty(container, 'Veri alınamadı', err.message || 'Sunucuya ulaşılamadı.');
      }
    }
  }

  /* ---------------- Pending approvals ---------------- */

  async function loadActiveUsersCache() {
    if (activeUsersCache) return activeUsersCache;
    try {
      var users = await API.apiRequest('/api/kullanicilar?durum=aktif&rol=');
      activeUsersCache = Array.isArray(users) ? users : [];
    } catch (err) {
      activeUsersCache = [];
    }
    return activeUsersCache;
  }

  async function loadPending() {
    var container = document.getElementById('pendingContainer');
    UI.setLoading(container, 'Onay bekleyen kartlar yükleniyor…');

    try {
      var users = await loadActiveUsersCache();
      var res = await API.apiRequest('/api/kartlar/onay-bekleyenler');
      var list = Array.isArray(res.data) ? res.data : [];

      if (!list.length) {
        UI.setEmpty(container, 'Onay bekleyen kart yok', 'Şu anda onay bekleyen bir kart okuması bulunmuyor.');
        return;
      }

      var userOptions = '<option value="">Kullanıcı seçin…</option>' + users.map(function (u) {
        return '<option value="' + u.kullaniciId + '">' + UI.escapeHtml((u.ad || '') + ' ' + (u.soyad || '') + (u.eposta ? ' (' + u.eposta + ')' : '')) + '</option>';
      }).join('');

      var rows = list.map(function (k) {
        var uid = UI.escapeHtml(k.kartUid || '—');
        return '<tr>' +
          '<td>' + uid + '</td>' +
          '<td class="cell-muted">' + UI.escapeHtml(UI.formatDateTime(k.sonOkutmaZamani)) + '</td>' +
          '<td>' + UI.renderBadge('onayDurum', 'bekliyor') + '</td>' +
          '<td>' +
            '<select class="form-control form-control-sm" data-user-select data-uid="' + UI.escapeHtml(k.kartUid || '') + '">' + userOptions + '</select>' +
          '</td>' +
          '<td class="cell-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" data-action="approve" data-uid="' + UI.escapeHtml(k.kartUid || '') + '">Onayla</button>' +
            '<button type="button" class="btn btn-danger-ghost btn-sm" data-action="reject" data-uid="' + UI.escapeHtml(k.kartUid || '') + '">Reddet</button>' +
          '</td>' +
          '</tr>';
      }).join('');

      container.innerHTML = '<div class="table-wrapper"><table class="data-table">' +
        '<thead><tr><th>Kart UID</th><th>Son Okutma</th><th>Durum</th><th>Kullanıcı</th><th>İşlemler</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>';

      container.querySelectorAll('[data-action="approve"]').forEach(function (btn) {
        btn.addEventListener('click', function () { approveCard(btn.getAttribute('data-uid'), container); });
      });
      container.querySelectorAll('[data-action="reject"]').forEach(function (btn) {
        btn.addEventListener('click', function () { rejectCard(btn.getAttribute('data-uid')); });
      });
    } catch (err) {
      UI.setError(container, err.message, loadPending);
    }
  }

  async function approveCard(kartUid, container) {
    var select = container.querySelector('[data-user-select][data-uid="' + cssEscape(kartUid) + '"]');
    var userId = select ? select.value : '';
    if (!userId) {
      UI.toast('Lütfen bir kullanıcı seçin.', 'warning');
      return;
    }
    try {
      var res = await API.apiRequest('/api/kartlar/onayla', { method: 'POST', body: { kartUid: kartUid, userId: Number(userId) } });
      UI.toast(res.message || 'Kart onaylandı.', 'success');
      loadPending();
      loadPermissions();
    } catch (err) {
      UI.toast(err.message || 'Kart onaylanamadı.', 'error');
    }
  }

  async function rejectCard(kartUid) {
    if (!window.confirm(kartUid + ' UID\'li kartı reddetmek istediğinize emin misiniz?')) return;
    try {
      var res = await API.apiRequest('/api/kartlar/reddet', { method: 'POST', body: { kartUid: kartUid } });
      UI.toast(res.message || 'Kart reddedildi.', 'success');
      loadPending();
    } catch (err) {
      UI.toast(err.message || 'Kart reddedilemedi.', 'error');
    }
  }

  function cssEscape(value) {
    return String(value).replace(/"/g, '\\"');
  }

  /* ---------------- Permissions table ---------------- */

  async function loadPermissions() {
    var container = document.getElementById('permissionsContainer');
    UI.setLoading(container, 'Yetkilendirmeler yükleniyor…');

    try {
      var list = await API.apiRequest('/api/kart-yetkilendirmeler');
      list = Array.isArray(list) ? list : [];

      if (!list.length) {
        UI.setEmpty(container, 'Yetkilendirme bulunamadı', 'Henüz onaylanmış bir kart yetkilendirmesi yok.');
        return;
      }

      var rows = list.map(function (y) {
        var rowId = y.yetkiId !== undefined ? y.yetkiId : y.id;
        var kullaniciAdi = y.kullanici ? ((y.kullanici.ad || '') + ' ' + (y.kullanici.soyad || '')) : '—';
        var birimAdi = y.birim && y.birim.ad ? y.birim.ad : '—';
        return '<tr data-row-id="' + rowId + '">' +
          '<td>' + UI.escapeHtml(kullaniciAdi) + '</td>' +
          '<td class="cell-muted">' + UI.escapeHtml(birimAdi) + '</td>' +
          '<td>' + UI.escapeHtml(y.kartUid || '—') + '</td>' +
          '<td><button type="button" class="badge badge-btn badge-' + (UI.badgeInfo('genelDurum', y.durum).variant) + '" data-action="toggle" data-id="' + rowId + '" data-durum="' + UI.escapeHtml(y.durum || '') + '">' + UI.badgeInfo('genelDurum', y.durum).label + '</button></td>' +
          '<td class="cell-muted">' + UI.escapeHtml(UI.formatDateTime(y.yetkilendirilmeTarihi)) + '</td>' +
          '<td class="cell-muted">' + UI.escapeHtml(UI.formatDate(y.sonKullanilmaTarihi)) + '</td>' +
          '</tr>';
      }).join('');

      container.innerHTML = '<div class="table-wrapper"><table class="data-table">' +
        '<thead><tr><th>Kullanıcı</th><th>Birim</th><th>Kart UID</th><th>Durum</th><th>Yetkilendirme Tarihi</th><th>Son Kullanma</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>';

      container.querySelectorAll('[data-action="toggle"]').forEach(function (btn) {
        btn.addEventListener('click', function () { toggleDurum(btn); });
      });
    } catch (err) {
      UI.setError(container, err.message, loadPermissions);
    }
  }

  async function toggleDurum(btn) {
    var id = btn.getAttribute('data-id');
    var current = btn.getAttribute('data-durum');
    var next = current === 'aktif' ? 'pasif' : 'aktif';

    var info = UI.badgeInfo('genelDurum', next);
    btn.className = 'badge badge-btn badge-' + info.variant;
    btn.textContent = info.label;
    btn.setAttribute('data-durum', next);
    btn.disabled = true;

    try {
      await API.apiRequest('/api/kart-yetkilendirmeler/' + id, { method: 'PUT', body: { durum: next } });
      UI.toast('Yetkilendirme durumu güncellendi.', 'success');
    } catch (err) {
      var revertInfo = UI.badgeInfo('genelDurum', current);
      btn.className = 'badge badge-btn badge-' + revertInfo.variant;
      btn.textContent = revertInfo.label;
      btn.setAttribute('data-durum', current);
      UI.toast(err.message || 'Durum güncellenemedi.', 'error');
    } finally {
      btn.disabled = false;
    }
  }
})();
