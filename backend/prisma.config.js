// Docker içinde DATABASE_URL, docker-compose.yml tarafından environment
// olarak zaten enjekte ediliyor (örn. postgresql://...@db:5432/...).
// Container dışında (yerelde) çalıştırılırsa .env dosyasından okunur.
require('dotenv').config();

module.exports = {
  datasource: {
    // Önce gerçek ortam değişkenini kullan; hiç tanımlı değilse (örn. .env
    // hiç yoksa) yerel geliştirme için bir fallback bırakıldı.
    url:
      process.env.DATABASE_URL ||
      "postgresql://kapi_user:kapi_sifre@localhost:5432/kapi_db?schema=public",
  },
  migrations: {
    // Prisma 7'de "npx prisma db seed" komutu artık package.json'daki
    // "prisma.seed" alanını değil, buradaki migrations.seed alanını okuyor.
    seed: "node prisma/seed.js",
  },
};