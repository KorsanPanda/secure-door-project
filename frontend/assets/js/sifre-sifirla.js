/* SecureLab — sifre-sifirla.html (password reset via emailed token) */
(function () {
  'use strict';

  var API = window.SecureAPI;

  document.addEventListener('DOMContentLoaded', function () {
    var themeSlot = document.getElementById('authThemeToggle');
    if (themeSlot && window.SecureTheme) window.SecureTheme.mountTopbarToggle(themeSlot);

    wirePasswordToggle();
    wireForm();
  });

  function getTokenFromQuery() {
    var params = new URLSearchParams(location.search);
    return params.get('token') || '';
  }

  function wirePasswordToggle() {
    var btn = document.getElementById('toggleNewPassword');
    var input = document.getElementById('yeniSifre');
    if (!btn || !input) return;
    btn.addEventListener('click', function () {
      var isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.setAttribute('aria-label', isHidden ? 'Şifreyi gizle' : 'Şifreyi göster');
    });
  }

  function showAlert(message, type) {
    var el = document.getElementById('resetAlert');
    if (!el) return;
    if (!message) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = '<div class="alert alert-' + type + '"><span class="alert-icon">' +
      (type === 'success'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M8.5 12.5l2.3 2.3L16 9.8"></path></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5"></path><path d="M12 16h.01"></path></svg>') +
      '</span><div class="alert-body">' + message.replace(/</g, '&lt;') + '</div></div>';
  }

  function wireForm() {
    var form = document.getElementById('resetForm');
    if (!form) return;

    var token = getTokenFromQuery();
    if (!token) {
      showAlert('Bağlantı geçersiz veya eksik. Lütfen e-postanızdaki sıfırlama bağlantısını kullanın.', 'error');
      form.querySelectorAll('input, button[type="submit"]').forEach(function (el) { el.disabled = true; });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      showAlert('', 'info');

      var yeniSifre = document.getElementById('yeniSifre').value;
      var yeniSifreTekrar = document.getElementById('yeniSifreTekrar').value;
      var pwField = document.getElementById('yeniSifreTekrar').closest('.field');

      var passwordOk = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(yeniSifre);
      if (!passwordOk) {
        showAlert('Şifre 8-72 karakter uzunluğunda olmalı ve en az bir harf ile bir rakam içermelidir.', 'error');
        return;
      }

      if (yeniSifre !== yeniSifreTekrar) {
        if (pwField) pwField.classList.add('has-error');
        showAlert('Girdiğiniz şifreler birbiriyle eşleşmiyor.', 'error');
        return;
      }
      if (pwField) pwField.classList.remove('has-error');

      var submitBtn = document.getElementById('resetSubmit');
      var submitText = document.getElementById('resetSubmitText');
      submitBtn.disabled = true;
      var originalText = submitText.textContent;
      submitText.textContent = 'Güncelleniyor…';

      try {
        var res = await API.apiRequest('/api/auth/reset-password', {
          method: 'POST',
          body: { token: token, yeniSifre: yeniSifre, yeniSifreTekrar: yeniSifreTekrar }
        });
        showAlert((res.message || 'Şifreniz başarıyla güncellendi.') + ' Giriş sayfasına yönlendiriliyorsunuz…', 'success');
        form.reset();
        setTimeout(function () { location.href = 'login.html'; }, 1800);
      } catch (err) {
        showAlert(err.message || 'Şifre güncellenemedi.', 'error');
        submitBtn.disabled = false;
        submitText.textContent = originalText;
      }
    });
  }
})();
