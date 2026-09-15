#include "DoorState.h"

#ifdef ARDUINO
Durum DoorState::mevcutDurum = Durum::BEKLEMEDE;
unsigned long DoorState::durumDegisimZamani = 0;

const unsigned long DoorState::DURUM_SURELERI[] = {
    0,      // BEKLEMEDE
    7000,   // OKUNUYOR (MQTT cevabi icin zaman tanir)
    5000,   // ONAYLANDI (GİRİŞ)
    2000,   // REDDEDILDI
    0       // ALARM
};

void DoorState::baslat() {
    mevcutDurum = Durum::BEKLEMEDE;
    durumDegisimZamani = millis();
    Serial.println("[DoorState] Sistem baslatildi: BEKLEMEDE");
}

bool DoorState::durumGecisiYap(Durum yeniDurum) {
    bool izinVerildi = gecisIzinliMi(mevcutDurum, yeniDurum);

    if (izinVerildi) {
        mevcutDurum = yeniDurum;
        durumDegisimZamani = millis();
        Serial.printf("[DoorState] Durum Degisti -> %s\n", durumMetni(mevcutDurum));

        return true;
    }
    return false;
}

void DoorState::guncelle() {
    unsigned long zamanSiniri = DURUM_SURELERI[static_cast<int>(mevcutDurum)];

    if (zamanSiniri > 0 && (millis() - durumDegisimZamani >= zamanSiniri)) {
        if (mevcutDurum == Durum::OKUNUYOR || mevcutDurum == Durum::REDDEDILDI ||
            mevcutDurum == Durum::ONAYLANDI) {
            durumGecisiYap(Durum::BEKLEMEDE);
        }
    }
}

Durum DoorState::mevcutDurumuAl() {
    return mevcutDurum;
}
#endif

const char* DoorState::durumMetni(Durum durum) {
    switch (durum) {
        case Durum::BEKLEMEDE:     return "BEKLEMEDE";
        case Durum::OKUNUYOR:      return "OKUNUYOR";
        case Durum::ONAYLANDI:     return "ONAYLANDI";
        case Durum::REDDEDILDI:    return "REDDEDILDI";
        case Durum::ALARM:         return "ALARM";
        default:                   return "BILINMEYEN";
    }
}

// Donanımdan bağımsız saf mantık: hangi durumdan hangi duruma geçiş yapılabilir
bool DoorState::gecisIzinliMi(Durum mevcutDurum, Durum yeniDurum) {
    switch (mevcutDurum) {
        case Durum::BEKLEMEDE:
            return true;
        case Durum::OKUNUYOR:
            return (yeniDurum != Durum::OKUNUYOR);
        case Durum::ONAYLANDI:
        case Durum::REDDEDILDI:
        case Durum::ALARM:
            return (yeniDurum == Durum::BEKLEMEDE);
    }
    return false;
}
