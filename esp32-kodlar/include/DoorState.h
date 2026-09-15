#ifndef DOOR_STATE_H
#define DOOR_STATE_H

#ifdef ARDUINO
#include <Arduino.h>
#endif

enum class Durum {
    BEKLEMEDE,      // Kart/Şifre bekleniyor, kapı kilitli
    OKUNUYOR,       // Veri alındı, doğrulama bekleniyor
    ONAYLANDI,      // GİRİŞ İZNİ verildi, kilit açık
    REDDEDILDI,     // Geçiş/İşlem izni yok
    ALARM           // Zorla açılma veya uzun süre açık kalma
};

class DoorState {
private:
#ifdef ARDUINO
    static Durum mevcutDurum;
    static unsigned long durumDegisimZamani;
    static const unsigned long DURUM_SURELERI[];
#endif

public:
#ifdef ARDUINO
    static void baslat();
    static void guncelle();
    static bool durumGecisiYap(Durum yeniDurum);
    static Durum mevcutDurumuAl();
#endif

    static const char* durumMetni(Durum durum);

    // Donanımdan bağımsız, native test edilebilir saf mantık:
    // mevcutDurum'dan yeniDurum'a geçişe izin var mı?
    static bool gecisIzinliMi(Durum mevcutDurum, Durum yeniDurum);
};

#endif