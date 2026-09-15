const express = require('express');
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');
const prisma = require('../config/prisma');
const { authenticateToken, JWT_SECRET } = require('../middlewares/authMiddleware');
const { validateWebPassword } = require('../services/webPasswordService');
const { createPasswordReset, consumePasswordReset } = require('../services/passwordResetService');
const { isMailConfigured, sendPasswordResetEmail } = require('../services/mailService');
const { writeAudit } = require('../services/auditService');
const { isProduction } = require('../config/security');

const router = express.Router();
const GENERIC_RESET_MESSAGE = 'Hesap bulunursa şifre yenileme bağlantısı gönderilecektir.';

const serializeUser = (user) => ({
  kullaniciId: user.kullaniciId.toString(),
  ad: user.ad,
  soyad: user.soyad,
  eposta: user.eposta,
  birimId: user.birimId,
  rol: user.rol,
  durum: user.durum
});

router.post('/login', async (req, res) => {
  try {
    const normalizedEmail = String(req.body.eposta || '').trim().toLowerCase();
    const password = String(req.body.pin || '');
    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'E-posta ve şifre gereklidir.' });
    }

    const user = await prisma.kullanici.findFirst({
      where: { eposta: { equals: normalizedEmail, mode: 'insensitive' } }
    });
    const credentialHash = user?.sifreHash || user?.pinHash;
    if (!credentialHash || !(await argon2.verify(credentialHash, password))) {
      return res.status(401).json({ message: 'E-posta veya şifre hatalı.' });
    }
    if (user.durum !== 'aktif') {
      return res.status(403).json({ message: 'Kullanıcı hesabı aktif değil.' });
    }

    const token = jwt.sign({
      kullaniciId: user.kullaniciId.toString(),
      eposta: user.eposta,
      rol: user.rol,
      oturumSurumu: user.oturumSurumu
    }, JWT_SECRET, { expiresIn: '8h' });

    return res.json({ message: 'Giriş başarılı.', token, user: serializeUser(user) });
  } catch (error) {
    console.error('Login hatası:', error);
    return res.status(500).json({ message: 'Giriş işlemi tamamlanamadı.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const normalizedEmail = String(req.body.eposta || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ message: 'E-posta adresi gereklidir.' });
  }

  try {
    const user = await prisma.kullanici.findFirst({
      where: { eposta: { equals: normalizedEmail, mode: 'insensitive' } }
    });
    if (!user || user.durum !== 'aktif' || !user.eposta) {
      return res.json({ message: GENERIC_RESET_MESSAGE });
    }

    const { rawToken, expiresAt } = await createPasswordReset(user.kullaniciId, req.ip);
    const inferredFrontend = `${req.protocol}://${req.get('host') || 'localhost:8080'}`
      .replace(/:3000$/, ':8080');
    const resetPage = process.env.PASSWORD_RESET_BASE_URL
      || `${inferredFrontend}/sifre-sifirla.html`;
    const resetUrl = `${resetPage}${resetPage.includes('?') ? '&' : '?'}token=${encodeURIComponent(rawToken)}`;

    if (isMailConfigured()) {
      await sendPasswordResetEmail({
        to: user.eposta,
        name: `${user.ad} ${user.soyad}`.trim(),
        resetUrl,
        expiresAt
      });
    }

    const response = { message: GENERIC_RESET_MESSAGE };
    if (!isProduction() && process.env.ALLOW_DEV_PASSWORD_RESET === 'true') {
      response.resetUrl = resetUrl;
      response.expiresAt = expiresAt.toISOString();
    }
    return res.json(response);
  } catch (error) {
    console.error('Şifre sıfırlama talebi hatası:', error);
    return res.status(500).json({ message: 'Şifre sıfırlama talebi tamamlanamadı.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const newPassword = String(req.body.yeniSifre || '');
    const confirmation = String(req.body.yeniSifreTekrar || '');
    if (!token || !newPassword || !confirmation) {
      return res.status(400).json({ message: 'Yenileme bağlantısı ve yeni şifre alanları gereklidir.' });
    }
    if (newPassword !== confirmation) {
      return res.status(400).json({ message: 'Yeni şifreler eşleşmiyor.' });
    }
    const validation = validateWebPassword(newPassword);
    if (!validation.valid) return res.status(400).json({ message: validation.message });

    await consumePasswordReset(token, await argon2.hash(newPassword));
    return res.json({ message: 'Şifreniz yenilendi. Güvenliğiniz için tüm eski oturumlar kapatıldı.' });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error('Şifre yenileme hatası:', error);
    return res.status(status).json({
      message: status >= 500 ? 'Şifre yenileme işlemi tamamlanamadı.' : error.message
    });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.kullanici.findUnique({
      where: { kullaniciId: req.authenticatedUser.kullaniciId }
    });
    return res.json({ user: serializeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Kullanıcı bilgileri alınamadı.' });
  }
});

router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const currentPassword = String(req.body.mevcutSifre || '');
    const newPassword = String(req.body.yeniSifre || '');
    const confirmation = String(req.body.yeniSifreTekrar || '');
    if (!currentPassword || !newPassword || !confirmation) {
      return res.status(400).json({ message: 'Mevcut şifre, yeni şifre ve şifre tekrarı gereklidir.' });
    }
    if (newPassword !== confirmation) {
      return res.status(400).json({ message: 'Yeni şifreler eşleşmiyor.' });
    }
    const validation = validateWebPassword(newPassword);
    if (!validation.valid) return res.status(400).json({ message: validation.message });

    const user = await prisma.kullanici.findUnique({
      where: { kullaniciId: req.authenticatedUser.kullaniciId }
    });
    const credentialHash = user?.sifreHash || user?.pinHash;
    if (!credentialHash || !(await argon2.verify(credentialHash, currentPassword))) {
      return res.status(401).json({ message: 'Mevcut web şifresi hatalı.' });
    }
    if (await argon2.verify(credentialHash, newPassword)) {
      return res.status(400).json({ message: 'Yeni şifre mevcut şifreyle aynı olamaz.' });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.kullanici.update({
        where: { kullaniciId: user.kullaniciId },
        data: {
          sifreHash: await argon2.hash(newPassword),
          sifreGecerlilikBitis: null,
          oturumSurumu: { increment: 1 }
        }
      });
      await writeAudit({
        client: transaction,
        actorId: user.kullaniciId,
        action: 'guncelle',
        tableName: 'kullanici',
        recordId: user.kullaniciId,
        before: { webSifresi: 'mevcut' },
        after: { webSifresi: 'degistirildi', tumOturumlar: 'kapatildi' }
      });
    });
    return res.json({ message: 'Web şifreniz değiştirildi. Lütfen yeniden giriş yapın.' });
  } catch (error) {
    console.error('Web şifresi değiştirme hatası:', error);
    return res.status(500).json({ message: 'Web şifresi değiştirilemedi.' });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.kullanici.update({
        where: { kullaniciId: req.authenticatedUser.kullaniciId },
        data: { oturumSurumu: { increment: 1 } }
      });
      await writeAudit({
        client: transaction,
        actorId: req.authenticatedUser.kullaniciId,
        action: 'guncelle',
        tableName: 'kullanici',
        recordId: req.authenticatedUser.kullaniciId,
        after: { tumOturumlar: 'kapatildi' }
      });
    });
    return res.json({ message: 'Tüm oturumlar güvenli biçimde kapatıldı.' });
  } catch (error) {
    return res.status(500).json({ message: 'Çıkış işlemi tamamlanamadı.' });
  }
});

module.exports = router;
