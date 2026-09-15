(() => {
  const STORAGE_KEY = 'securelab_public_issue_url';
  const image = document.getElementById('qr-image');
  const link = document.getElementById('qr-url');
  const openButton = document.getElementById('qr-open-button');
  const input = document.getElementById('qr-address-input');
  const form = document.getElementById('qr-address-form');
  const loading = document.getElementById('qr-loading');
  const warning = document.getElementById('qr-network-warning');
  const printButton = document.getElementById('qr-print-button');
  const copyButton = document.getElementById('qr-copy-button');

  function setWarning(issueUrl) {
    const hostname = new URL(issueUrl).hostname;
    const localOnly = ['localhost', '127.0.0.1', '::1'].includes(hostname);
    warning.hidden = !localOnly;
    warning.textContent = localOnly
      ? 'Bu adres yalnızca bu bilgisayarda açılır. Telefon için alan adı, tünel adresi veya bilgisayarın yerel ağ IP adresini girin.'
      : '';
  }

  async function renderQr(requestedUrl = '') {
    loading.hidden = false;
    loading.textContent = 'QR kod hazırlanıyor…';
    image.hidden = true;
    const query = requestedUrl ? `?url=${encodeURIComponent(requestedUrl)}` : '';
    try {
      const response = await fetch(`/api/public/issue-config${query}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      const payload = await response.json();
      if (!response.ok || !payload.issueUrl || !payload.qrDataUrl) {
        throw new Error(payload.message || 'QR kod oluşturulamadı.');
      }
      image.src = payload.qrDataUrl;
      image.hidden = false;
      link.textContent = payload.issueUrl;
      link.href = payload.issueUrl;
      openButton.href = payload.issueUrl;
      input.value = payload.issueUrl;
      setWarning(payload.issueUrl);
      loading.hidden = true;
      return payload.issueUrl;
    } catch (error) {
      loading.hidden = false;
      loading.textContent = error.message || 'QR kod oluşturulamadı.';
      throw error;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const issueUrl = input.value.trim();
    try {
      const renderedUrl = await renderQr(issueUrl);
      localStorage.setItem(STORAGE_KEY, renderedUrl);
    } catch (error) {
      input.focus();
    }
  });

  printButton.addEventListener('click', () => window.print());
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link.href);
      copyButton.textContent = 'Kopyalandı';
      window.setTimeout(() => { copyButton.textContent = 'Adresi Kopyala'; }, 1500);
    } catch (error) {
      input.select();
    }
  });

  renderQr(localStorage.getItem(STORAGE_KEY) || '').catch(() => {});
})();
