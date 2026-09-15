const express = require('express');
const prisma = require('../config/prisma');
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');
const firmwareService = require('../services/firmwareService');
const mqttService = require('../services/mqttService');

const router = express.Router();

function publicBaseUrl(req) {
  const configuredUrl = String(process.env.FIRMWARE_PUBLIC_BASE_URL || '').trim();
  if (!configuredUrl) {
    const error = new Error('Gerçek uzaktan OTA için FIRMWARE_PUBLIC_BASE_URL ayarlanmalıdır.');
    error.statusCode = 503;
    throw error;
  }
  return configuredUrl;
}

// ESP32 bu endpointi JWT olmadan, kısa ömürlü HMAC imzalı URL ile çağırır.
router.get('/download/:filename', async (req, res, next) => {
  try {
    const { filename } = req.params;
    const deviceId = Number.parseInt(req.query.cihaz_id, 10);
    const { expires, signature } = req.query;

    if (!deviceId || !firmwareService.verifySignature(filename, deviceId, expires, signature)) {
      return res.status(403).json({ success: false, message: 'Firmware indirme bağlantısı geçersiz veya süresi dolmuş.' });
    }

    const requestDeviceId = Number.parseInt(req.get('x-Device-Id'), 10);
    if (requestDeviceId !== deviceId) {
      return res.status(403).json({ success: false, message: 'Firmware bağlantısı bu cihaza ait değil.' });
    }

    const metadata = await firmwareService.readMetadata(filename);
    const expectedMd5 = String(req.get('x-OTA-Expected-MD5') || '').toLowerCase();
    if (expectedMd5 && expectedMd5 !== metadata.md5.toLowerCase()) {
      return res.status(412).json({ success: false, message: 'MQTT komutundaki MD5 ile firmware MD5 eşleşmiyor.' });
    }

    res.status(200);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(metadata.size),
      'Cache-Control': 'private, no-store',
      'x-MD5': metadata.md5,
      'x-Firmware-Version': metadata.version
    });
    const stream = firmwareService.createReadStream(metadata.filePath);
    stream.on('error', next);
    return stream.pipe(res);
  } catch (error) {
    return next(error);
  }
});

router.use(authenticateToken, requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    return res.json({ success: true, data: await firmwareService.listFirmwares() });
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/upload',
  express.raw({ type: 'application/octet-stream', limit: '2mb' }),
  async (req, res, next) => {
    try {
      const version = req.query.version || req.get('x-firmware-version');
      const metadata = await firmwareService.saveFirmware(req.body, version);
      return res.status(201).json({
        success: true,
        message: 'Firmware sunucuya yüklendi.',
        data: metadata
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post('/cihaz/:cihazId/guncelle', async (req, res, next) => {
  try {
    const cihazId = Number.parseInt(req.params.cihazId, 10);
    if (!Number.isInteger(cihazId) || cihazId <= 0) {
      return res.status(400).json({ success: false, message: 'Geçersiz cihaz ID.' });
    }

    const cihaz = await prisma.cihaz.findUnique({ where: { cihazId } });
    if (!cihaz) {
      return res.status(404).json({ success: false, message: 'Cihaz bulunamadı.' });
    }

    const requestedVersion = req.body?.version;
    if (!requestedVersion) {
      return res.status(400).json({ success: false, message: 'Firmware version alanı zorunludur.' });
    }

    const metadata = await firmwareService.getFirmwareByVersion(requestedVersion);
    const downloadUrl = firmwareService.buildSignedDownloadUrl(
      publicBaseUrl(req),
      metadata,
      cihazId,
      Number(process.env.OTA_URL_TTL_SECONDS) || undefined
    );

    const published = mqttService.publishCommand(cihazId, 'firmware-guncelle', {
      komut_tipi: 'FIRMWARE_UPDATE',
      firmware_url: downloadUrl,
      firmware_versiyon: metadata.version,
      firmware_md5: metadata.md5,
      firmware_boyut: metadata.size,
      force: req.body?.force === true,
      kullanici_id: req.user.kullaniciId
    });

    if (!published) {
      return res.status(503).json({ success: false, message: 'MQTT bağlı değil; OTA komutu gönderilemedi.' });
    }

    return res.status(202).json({
      success: true,
      message: 'OTA güncelleme komutu MQTT üzerinden cihaza gönderildi.',
      data: {
        cihazId,
        version: metadata.version,
        size: metadata.size,
        md5: metadata.md5,
        downloadUrlExpires: new URL(downloadUrl).searchParams.get('expires')
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
