#include "RtcManager.h"
#include "config.h"

RtcManager::RtcManager(uint8_t sdaPin, uint8_t sclPin)
    : _sdaPin(sdaPin), _sclPin(sclPin), _available(false) {}

bool RtcManager::begin() {
    // LCD gibi diger I2C modulleri de ayni pinlerle Wire.begin() cagirir;
    // ayni parametrelerle tekrar cagirmak ESP32'de sorun cikarmaz.
    Wire.begin(_sdaPin, _sclPin);

    if (!_rtc.begin(&Wire)) {
        Serial.println(
            "[RTC] DS3231 bulunamadi. VCC, GND, SDA21 ve SCL17 "
            "baglantilarini kontrol edin. RTC olmadan da sistem calismaya "
            "devam eder, sadece WiFi/NTP koptugunda zaman damgalari "
            "guncel kalmaz."
        );
        _available = false;
        return false;
    }

    _available = true;

    if (_rtc.lostPower()) {
        Serial.println(
            "[RTC] Pil bitmis veya modul ilk kez kuruluyor; saat gecersiz. "
            "Ilk basarili NTP senkronunda otomatik olarak duzeltilecek."
        );
    } else {
        Serial.println("[RTC] DS3231 bulundu ve zamani okunabiliyor.");
        printTime();
    }

    return true;
}

bool RtcManager::isAvailable() const {
    return _available;
}

void RtcManager::syncFromEpoch(time_t epochSeconds) {
    if (!_available || epochSeconds <= 0) return;

    _rtc.adjust(DateTime((uint32_t)epochSeconds));
    Serial.println("[RTC] NTP'den gelen zamanla RTC guncellendi.");
}

time_t RtcManager::getEpoch() {
    if (!_available) return 0;

    return (time_t)_rtc.now().unixtime();
}

bool RtcManager::lostPower() {
    if (!_available) return true;
    return _rtc.lostPower();
}

void RtcManager::printTime() {
    if (!_available) return;

    // RTC UTC tutar; terminalde Turkiye yerel saati gosterilir.
    DateTime now = _rtc.now() + TimeSpan(ZAMAN_DILIMI_DK * 60);
    Serial.printf(
        "[RTC] Mevcut yerel zaman: %04d-%02d-%02d %02d:%02d:%02d\n",
        now.year(), now.month(), now.day(),
        now.hour(), now.minute(), now.second()
    );
}
