const prisma = require('../src/config/prisma');

const SOURCE_URL = 'https://bm.subu.edu.tr/tr/akademik-kadro';

const academicStaff = [
  { ad: 'Halit', soyad: 'Öztekin', eposta: 'halitoztekin@subu.edu.tr' },
  { ad: 'Caner', soyad: 'Erden', eposta: 'cerden@subu.edu.tr' },
  { ad: 'Ekin', soyad: 'Ekinci', eposta: 'ekinekinci@subu.edu.tr' },
  { ad: 'Selman', soyad: 'Hızal', eposta: 'selmanhizal@subu.edu.tr' },
  { ad: 'Süleyman', soyad: 'Uzun', eposta: 'suleymanuzun@subu.edu.tr' },
  { ad: 'Zafer', soyad: 'Albayrak', eposta: 'zaferalbayrak@subu.edu.tr' },
  { ad: 'Zeynep', soyad: 'Garip', eposta: 'zbatik@subu.edu.tr' },
  { ad: 'Ahmet', soyad: 'Kala', eposta: 'ahmetkala@subu.edu.tr' },
  { ad: 'Emin', soyad: 'Güney', eposta: 'eminguney@subu.edu.tr' },
  { ad: 'Fatih', soyad: 'Varçın', eposta: 'fatihvarcin@subu.edu.tr' },
  { ad: 'Muhammed Ali Nur', soyad: 'Öz', eposta: 'muhammedoz@subu.edu.tr' },
  { ad: 'Muhammed', soyad: 'Telçeken', eposta: 'muhammedtelceken@subu.edu.tr' },
  { ad: 'A.F.M. Suaib', soyad: 'Akhter', eposta: 'suaibakhter@subu.edu.tr' },
  { ad: 'Muhammed Yusuf', soyad: 'Küçükkara', eposta: 'muhammedkucukkara@subu.edu.tr' },
  { ad: 'Furkan', soyad: 'Atban', eposta: 'furkanatban@subu.edu.tr' },
  { ad: 'Semih', soyad: 'Özenç', eposta: 'semihozenc@subu.edu.tr' },
  { ad: 'Yavuz Selim', soyad: 'Bozan', eposta: 'ysbozan@subu.edu.tr' },
  { ad: 'Muhammed Bilâl', soyad: 'Kamburoğlu', eposta: 'mbk@subu.edu.tr' }
];

function userNeedsUpdate(user, staffMember, birimId) {
  return user.ad !== staffMember.ad
    || user.soyad !== staffMember.soyad
    || user.eposta !== staffMember.eposta
    || user.rol !== 'hoca'
    || user.durum !== 'aktif'
    || user.birimId !== birimId;
}

async function importAcademicStaff() {
  const birim = await prisma.birim.upsert({
    where: { kod: 'CENG' },
    update: { ad: 'Bilgisayar Mühendisliği', aktif: true },
    create: { kod: 'CENG', ad: 'Bilgisayar Mühendisliği', aktif: true }
  });

  const result = { created: 0, updated: 0, unchanged: 0 };

  await prisma.$transaction(async (transaction) => {
    for (const staffMember of academicStaff) {
      const existing = await transaction.kullanici.findFirst({
        where: {
          OR: [
            {
              eposta: {
                equals: staffMember.eposta,
                mode: 'insensitive'
              }
            },
            {
              AND: [
                { ad: { equals: staffMember.ad, mode: 'insensitive' } },
                { soyad: { equals: staffMember.soyad, mode: 'insensitive' } }
              ]
            }
          ]
        }
      });

      if (!existing) {
        await transaction.kullanici.create({
          data: {
            ...staffMember,
            birimId: birim.birimId,
            durum: 'aktif',
            rol: 'hoca'
          }
        });
        result.created += 1;
        continue;
      }

      if (!userNeedsUpdate(existing, staffMember, birim.birimId)) {
        result.unchanged += 1;
        continue;
      }

      await transaction.kullanici.update({
        where: { kullaniciId: existing.kullaniciId },
        data: {
          ...staffMember,
          birimId: birim.birimId,
          durum: 'aktif',
          rol: 'hoca'
        }
      });
      result.updated += 1;
    }
  });

  console.log(`Kaynak: ${SOURCE_URL}`);
  console.log(`Toplam: ${academicStaff.length}`);
  console.log(`Eklenen: ${result.created}`);
  console.log(`Güncellenen: ${result.updated}`);
  console.log(`Değişmeyen: ${result.unchanged}`);
}

importAcademicStaff()
  .catch((error) => {
    console.error('Akademik personel içe aktarılamadı:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
