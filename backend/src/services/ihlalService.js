// backend/src/services/ihlalService.js
//
// Günlük otomatik ihlal tespiti.
//
// Şu an tespit edilen tek ihlal türü: iptal edilmiş veya kayıp bildirilmiş
// bir kartla erişim denemesi. Bunu tercih ettik çünkü mevcut şema
// (ErisimKaydi) bunun için yeterli veriyi zaten tutuyor:
//   - ErisimKaydi.sonuc === 'red'  -> erişim reddedilmiş
//   - Kart.durum === 'iptal' | 'kayip' -> kart geçersiz
//
// "Çıkış kaçırma" gibi giriş/çıkış yönüne dayalı ihlal türleri şu anki
// şemada desteklenmiyor (ErisimKaydi'de giriş/çıkış yönünü belirten bir
// alan yok), bu yüzden buraya eklenmedi. Eklenmek istenirse önce şemaya
// bir "yon" alanı ekleyen migration yazılmalı.

const prisma = require('../config/prisma');

const IPTAL_KART_IHLAL_TURU = 'kart_kayip';

/**
 * Günlük otomatik ihlal kontrolü.
 * İptal/kayıp durumundaki bir kartla yapılan ve reddedilen erişim
 * denemelerini bulur, her biri için (daha önce kaydedilmemişse) bir
 * IhlalKaydi oluşturur.
 */
async function ihlalKontroluCalistir() {
  const suphedeliErisimler = await prisma.erisimKaydi.findMany({
    where: {
      sonuc: 'red',
      kart: {
        durum: { in: ['iptal', 'kayip'] },
      },
    },
    include: {
      kart: true,
    },
  });

  let olusturulanIhlalSayisi = 0;

  for (const erisim of suphedeliErisimler) {
    // İhlal kaydı bir kullanıcıya bağlanmak zorunda (şema: kullaniciId zorunlu).
    // Kullanıcısı bilinmeyen (örn. tanımsız kart) denemeler burada atlanır.
    if (!erisim.kullaniciId) continue;

    // Aynı olay için tekrar ihlal kaydı açmamak adına, cihaz olay ID'sini
    // açıklama alanında arıyoruz (ihlalKaydı ile erisimKaydı arasında
    // doğrudan bir ilişki alanı şemada yok).
    const zatenKayitliMi = await prisma.ihlalKaydi.findFirst({
      where: {
        kullaniciId: erisim.kullaniciId,
        aciklama: { contains: erisim.cihazOlayId },
      },
    });
    if (zatenKayitliMi) continue;

    const kartUid = erisim.kart?.kartUid ?? erisim.okunanUid ?? 'bilinmiyor';
    const kartDurumu = erisim.kart?.durum ?? 'bilinmiyor';

    await prisma.ihlalKaydi.create({
      data: {
        kullaniciId: erisim.kullaniciId,
        tarih: erisim.olayTamani,
        tur: IPTAL_KART_IHLAL_TURU,
        aciklama: `Durumu '${kartDurumu}' olan kart (${kartUid}) ile erişim denemesi reddedildi. Cihaz olay ID: ${erisim.cihazOlayId}`,
      },
    });

    olusturulanIhlalSayisi++;
  }

  console.log(`[ihlalService] Kontrol tamamlandı. ${olusturulanIhlalSayisi} yeni ihlal kaydı oluşturuldu.`);

  return { calisti: true, olusturulanIhlalSayisi };
}

module.exports = { ihlalKontroluCalistir };
