const prisma = require('../config/prisma');

async function getIceridekiKullanicilar() {
  try {
    const kullanicilar = await prisma.kullanici.findMany({
      where: { durum: 'aktif' },
      select: {
        kullaniciId: true,
        ad: true,
        soyad: true,
        eposta: true,
        birim: { select: { ad: true } }
      }
    });

    const iceridekiler = [];

    for (const kullanici of kullanicilar) {
      // Kullanıcının en son başarılı geçiş hareketini bul
      const sonKayit = await prisma.erisimKaydi.findFirst({
        where: { 
          kullaniciId: kullanici.kullaniciId,
          sonuc: 'izin' 
        },
        orderBy: { olayTamani: 'desc' },
        take: 1
      });

      // Eğer en son hareketi 'giris' ise şu an içeride demektir
      if (sonKayit && sonKayit.yon === 'giris') {
        iceridekiler.push({
          kullaniciId: kullanici.kullaniciId.toString(),
          ad: kullanici.ad,
          soyad: kullanici.soyad,
          birim: kullanici.birim?.ad || 'Bilinmiyor',
          sonGirisZamani: sonKayit.olayTamani
        });
      }
    }

    return {
      toplamIceridekiSayisi: iceridekiler.length,
      kullanicilar: iceridekiler
    };

  } catch (error) {
    console.error('❌ İçerideki kullanıcılar hesaplanırken hata:', error);
    throw error;
  }
}

module.exports = { getIceridekiKullanicilar };