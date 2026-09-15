const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET } = require('../middlewares/authMiddleware');

async function getAdminToken() {
  const admin = await prisma.kullanici.findFirst({
    where: { rol: 'admin', durum: 'aktif' }
  });
  if (!admin) throw new Error('Aktif yönetici hesabı bulunamadı.');
  return jwt.sign({
    kullaniciId: admin.kullaniciId.toString(),
    eposta: admin.eposta,
    rol: admin.rol,
    oturumSurumu: admin.oturumSurumu
  }, JWT_SECRET, { expiresIn: '10m' });
}

module.exports = { getAdminToken };
