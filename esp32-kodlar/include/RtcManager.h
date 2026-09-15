#pragma once

#include <Arduino.h>
#include <RTClib.h>
#include <Wire.h>
#include <time.h>

// DS3231 pilli RTC modulu icin yonetici sinif.
//
// NOT (DS1307 kullaniyorsaniz): RtcManager.cpp icindeki `RTC_DS3231 _rtc;`
// satirini `RTC_DS1307 _rtc;` yapin ve lostPower()/begin() cagrilari ayni
// sekilde calisir (RTClib her iki cip icin de ayni arayuzu sunar). DS1307
// sicaklik kompanzasyonu yapmadigi icin biraz daha az hassastir, baska bir
// fark yoktur.
//
// Amac: WiFi/NTP koptugunda veya cihaz NTP'ye hic ulasamadan calismaya
// basladiginda, olay zaman damgalarinin (timestampEpoch) hala dogru
// olmasini saglamak. NTP basariyla senkron oldugunda RTC de guncellenir,
// boylece pil bittiginde bile en son bilinen zaman korunur.
class RtcManager {
public:
    RtcManager(uint8_t sdaPin, uint8_t sclPin);

    // I2C hattini (gerekirse) baslatir ve RTC cipini arar.
    bool begin();

    // RTC I2C uzerinden basariyla bulunup okunabiliyor mu?
    bool isAvailable() const;

    // NTP'den gelen (projede kullanilan "yerel epoch" konvansiyonuyla ayni)
    // zamanla RTC'yi gunceller. NetworkManager basariyla senkron olduktan
    // sonra main.cpp tarafindan bir kez cagrilmasi yeterlidir.
    void syncFromEpoch(time_t epochSeconds);

    // RTC'den okunan zamani, projenin geri kalaninin bekledigi epoch
    // formatinda dondurur. RTC yoksa 0 doner (cagiran taraf kontrol etmeli).
    time_t getEpoch();

    // RTC pilinin daha once tamamen bittigini/hic kurulmadigini bildirir
    // (RTClib'in lostPower() bilgisine dayanir). true ise okunan zaman
    // guvenilir degildir, ilk NTP senkronunu beklemek gerekir.
    bool lostPower();

    void printTime();

private:
    uint8_t _sdaPin;
    uint8_t _sclPin;
    bool _available;
    RTC_DS3231 _rtc;
};
