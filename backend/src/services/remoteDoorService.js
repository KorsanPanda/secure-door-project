const prisma = require('../config/prisma');
const mqttService = require('./mqttService');

/**
 * Yönetici panelinden atılan uzaktan kapı açma isteğini işler, DB'ye loglar ve MQTT ile ESP32'ye sinyal gönderir.
 * @param {number|string} kapiId - Açılmak istenen kapının ID'si
 * @param {number|string} adminId - İstek atan yöneticinin ID'si (opsiyonel)
 * @param {string} reason - Kapının neden açıldığına dair açıklama
 */
async function triggerRemoteDoorOpen(kapiId, adminId = null, reason = "Yönetici Panelinden Uzaktan Açıldı") {
  try {
    const kapiIdNum = Number(kapiId);
    console.log(`[UZAKTAN AÇMA İSTEĞİ] Kapı ID: ${kapiIdNum}, Admin ID: ${adminId}, Sebep: ${reason}`);

    // 1. Kapıya bağlı aktif cihazı (ESP32) bul
    const atama = await prisma.cihazKapiAtama.findFirst({
      where: { kapiId: kapiIdNum, bitis: null }
    });

    if (!atama) {
      return {
        success: false,
        message: "Bu kapıya bağlı aktif bir ESP32 cihazı bulunamadı!"
      };
    }

    // 2. MQTT üzerinden ESP32'ye kapi-ac komutunu gönder
    const commandSent = mqttService.publishCommand(atama.cihazId, 'kapi-ac', {
      command: 'UNLOCK_DOOR',
      adminId,
      reason,
      timestamp: new Date().toISOString()
    });

    if (!commandSent) {
      return {
        success: false,
        message: "MQTT broker bağlantısı olmadığı için komut cihaza iletilemedi."
      };
    }

    // 3. Veritabanındaki 'olay' tablosuna log kaydı at
    const yeniOlay = await prisma.olay.create({
      data: {
        tur: 'uzaktan_kapi_acma',
        kaynak: 'kullanici',
        kapiId: kapiIdNum,
        cihazId: atama.cihazId,
        kullaniciId: adminId ? BigInt(adminId) : null,
        detay: {
          command: 'UNLOCK_DOOR',
          reason,
          status: 'SUCCESS'
        }
      }
    });

    return {
      success: true,
      message: "Uzaktan kapı açma emri kapıya başarıyla iletildi.",
      olayId: yeniOlay.olayId.toString(),
      triggeredAt: new Date()
    };

  } catch (error) {
    console.error(`[UZAKTAN AÇMA HATA]`, error.message);
    return {
      success: false,
      message: "Sistemsel bir hata nedeniyle komut gönderilemedi.",
      error: error.message
    };
  }
}

module.exports = {
  triggerRemoteDoorOpen
};