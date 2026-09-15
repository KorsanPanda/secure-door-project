const cron = require('node-cron');
const { refreshAllUsersPins } = require('../services/pinService');

function initSifreCron() {
  const timezone = process.env.APP_TIMEZONE || 'Europe/Istanbul';
  // Her gece saat 00:00'da çalışır
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Günlük otomatik şifre yenileme başlatılıyor...');
    try {
      await refreshAllUsersPins();
      console.log('[CRON] Günlük şifreler yenilendi ve cihaza iletildi.');
    } catch (error) {
      console.error('[CRON] Şifre yenileme hatası:', error.message);
    }
  }, { timezone });

  console.log(`⏰ Otomatik şifre yenileme cron job'u aktifleştirildi (00:00, ${timezone}).`);
}

module.exports = { initSifreCron };
