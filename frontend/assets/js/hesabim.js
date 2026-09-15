/* SecureLab — hesabim.html (own account profile, password change, PIN history) */
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

    renderProfile(user);
    wirePasswordForm();
    loadPinHistory(user.kullaniciId);
  }

  function renderProfile(user) {
    var fullName = ((user.ad || '') + ' ' + (user.soyad || '')).trim() || 'Kullanıcı';
    var initials = ((user.ad || '?').charAt(0) + (user.soyad || '').charAt(0)).toUpperCase();

    setText('summaryAvatar', initials || '?');
    setText('summaryName', fullName);
    setText('summaryEmail', user.eposta || '—');
    document.getElementById('summaryRoleBadge').innerHTML = UI.renderBadge('rol', user.rol);
    document.getElementById('summaryDurumBadge').innerHTML = UI.renderBadge('kullaniciDurum', user.durum);
  }

  /* ---------------- Password change ---------------- */

  function wirePasswordForm() {
    var form = document.getElementById('passwordForm');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      setPasswordAlert('', 'info');

      var mevcutSifre = document.getElementById('mevcutSifre').value;
      var yeniSifre = document.getElementById('yeniSifre').value;
      var yeniSifreTekrar = document.getElementById('yeniSifreTekrar').value;

      if (!mevcutSifre || !yeniSifre || !yeniSifreTekrar) {
        setPasswordAlert('Lütfen tüm alanları doldurun.', 'error');
        return;
      }
      if (yeniSifre !== yeniSifreTekrar) {
        setPasswordAlert('Yeni şifreler birbiriyle eşleşmiyor.', 'error');
        return;
      }

      var btn = document.getElementById('passwordSubmit');
      btn.disabled = true;
      var originalText = btn.textContent;
      btn.textContent = 'Güncelleniyor…';

      try {
        var res = await API.apiRequest('/api/auth/change-password', {
          method: 'POST',
          body: { mevcutSifre: mevcutSifre, yeniSifre: yeniSifre, yeniSifreTekrar: yeniSifreTekrar }
        });
        setPasswordAlert(res.message || 'Şifreniz güncellendi. Güvenliğiniz için tekrar giriş yapmanız gerekiyor.', 'success');
        UI.toast('Şifreniz güncellendi. Yönlendiriliyorsunuz…', 'success');
        form.reset();
        setTimeout(function () {
          API.clearToken();
          location.replace('login.html');
        }, 1600);
      } catch (err) {
        setPasswordAlert(err.message || 'Şifre güncellenemedi.', 'error');
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  }

  function setPasswordAlert(message, type) {
    var el = document.getElementById('passwordFormAlert');
    if (!message) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="alert alert-' + type + '"><div class="alert-body">' + UI.escapeHtml(message) + '</div></div>';
  }

  /* ---------------- PIN history ---------------- */

  async function loadPinHistory(userId) {
    var container = document.getElementById('pinHistoryContainer');
    UI.setLoading(container, 'PIN geçmişi yükleniyor…');

    try {
      var res = await API.apiRequest('/api/kullanicilar/' + userId + '/pin-gecmisi?limit=25');
      var kayitlar = Array.isArray(res.kayitlar) ? res.kayitlar : [];

      if (!kayitlar.length) {
        UI.setEmpty(container, 'PIN geçmişi bulunamadı', 'Henüz kayıtlı bir PIN geçmişiniz yok.');
        return;
      }

      var rows = kayitlar.map(function (k) {
        var durumValue = k.durum !== undefined ? k.durum : (k.aktif ? 'aktif' : 'pasif');
        var pinCell = k.pin
          ? '<code class="pin-cell">' + UI.escapeHtml(k.pin) + '</code>'
          : '<span class="cell-muted" title="Güvenlik nedeniyle yalnızca güncel PIN görüntülenebilir">Gizli</span>';
        var kullanim = k.kullanim || {};
        var kullanimCell;
        if (!kullanim.toplamDeneme) {
          kullanimCell = '<span class="cell-muted">Hiç kullanılmadı</span>';
        } else {
          var parts = [
            (kullanim.basariliKullanim || 0) + ' başarılı / ' + kullanim.toplamDeneme + ' deneme'
          ];
          if (kullanim.sonKullanim) {
            parts.push('son: ' + UI.escapeHtml(UI.formatDateTime(kullanim.sonKullanim)) + (kullanim.sonKapi ? ' — ' + UI.escapeHtml(kullanim.sonKapi) : ''));
          }
          kullanimCell = '<div>' + UI.escapeHtml(parts[0]) + '</div>' +
            (parts[1] ? '<div class="cell-muted" style="font-size:.8125rem">' + parts[1] + '</div>' : '');
        }
        return '<tr>' +
          '<td class="cell-muted">' + UI.escapeHtml(UI.formatDateTime(k.olusturulma)) + '</td>' +
          '<td>' + pinCell + '</td>' +
          '<td>' + UI.renderBadge('pinDurum', durumValue) + '</td>' +
          '<td>' + UI.escapeHtml(UI.kaynakLabel(k.kaynak)) + '</td>' +
          '<td class="cell-muted">' + UI.escapeHtml(UI.formatDate(k.gecerlilikBitis)) + '</td>' +
          '<td>' + kullanimCell + '</td>' +
          '</tr>';
      }).join('');

      container.innerHTML = '<div class="table-wrapper"><table class="data-table">' +
        '<thead><tr><th>Oluşturulma</th><th>PIN</th><th>Durum</th><th>Kaynak</th><th>Geçerlilik Bitişi</th><th>Kapı Kullanımı</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
        '<p class="text-meta" style="margin-top:.75rem;white-space:normal;overflow-wrap:break-word;">Güvenlik nedeniyle yalnızca o an geçerli olan (güncel) PIN görüntülenebilir; süresi dolan veya değiştirilen eski PIN\'ler bir daha gösterilmez. Kullanım bilgisi yalnızca çevrimiçi PIN doğrulamasıyla açılan kapılar için tutulur.</p>';
    } catch (err) {
      UI.setError(container, err.message, function () { loadPinHistory(userId); });
    }
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }
})();
