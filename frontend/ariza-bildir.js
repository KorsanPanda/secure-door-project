'use strict';

const form = document.getElementById('issue-report-form');
const message = document.getElementById('issue-report-message');
const submitButton = document.getElementById('issue-report-submit');
const filePicker = document.getElementById('filePicker');
const cameraInput = document.getElementById('cameraInput');
const fileNameText = document.getElementById('fileNameText');

function setMessage(text, type = 'info') {
  if (!message) return;
  message.textContent = text;
  message.className = `form-message form-message-${type}`;
  message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function selectedPhoto() {
  return filePicker?.files?.[0] || cameraInput?.files?.[0] || null;
}

function updateFileName(input) {
  const file = input?.files?.[0];
  if (fileNameText) {
    fileNameText.textContent = file?.name || 'Dosya seçmek için tıklayın';
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Fotoğraf okunamadı. Lütfen başka bir fotoğraf deneyin.'));
    reader.readAsDataURL(file);
  });
}

async function sendIssueReport(payload) {
  let response;

  try {
    response = await fetch('/api/arizalar', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw new Error('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
  }

  const responseText = await response.text();
  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      throw new Error('Sunucudan geçersiz bir yanıt alındı.');
    }
  }

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || data?.message || 'Bildirim gönderilemedi. Lütfen tekrar deneyin.');
  }

  return data;
}

filePicker?.addEventListener('change', () => updateFileName(filePicker));
cameraInput?.addEventListener('change', () => updateFileName(cameraInput));

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const fullName = document.getElementById('report-full-name')?.value.trim();
  const emailUser = document.getElementById('report-email')?.value.trim();
  const issueType = document.getElementById('report-issue-type')?.value;
  const description = document.getElementById('report-description')?.value.trim();
  const photoFile = selectedPhoto();

  if (!fullName || !emailUser || !issueType || !description) {
    setMessage('Ad soyad, e-posta, arıza türü ve açıklama alanlarının tamamını doldurun.', 'error');
    return;
  }

  if (emailUser.includes('@') && !emailUser.toLowerCase().endsWith('@subu.edu.tr')) {
    setMessage('Lütfen SUBÜ e-posta adresinizi girin.', 'error');
    return;
  }

  if (photoFile && photoFile.size > 2_500_000) {
    setMessage('Fotoğraf en fazla 2,5 MB olabilir.', 'error');
    return;
  }

  const originalButtonHtml = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.textContent = 'Bildirim gönderiliyor…';
  setMessage('Bildiriminiz teknik ekibe gönderiliyor…', 'info');

  try {
    const reportedEmail = emailUser.includes('@') ? emailUser : `${emailUser}@subu.edu.tr`;
    const photoData = photoFile ? await readFileAsDataUrl(photoFile) : null;
    const result = await sendIssueReport({
      reportedBy: `${fullName} (${reportedEmail})`.slice(0, 128),
      issueType,
      description,
      photoName: photoFile?.name || null,
      photoData
    });

    form.reset();
    updateFileName(null);
    setMessage(result.message || 'Bildiriminiz teknik ekibe ulaştı. Teşekkür ederiz.', 'success');
  } catch (error) {
    setMessage(error.message || 'Bildirim gönderilemedi. Lütfen tekrar deneyin.', 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalButtonHtml;
  }
});
