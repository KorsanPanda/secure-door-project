#include "OfflineQueue.h"

const char* OfflineQueue::DOSYA_YOLU = "/olaylar.bin";
bool OfflineQueue::baslatildi = false;
File OfflineQueue::okumaDosyasi;

bool OfflineQueue::baslat() {
    if (!LittleFS.begin(true)) {
        Serial.println("[OfflineQueue] LittleFS baslatilamadi!");
        return false;
    }
    baslatildi = true;
    File kuyrukDosyasi = LittleFS.open(DOSYA_YOLU, FILE_APPEND);
    if (!kuyrukDosyasi) {
        Serial.println("[OfflineQueue] Kuyruk dosyasi olusturulamadi.");
        baslatildi = false;
        return false;
    }
    kuyrukDosyasi.close();

    File mevcutDosya = LittleFS.open(DOSYA_YOLU, FILE_READ);
    const size_t dosyaBoyutu = mevcutDosya.size();
    mevcutDosya.close();
    if (dosyaBoyutu % sizeof(CevrimdisiOlay) != 0) {
        File temizDosya = LittleFS.open(DOSYA_YOLU, FILE_WRITE);
        temizDosya.close();
        Serial.println("[OfflineQueue] Eski kuyruk formati temizlendi.");
    }
    Serial.println("[OfflineQueue] LittleFS hazir.");
    return true;
}

bool OfflineQueue::olayEkle(const char* veri, const char* yontem, bool basarili, unsigned long zamanDamgasi) {
    if (!baslatildi) return false;

    if (bekleyenOlaySayisi() >= MAKS_KUYRUK_BOYUTU) {
        Serial.println("[OfflineQueue-WARN] Kuyruk dolu! Log reddedildi.");
        return false; 
    }

    File dosya = LittleFS.open(DOSYA_YOLU, FILE_APPEND);
    if (!dosya) return false;

    CevrimdisiOlay olay;
    strncpy(olay.veri, veri, sizeof(olay.veri) - 1);
    olay.veri[sizeof(olay.veri) - 1] = '\0';
    
    strncpy(olay.yontem, yontem, sizeof(olay.yontem) - 1);
    olay.yontem[sizeof(olay.yontem) - 1] = '\0';
    
    olay.basarili = basarili;
    olay.zamanDamgasi = zamanDamgasi;

    size_t yazilan = dosya.write(reinterpret_cast<uint8_t*>(&olay), sizeof(CevrimdisiOlay));
    dosya.close();

    Serial.printf("[OfflineQueue] Yeni cevirimdisi olay kaydedildi: %s\n", veri);
    return yazilan == sizeof(CevrimdisiOlay);
}

bool OfflineQueue::okumayiBaslat() {
    if (!baslatildi) return false;
    if (!LittleFS.exists(DOSYA_YOLU)) return false;
    okumaDosyasi = LittleFS.open(DOSYA_YOLU, FILE_READ);
    return okumaDosyasi;
}

bool OfflineQueue::siradakiOlayiOku(CevrimdisiOlay& olay) {
    if (!okumaDosyasi) return false;
    size_t okunan = okumaDosyasi.read(reinterpret_cast<uint8_t*>(&olay), sizeof(CevrimdisiOlay));
    return okunan == sizeof(CevrimdisiOlay);
}

void OfflineQueue::okumayiBitir() {
    if (okumaDosyasi) {
        okumaDosyasi.close();
    }
}

// HATA 4 ÇÖZÜMÜ: Başarıyla gönderilen ilk log kaydını siler
bool OfflineQueue::ilkOlayiSil() {
    if (!baslatildi) return false;
    
    File dosya = LittleFS.open(DOSYA_YOLU, FILE_READ);
    if (!dosya) return false;

    size_t toplamBoyut = dosya.size();
    size_t kayitBoyutu = sizeof(CevrimdisiOlay);

    if (toplamBoyut <= kayitBoyutu) {
        dosya.close();
        File temizDosya = LittleFS.open(DOSYA_YOLU, FILE_WRITE);
        temizDosya.close();
        return true;
    }

    // İlk kayıt dışındaki kalan kayıtları temp dosyasına aktar
    dosya.seek(kayitBoyutu); 
    File tempDosya = LittleFS.open("/temp.bin", FILE_WRITE);
    
    uint8_t buffer[64];
    while (dosya.available()) {
        size_t l = dosya.read(buffer, sizeof(buffer));
        tempDosya.write(buffer, l);
    }
    
    dosya.close();
    tempDosya.close();

    LittleFS.remove(DOSYA_YOLU);
    LittleFS.rename("/temp.bin", DOSYA_YOLU);
    return true;
}

int OfflineQueue::bekleyenOlaySayisi() {
    if (!baslatildi) return 0;
    if (!LittleFS.exists(DOSYA_YOLU)) return 0;
    File dosya = LittleFS.open(DOSYA_YOLU, FILE_READ);
    if (!dosya) return 0;
    size_t boyut = dosya.size();
    dosya.close();
    return boyut / sizeof(CevrimdisiOlay);
}

void OfflineQueue::kuyruguTemizle() {
    if (baslatildi) {
        File temizDosya = LittleFS.open(DOSYA_YOLU, FILE_WRITE);
        temizDosya.close();
        Serial.println("[OfflineQueue] Yerel kuyruk temizlendi.");
    }
}
