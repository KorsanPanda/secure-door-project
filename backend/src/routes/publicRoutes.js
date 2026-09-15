const express = require('express');
const QRCode = require('qrcode');

const router = express.Router();

function normalizePublicUrl(value) {
  const parsed = new URL(String(value || ''));
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Yalnızca HTTP veya HTTPS adresi kullanılabilir.');
  }
  parsed.hash = '';
  return parsed.toString();
}

router.get('/issue-config', async (req, res) => {
  try {
    const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
    const protocol = forwardedProtocol || req.protocol;
    const host = forwardedHost || req.get('host') || 'localhost:8080';
    const inferredUrl = `${protocol}://${host}/ogrenci-ariza`;
    const requestedUrl = String(req.query.url || '').trim();
    const issueUrl = normalizePublicUrl(
      requestedUrl || process.env.PUBLIC_ISSUE_URL || inferredUrl
    );
    if (issueUrl.length > 2048) {
      return res.status(400).json({ message: 'QR adresi çok uzun.' });
    }

    const qrDataUrl = await QRCode.toDataURL(issueUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: { dark: '#0f2742', light: '#ffffff' }
    });
    res.set('Cache-Control', 'no-store');
    return res.json({ issueUrl, qrDataUrl });
  } catch (error) {
    return res.status(400).json({ message: 'Geçerli bir öğrenci formu adresi girin.' });
  }
});

module.exports = router;
