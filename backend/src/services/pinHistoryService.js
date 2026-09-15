const crypto = require('crypto');
const prisma = require('../config/prisma');

const PIN_FORMAT_VERSION = 'v1';

function getEncryptionKey() {
  const secret = process.env.PIN_HISTORY_ENCRYPTION_KEY
    || process.env.JWT_SECRET
    || 'securelab-development-pin-history-key';
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptPin(pin) {
  const value = String(pin || '');
  if (!/^\d{6}$/.test(value)) throw new Error('Kapı PIN değeri 6 haneli olmalıdır.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PIN_FORMAT_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url')
  ].join('.');
}

function decryptPin(payload) {
  const [version, ivValue, tagValue, encryptedValue] = String(payload || '').split('.');
  if (version !== PIN_FORMAT_VERSION || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Kapı PIN geçmişi çözümlenemedi.');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

async function recordPinHistory(client, { kullaniciId, pin, pinHash, gecerlilikBitis, kaynak }) {
  const userId = BigInt(kullaniciId);
  const now = new Date();
  await client.kapiSifreGecmisi.updateMany({
    where: { kullaniciId: userId, aktif: true },
    data: { aktif: false }
  });
  return client.kapiSifreGecmisi.create({
    data: {
      kullaniciId: userId,
      pinSifreli: encryptPin(pin),
      pinHash: pinHash || null,
      kaynak: String(kaynak || 'kullanici').slice(0, 32),
      aktif: true,
      olusturulma: now,
      gecerlilikBitis: gecerlilikBitis || null
    }
  });
}

async function listPinHistory(kullaniciId, limit = 50) {
  const records = await prisma.kapiSifreGecmisi.findMany({
    where: { kullaniciId: BigInt(kullaniciId) },
    orderBy: { olusturulma: 'desc' },
    take: Math.min(Math.max(Number(limit) || 50, 1), 100)
  });

  // Bu PIN'lerin kapıyı açmak için gerçekten kullanılıp kullanılmadığını görmek için
  // erisim_kaydi tablosundan (dogrulamaYontemi='pin' olan ve bu kapiSifreId'ye
  // bağlanmış) kayıtları grupla. Yalnızca çevrimiçi PIN doğrulaması bu bağlantıyı
  // oluşturur; offline/HMAC tabanlı erişimler bu istatistiğe dahil olmaz.
  const kapiSifreIds = records.map((record) => record.kapiSifreId);
  const usageByPinId = new Map();
  if (kapiSifreIds.length) {
    const usageRows = await prisma.erisimKaydi.findMany({
      where: { kapiSifreId: { in: kapiSifreIds } },
      select: { kapiSifreId: true, sonuc: true, olayTamani: true, kapi: { select: { ad: true } } },
      orderBy: { olayTamani: 'desc' }
    });
    for (const row of usageRows) {
      const key = row.kapiSifreId.toString();
      if (!usageByPinId.has(key)) {
        usageByPinId.set(key, { toplamDeneme: 0, basariliKullanim: 0, sonKullanim: null, sonKapi: null, sonSonuc: null });
      }
      const stats = usageByPinId.get(key);
      stats.toplamDeneme += 1;
      if (row.sonuc === 'izin') stats.basariliKullanim += 1;
      if (!stats.sonKullanim) {
        stats.sonKullanim = row.olayTamani;
        stats.sonKapi = row.kapi?.ad || null;
        stats.sonSonuc = row.sonuc;
      }
    }
  }

  const now = Date.now();
  return records.map((record) => {
    const expired = Boolean(record.gecerlilikBitis && record.gecerlilikBitis.getTime() <= now);
    const isCurrent = record.aktif && !expired;
    let pin = null;
    if (isCurrent) {
      try {
        pin = decryptPin(record.pinSifreli);
      } catch (error) {
        pin = null;
      }
    }
    const usage = usageByPinId.get(record.kapiSifreId.toString()) || null;
    return {
      kapiSifreId: record.kapiSifreId.toString(),
      pin,
      gizli: !pin,
      kaynak: record.kaynak,
      aktif: isCurrent,
      durum: isCurrent ? 'Güncel' : (expired ? 'Süresi doldu' : 'Geçmiş'),
      olusturulma: record.olusturulma,
      gecerlilikBitis: record.gecerlilikBitis,
      kullanim: {
        toplamDeneme: usage?.toplamDeneme || 0,
        basariliKullanim: usage?.basariliKullanim || 0,
        sonKullanim: usage?.sonKullanim || null,
        sonKapi: usage?.sonKapi || null,
        sonSonuc: usage?.sonSonuc || null
      }
    };
  });
}

module.exports = {
  encryptPin,
  decryptPin,
  recordPinHistory,
  listPinHistory
};
