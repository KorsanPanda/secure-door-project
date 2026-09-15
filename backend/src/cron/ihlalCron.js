const cron = require('node-cron');
const { ihlalKontroluCalistir } = require('../services/ihlalService'); // Fonksiyonun olduğu servis dosyası

function initIhlalCron() {
  const timezone = process.env.APP_TIMEZONE || 'Europe/Istanbul';
  // Her gün gece 23:59'da çalışır
  cron.schedule('59 23 * * *', async () => {
    console.log('[CRON] Gün sonu otomatik ihlal tespiti başlatılıyor...');
    try {
      await ihlalKontroluCalistir();
      console.log('[CRON] İhlal tespiti tamamlandı.');
    } catch (error) {
      console.error('[CRON] İhlal tespiti hatası:', error.message);
    }
  }, { timezone });

  console.log(`Otomatik ihlal tespiti cron job'u aktifleştirildi (23:59, ${timezone}).`);
}

module.exports = { initIhlalCron };
