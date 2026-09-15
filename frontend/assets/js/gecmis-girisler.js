/* SecureLab — gecmis-girisler.html (access history: search, filter, paginate) */
(function () {
  'use strict';

  var API = window.SecureAPI;
  var UI = window.SecureUI;

  var PAGE_SIZE = 20;

  var state = {
    all: [],
    filtered: [],
    page: 1,
    search: '',
    yontem: '',
    sonuc: ''
  };

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

    wireControls();
    loadRecords();
  }

  function wireControls() {
    var searchInput = document.getElementById('searchInput');
    var yontemSelect = document.getElementById('filterYontem');
    var sonucSelect = document.getElementById('filterSonuc');

    var searchTimer = null;
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.search = searchInput.value;
        state.page = 1;
        applyFilters();
      }, 150);
    });

    yontemSelect.addEventListener('change', function () {
      state.yontem = yontemSelect.value;
      state.page = 1;
      applyFilters();
    });

    sonucSelect.addEventListener('change', function () {
      state.sonuc = sonucSelect.value;
      state.page = 1;
      applyFilters();
    });
  }

  async function loadRecords() {
    var container = document.getElementById('recordsContainer');
    UI.setLoading(container, 'Erişim kayıtları yükleniyor…');

    try {
      var records = await API.apiRequest('/api/erisim-kayitlari?limit=100&offset=0');
      state.all = Array.isArray(records) ? records : [];
      applyFilters();
    } catch (err) {
      UI.setError(container, err.message, loadRecords);
      setText('recordsCountSubtitle', 'Yüklenemedi');
    }
  }

  function applyFilters() {
    var search = state.search.trim().toLowerCase();

    state.filtered = state.all.filter(function (r) {
      if (state.yontem && r.dogrulamaYontemi !== state.yontem) return false;
      if (state.sonuc && r.sonuc !== state.sonuc) return false;
      if (search) {
        var kullanici = r.kullanici || {};
        var haystack = [kullanici.ad, kullanici.soyad, kullanici.eposta, r.kapi && r.kapi.ad]
          .filter(Boolean).join(' ').toLowerCase();
        if (haystack.indexOf(search) === -1) return false;
      }
      return true;
    });

    renderPage();
  }

  function renderPage() {
    var container = document.getElementById('recordsContainer');
    var totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;

    setText('recordsCountSubtitle', state.filtered.length + ' kayıt (toplam ' + state.all.length + ' arasından)');

    if (!state.filtered.length) {
      UI.setEmpty(container, 'Kayıt bulunamadı', 'Arama veya filtre kriterlerinizi değiştirmeyi deneyin.');
      document.getElementById('pagination').hidden = true;
      return;
    }

    var start = (state.page - 1) * PAGE_SIZE;
    var pageItems = state.filtered.slice(start, start + PAGE_SIZE);

    var rows = pageItems.map(function (r) {
      var kullanici = r.kullanici || {};
      var kullaniciText = (kullanici.ad || kullanici.soyad)
        ? UI.escapeHtml((kullanici.ad || '') + ' ' + (kullanici.soyad || '')) + (kullanici.eposta ? '<div class="text-meta">' + UI.escapeHtml(kullanici.eposta) + '</div>' : '')
        : '<span class="text-muted">Bilinmiyor</span>';
      var kapiText = r.kapi && r.kapi.ad ? UI.escapeHtml(r.kapi.ad) : '—';
      var detay = r.dogrulamaYontemi === 'kart' ? (r.okunanUid || r.kartUid || '—') : (r.kartUid || r.okunanUid || '—');
      var sonucCell = UI.renderBadge('sonuc', r.sonuc) +
        (r.sonuc === 'red' && r.redNedeni ? '<div class="text-meta">' + UI.escapeHtml(r.redNedeni) + '</div>' : '');

      return '<tr>' +
        '<td class="cell-muted">' + UI.escapeHtml(UI.formatDateTime(r.kayitTamani)) + '</td>' +
        '<td>' + kullaniciText + '</td>' +
        '<td>' + kapiText + '</td>' +
        '<td>' + UI.renderBadge('dogrulamaYontemi', r.dogrulamaYontemi) + '</td>' +
        '<td>' + sonucCell + '</td>' +
        '<td class="cell-muted">' + UI.escapeHtml(detay) + '</td>' +
        '</tr>';
    }).join('');

    container.innerHTML = '<div class="table-wrapper"><table class="data-table">' +
      '<thead><tr><th>Tarih / Saat</th><th>Kullanıcı</th><th>Kapı</th><th>Yöntem</th><th>Sonuç</th><th>Doğrulama Detayı</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    var pag = document.getElementById('pagination');
    if (totalPages <= 1) {
      pag.hidden = true;
      pag.innerHTML = '';
      return;
    }
    pag.hidden = false;

    var html = '';
    html += '<button type="button" class="pagination-btn" id="pagPrev"' + (state.page === 1 ? ' disabled' : '') + '>‹</button>';

    for (var i = 1; i <= totalPages; i++) {
      html += '<button type="button" class="pagination-btn' + (i === state.page ? ' is-active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }

    html += '<button type="button" class="pagination-btn" id="pagNext"' + (state.page === totalPages ? ' disabled' : '') + '>›</button>';
    pag.innerHTML = html;

    var prevBtn = document.getElementById('pagPrev');
    var nextBtn = document.getElementById('pagNext');
    if (prevBtn) prevBtn.addEventListener('click', function () { goToPage(state.page - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goToPage(state.page + 1); });

    pag.querySelectorAll('[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () { goToPage(Number(btn.getAttribute('data-page'))); });
    });
  }

  function goToPage(page) {
    state.page = page;
    renderPage();
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }
})();
