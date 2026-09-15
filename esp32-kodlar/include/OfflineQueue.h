#ifndef OFFLINE_QUEUE_H
#define OFFLINE_QUEUE_H

#include <Arduino.h>
#include <FS.h>
#include <LittleFS.h>

struct CevrimdisiOlay {
    char veri[32];
    char yontem[15];     
    unsigned long zamanDamgasi;
    bool basarili;
};

class OfflineQueue {
private:
    static const char* DOSYA_YOLU;
    static bool baslatildi;
    static File okumaDosyasi;
    static const int MAKS_KUYRUK_BOYUTU = 100;

public:
    static bool baslat();
    static bool olayEkle(const char* veri, const char* yontem, bool basarili, unsigned long zamanDamgasi);
    
    static bool okumayiBaslat(); 
    static bool siradakiOlayiOku(CevrimdisiOlay& olay);
    static void okumayiBitir();
    
    // HATA 4 ÇÖZÜMÜ: Sunucuya fırlatılan ilk olayı dosyadan siler
    static bool ilkOlayiSil(); 
    
    static int bekleyenOlaySayisi();
    static void kuyruguTemizle(); 
};

#endif
