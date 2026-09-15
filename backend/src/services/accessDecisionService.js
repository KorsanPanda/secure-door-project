const argon2 = require('argon2');
const prisma = require('../config/prisma');
const cardApprovalService = require('./cardApprovalService');

function ruleMatchesNow(rule, now = new Date()) {
  const jsDay = now.getDay();
  const dayMask = jsDay === 0 ? 64 : 2 ** (jsDay - 1);
  if ((rule.gunMaskesi & dayMask) === 0) return false;

  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (rule.saatBaslangic <= rule.saatBitis) {
    return currentTime >= rule.saatBaslangic && currentTime <= rule.saatBitis;
  }

  return currentTime >= rule.saatBaslangic || currentTime <= rule.saatBitis;
}

async function resolveDoor(cihazId, requestedDoorId = null) {
  const atama = await prisma.cihazKapiAtama.findFirst({
    where: {
      cihazId,
      bitis: null,
      ...(requestedDoorId ? { kapiId: requestedDoorId } : {})
    },
    include: { kapi: true }
  });

  return atama?.kapi || null;
}

async function userCanAccessDoor(kullaniciId, kapiId) {
  const doorRules = await prisma.yetkiKurali.findMany({
    where: { kapiId, aktif: true },
    select: {
      kullaniciId: true,
      grupId: true,
      gunMaskesi: true,
      saatBaslangic: true,
      saatBitis: true
    }
  });

  if (doorRules.length === 0) return true;

  const groupIds = doorRules
    .map((rule) => rule.grupId)
    .filter((groupId) => groupId !== null);
  const memberships = groupIds.length
    ? await prisma.kullaniciGrup.findMany({
        where: { kullaniciId, grupId: { in: groupIds } },
        select: { grupId: true }
      })
    : [];
  const userGroupIds = new Set(memberships.map((membership) => membership.grupId));

  return doorRules.some((rule) => (
    (
      rule.kullaniciId === kullaniciId
      || (rule.grupId !== null && userGroupIds.has(rule.grupId))
    )
    && ruleMatchesNow(rule)
  ));
}

async function verifyCard({ cihazId, kapiId, kartUid }) {
  const normalizedUid = String(kartUid || '').trim().toUpperCase();
  const card = normalizedUid
    ? await prisma.kart.findUnique({
        where: { kartUid: normalizedUid },
        include: {
          kartYetkilendirmeler: {
            where: { durum: 'aktif' },
            include: { kullanici: true },
            take: 1
          }
        }
      })
    : null;

  // Kapı/cihaz atamasında bir yapılandırma sorunu olsa bile bilinmeyen kartı
  // onay kuyruğuna al. Önceki akış kapıyı daha önce kontrol ettiği için burada
  // erken dönüyor ve okutulan kart web panelinde hiç görünmüyordu.
  const isRejectedRequest = card?.durum === 'iptal'
    && card?.iptalNedeni === 'Yetkilendirme isteği reddedildi';
  if (normalizedUid && (!card || isRejectedRequest)) {
    await cardApprovalService.handleUnknownCardScan(normalizedUid);
  }

  const kapi = await resolveDoor(cihazId, kapiId);
  if (!kapi || kapi.durum !== 'aktif') {
    return {
      allowed: false,
      reason: 'aktif_kapi_bulunamadi',
      userId: null,
      card,
      door: kapi
    };
  }

  const authorization = card?.kartYetkilendirmeler?.[0] || null;
  const identityAllowed = Boolean(
    card?.durum === 'aktif'
    && authorization?.kullanici?.durum === 'aktif'
  );
  const doorAllowed = identityAllowed
    ? await userCanAccessDoor(authorization.kullaniciId, kapi.kapiId)
    : false;
  const allowed = identityAllowed && doorAllowed;

  let reason = null;
  if (!allowed) {
    if (!card) reason = 'tanimsiz_kart';
    else if (card.durum !== 'aktif') reason = 'kart_aktif_degil';
    else if (!authorization) reason = 'yetkilendirilmemis';
    else if (authorization.kullanici.durum !== 'aktif') reason = 'kullanici_aktif_degil';
    else reason = 'kapi_yetkisi_yok';
  }

  return {
    allowed,
    reason,
    userId: authorization?.kullaniciId || null,
    card,
    door: kapi
  };
}

async function verifyPin({ cihazId, kapiId, pin }) {
  const normalizedPin = String(pin || '').trim();
  const kapi = await resolveDoor(cihazId, kapiId);

  if (!kapi || kapi.durum !== 'aktif') {
    return {
      allowed: false,
      reason: 'aktif_kapi_bulunamadi',
      userId: null,
      card: null,
      door: kapi
    };
  }

  if (!/^\d{4,16}$/.test(normalizedPin)) {
    return {
      allowed: false,
      reason: 'gecersiz_pin',
      userId: null,
      card: null,
      door: kapi
    };
  }

  const users = await prisma.kullanici.findMany({
    where: {
      durum: 'aktif',
      pinHash: { not: null },
      OR: [
        { pinGecerlilikBitis: null },
        { pinGecerlilikBitis: { gt: new Date() } }
      ]
    },
    select: { kullaniciId: true, pinHash: true }
  });

  let matchedUser = null;
  for (const user of users) {
    try {
      if (await argon2.verify(user.pinHash, normalizedPin)) {
        matchedUser = user;
        break;
      }
    } catch (error) {
      console.warn(`[MQTT] Kullanıcı ${user.kullaniciId} için geçersiz PIN hash kaydı atlandı.`);
    }
  }

  const doorAllowed = matchedUser
    ? await userCanAccessDoor(matchedUser.kullaniciId, kapi.kapiId)
    : false;
  const allowed = Boolean(matchedUser && doorAllowed);

  // Girilen PIN, kullanıcının o an aktif olan kapi_sifre_gecmisi kaydıyla eşleşir
  // (ikisi de aynı transaction'da birlikte güncellenir). Erişim kaydına bu PIN'in
  // hangi geçmiş kaydına ait olduğunu yazabilmek için burada buluyoruz.
  let kapiSifreId = null;
  if (matchedUser) {
    const activePinRecord = await prisma.kapiSifreGecmisi.findFirst({
      where: { kullaniciId: matchedUser.kullaniciId, aktif: true },
      orderBy: { olusturulma: 'desc' },
      select: { kapiSifreId: true }
    });
    kapiSifreId = activePinRecord?.kapiSifreId || null;
  }

  return {
    allowed,
    reason: allowed ? null : matchedUser ? 'kapi_yetkisi_yok' : 'gecersiz_pin',
    userId: matchedUser?.kullaniciId || null,
    card: null,
    door: kapi,
    kapiSifreId
  };
}

module.exports = {
  resolveDoor,
  userCanAccessDoor,
  verifyCard,
  verifyPin
};
