const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'securelab-development-only-secret';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({ message: 'Oturum açmanız gerekiyor.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = BigInt(decoded.kullaniciId || 0);
    const user = await prisma.kullanici.findUnique({
      where: { kullaniciId: userId },
      select: {
        kullaniciId: true,
        eposta: true,
        rol: true,
        durum: true,
        oturumSurumu: true
      }
    });

    if (!user || user.durum !== 'aktif') {
      return res.status(401).json({ message: 'Aktif kullanıcı oturumu bulunamadı.' });
    }
    if (Number(decoded.oturumSurumu) !== user.oturumSurumu) {
      return res.status(401).json({ message: 'Oturumunuz güvenlik nedeniyle sonlandırıldı. Lütfen yeniden giriş yapın.' });
    }

    req.authenticatedUser = user;
    req.user = {
      ...decoded,
      kullaniciId: user.kullaniciId.toString(),
      eposta: user.eposta,
      rol: user.rol,
      oturumSurumu: user.oturumSurumu
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Oturum geçersiz veya süresi dolmuş.' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.authenticatedUser?.rol === 'admin') return next();
  return res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekiyor.' });
};

const requireAdminOrHoca = (req, res, next) => {
  if (req.authenticatedUser && ['admin', 'hoca'].includes(req.authenticatedUser.rol)) return next();
  return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
};

const requireSelfOrAdmin = (req, res, next) => {
  const requestedUserId = String(req.params.id || req.params.kullaniciId || '');
  const authenticatedUserId = String(req.user?.kullaniciId || '');
  if (req.authenticatedUser?.rol === 'admin'
    || (authenticatedUserId && authenticatedUserId === requestedUserId)) {
    return next();
  }
  return res.status(403).json({ message: 'Yalnızca kendi hesabınız üzerinde işlem yapabilirsiniz.' });
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireAdminOrHoca,
  requireSelfOrAdmin,
  JWT_SECRET
};
