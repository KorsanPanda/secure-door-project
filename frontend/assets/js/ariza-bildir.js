/* SecureLab — ariza-bildir.html (PUBLIC fault report form, no auth) */
(function () {
  'use strict';

  var API = window.SecureAPI;
  var UI = window.SecureUI;
  var MAX_PHOTO_BYTES = 2.5 * 1024 * 1024;
  var EMAIL_SUFFIX = '@subu.edu.tr';

  var selectedPhoto = null; // { name, dataUrl }

  document.addEventListener('DOMContentLoaded', function () {
    if (window.SecureTheme) window.SecureTheme.mountFloatingToggle();
    populateIssueTypes();
    wireDescriptionCounter();
    wirePhotoInput();
    wireForm();
  });

  function populateIssueTypes() {
    var select = document.getElementById('issueType');
    if (!select || !UI) return;
    UI.ARIZA_TURU_LIST.forEach(function (label) {
      var opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      select.appendChild(opt);
    });
  }

  function wireDescriptionCounter() {
    var textarea = document.getElementById('description');
    var counter = document.getElementById('descCount');
    if (!textarea || !counter) return;
    var update = function () { counter.textContent = String(textarea.value.length); };
    textarea.addEventListener('input', update);
    update();
  }

  function wirePhotoInput() {
    var input = document.getElementById('photoInput');
    var preview = document.getElementById('photoPreview');
    if (!input || !preview) return;

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      selectedPhoto = null;

      if (!file) {
        preview.innerHTML = '<span class="photo-preview-empty">Henüz fotoğraf seçilmedi.</span>';
        return;
      }

      if (file.size > MAX_PHOTO_BYTES) {
        showAlert('Fotoğraf boyutu 2,5 MB sınırını aşıyor. Lütfen daha küçük bir dosya seçin.', 'error');
        input.value = '';
        preview.innerHTML = '<span class="photo-preview-empty">Henüz fotoğraf seçilmedi.</span>';
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        selectedPhoto = { name: file.name, dataUrl: reader.result };
        preview.innerHTML = '<img src="' + reader.result + '" alt="Seçilen fotoğraf önizlemesi">' +
          '<span class="text-meta">' + UI.escapeHtml(file.name) + '</span>';
      };
      reader.onerror = function () {
        showAlert('Fotoğraf okunamadı. Lütfen tekrar deneyin.', 'error');
      };
      reader.readAsDataURL(file);
    });
  }

  function showAlert(message, type) {
    var el = document.getElementById('formAlert');
    if (!el) return;
    if (!message) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="alert alert-' + type + '"><div class="alert-body">' + UI.escapeHtml(message) + '</div></div>';
  }

  var EMAIL_LOCAL_PATTERN = /^[a-zA-Z0-9._-]+$/;

  function buildReportedBy(name, local) {
    return name + ' - ' + local + EMAIL_SUFFIX;
  }

  function wireForm() {
    var form = document.getElementById('arizaForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      showAlert('', 'info');

      var adSoyadInput = document.getElementById('adSoyad');
      var epostaInput = document.getElementById('epostaLocal');
      var issueTypeField = document.getElementById('issueType').closest('.field');
      var descField = document.getElementById('description').closest('.field');
      var photoField = document.getElementById('photoInput').closest('.field');
      var adSoyadField = adSoyadInput.closest('.field');
      var epostaField = epostaInput.closest('.field');

      [adSoyadField, epostaField, issueTypeField, descField, photoField].forEach(function (f) {
        f.classList.remove('has-error');
      });

      var adSoyad = adSoyadInput.value.trim();
      var epostaLocal = epostaInput.value.trim();
      var issueType = document.getElementById('issueType').value;
      var description = document.getElementById('description').value.trim();

      var valid = true;
      if (!adSoyad) {
        adSoyadField.classList.add('has-error');
        valid = false;
      }
      if (!epostaLocal || !EMAIL_LOCAL_PATTERN.test(epostaLocal)) {
        epostaField.classList.add('has-error');
        valid = false;
      }
      if (!issueType) {
        issueTypeField.classList.add('has-error');
        valid = false;
      }
      if (!selectedPhoto) {
        photoField.classList.add('has-error');
        valid = false;
      }
      if (description.length < 5 || description.length > 512) {
        descField.classList.add('has-error');
        valid = false;
      }
      if (!valid) {
        showAlert('Lütfen formdaki tüm alanları eksiksiz doldurun.', 'error');
        return;
      }

      var body = {
        reportedBy: buildReportedBy(adSoyad, epostaLocal),
        issueType: issueType,
        description: description,
        photoName: selectedPhoto.name,
        photoData: selectedPhoto.dataUrl
      };

      var submitBtn = document.getElementById('submitBtn');
      var submitText = document.getElementById('submitBtnText');
      submitBtn.disabled = true;
      var originalText = submitText.textContent;
      submitText.textContent = 'Gönderiliyor…';

      try {
        var res = await API.apiRequest('/api/arizalar', { method: 'POST', body: body });
        showSuccess(res.report);
      } catch (err) {
        showAlert(err.message || 'Bildirim gönderilemedi. Lütfen tekrar deneyin.', 'error');
        submitBtn.disabled = false;
        submitText.textContent = originalText;
      }
    });
  }

  function showSuccess(report) {
    var form = document.getElementById('arizaForm');
    var successEl = document.getElementById('successState');
    if (form) form.hidden = true;
    if (!successEl) return;

    var idText = report && report.arizaId ? ' (Kayıt No: ' + UI.escapeHtml(String(report.arizaId)) + ')' : '';

    successEl.hidden = false;
    successEl.innerHTML =
      '<div class="state-box">' +
      '<span class="state-box-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M8.5 12.5l2.3 2.3L16 9.8"></path></svg></span>' +
      '<div class="state-box-title">Bildiriminiz alındı</div>' +
      '<div class="state-box-text">Arıza bildiriminiz başarıyla iletildi' + idText + '. İlgili birim en kısa sürede inceleyecektir.</div>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="newReportBtn">Yeni bildirim oluştur</button>' +
      '</div>';

    var newBtn = document.getElementById('newReportBtn');
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        form.reset();
        document.getElementById('photoPreview').innerHTML = '<span class="photo-preview-empty">Henüz fotoğraf seçilmedi.</span>';
        document.getElementById('descCount').textContent = '0';
        selectedPhoto = null;
        successEl.hidden = true;
        form.hidden = false;
        var submitBtn = document.getElementById('submitBtn');
        var submitText = document.getElementById('submitBtnText');
        submitBtn.disabled = false;
        submitText.textContent = 'Bildirimi Gönder';
        showAlert('', 'info');
      });
    }
  }
})();
