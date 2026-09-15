#include "NetworkManager.h"

#include <SPI.h>
#include <sys/time.h>

#include "config.h"

namespace {
constexpr uint32_t NTP_UNIX_EPOCH_OFFSET = 2208988800UL;
constexpr uint16_t NTP_SERVER_PORT = 123;
constexpr uint16_t NTP_PACKET_SIZE = 48;
constexpr uint32_t NTP_RESPONSE_TIMEOUT_MS = 2000;
}

NetworkManager::NetworkManager() = default;

void NetworkManager::buildMacAddress() {
    const uint64_t chipId = ESP.getEfuseMac();
    // Yerel yonetilen, unicast MAC. Son 5 bayt ESP32'nin benzersiz eFuse
    // kimliginden gelir; ayni agdaki iki cihaz ayni MAC'i kullanmaz.
    _mac[0] = 0x02;
    for (uint8_t index = 1; index < 6; ++index) {
        _mac[index] = static_cast<byte>(chipId >> (8 * (index - 1)));
    }
}

void NetworkManager::resetW5500() {
    pinMode(ETHERNET_CS_PIN, OUTPUT);
    digitalWrite(ETHERNET_CS_PIN, HIGH);

#if ETHERNET_RST_PIN >= 0
    pinMode(ETHERNET_RST_PIN, OUTPUT);
    digitalWrite(ETHERNET_RST_PIN, LOW);
    delay(50);
    digitalWrite(ETHERNET_RST_PIN, HIGH);
    delay(250);
#else
    // Bu W5500 Lite baglantisinda RST pini kullanilmiyor. Modulu CS ile
    // pasif birakip kartin guc acilis sifirlamasini kullaniyoruz.
    delay(10);
#endif
}

void NetworkManager::configureTimezone() {
    const int offsetMinutes = ZAMAN_DILIMI_DK;
    const char sign = offsetMinutes >= 0 ? '-' : '+'; // POSIX TZ isareti ters
    const int absoluteMinutes = abs(offsetMinutes);
    char timezone[20];
    snprintf(
        timezone,
        sizeof(timezone),
        "UTC%c%02d:%02d",
        sign,
        absoluteMinutes / 60,
        absoluteMinutes % 60
    );
    setenv("TZ", timezone, 1);
    tzset();
}

void NetworkManager::begin() {
    buildMacAddress();
    configureTimezone();
    resetW5500();

    Ethernet.init(ETHERNET_CS_PIN);
    startConnection();
}

void NetworkManager::startConnection() {
#if ETHERNET_RST_PIN >= 0
    Serial.printf(
        "[Ethernet] W5500 DHCP baslatiliyor (CS=GPIO%d, RST=GPIO%d)...\n",
        ETHERNET_CS_PIN,
        ETHERNET_RST_PIN
    );
#else
    Serial.printf(
        "[Ethernet] W5500 DHCP baslatiliyor (CS=GPIO%d, RST/INT=bagli degil)...\n",
        ETHERNET_CS_PIN
    );
#endif

    const int dhcpResult = Ethernet.begin(
        _mac,
        static_cast<unsigned long>(ETHERNET_DHCP_TIMEOUT_MS),
        2000UL
    );
    _lastConnectionAttemptMs = millis();
    _ethernetStarted = true;

    if (Ethernet.hardwareStatus() == EthernetNoHardware) {
        Serial.println("[Ethernet] W5500 bulunamadi; SPI, CS ve beslemeyi kontrol edin.");
        return;
    }

    if (Ethernet.linkStatus() == LinkOFF) {
        Serial.println("[Ethernet] Kablo/link yok. RJ45 kablosunu ve switch portunu kontrol edin.");
        return;
    }

    if (dhcpResult == 0 || !hasValidIp()) {
        Serial.println("[Ethernet] DHCP'den IP alinamadi; agda DHCP servisini kontrol edin.");
        return;
    }

    Serial.print("[Ethernet] IP alindi: ");
    Serial.println(Ethernet.localIP());
    Serial.print("[Ethernet] Ag gecidi: ");
    Serial.println(Ethernet.gatewayIP());
    Serial.print("[Ethernet] DNS: ");
    Serial.println(Ethernet.dnsServerIP());
    _timeSynced = false;
    _lastNtpAttemptMs = 0;
}

bool NetworkManager::hasValidIp() const {
    const IPAddress ip = Ethernet.localIP();
    return ip[0] != 0 || ip[1] != 0 || ip[2] != 0 || ip[3] != 0;
}

bool NetworkManager::isConnected() {
    if (!_ethernetStarted || !hasValidIp()) return false;
    return Ethernet.hardwareStatus() != EthernetNoHardware
        && Ethernet.linkStatus() != LinkOFF;
}

void NetworkManager::update() {
    const uint32_t now = millis();

    // DHCP ilk kez IP veremediyse lease henuz olusmamistir. Bu durumda
    // maintain() her loop turunda RENEW_FAIL dondurur ve seri cikisini
    // doldurur. Yalnizca gecerli bir DHCP lease/IP varken yenileme yap.
    if (_ethernetStarted && isConnected()) {
        const int maintainResult = Ethernet.maintain();
        if (maintainResult == 1 || maintainResult == 3) {
            Serial.println("[Ethernet] DHCP yenileme basarisiz.");
        } else if (maintainResult == 2 || maintainResult == 4) {
            Serial.print("[Ethernet] DHCP yenilendi, IP: ");
            Serial.println(Ethernet.localIP());
        }
    }

    if (!isConnected()) {
        _timeSynced = false;
        _ntpRequestPending = false;
        _ntpUdp.stop();
        if (now - _lastConnectionAttemptMs >= RECONNECT_INTERVAL_MS) {
            if (
                Ethernet.hardwareStatus() != EthernetNoHardware
                && Ethernet.linkStatus() == LinkOFF
            ) {
                _lastConnectionAttemptMs = now;
                Serial.println("[Ethernet] Kablo/link halen yok; DHCP bekletilmedi.");
                return;
            }
            Serial.println("[Ethernet] Baglanti yok; W5500 yeniden baslatiliyor...");
            resetW5500();
            Ethernet.init(ETHERNET_CS_PIN);
            startConnection();
        }
        return;
    }

    if (_ntpRequestPending) {
        _timeSynced = pollNtpResponse();
    } else if (!_timeSynced && now - _lastNtpAttemptMs >= NTP_RETRY_INTERVAL_MS) {
        startNtpRequest();
    }
}

void NetworkManager::startNtpRequest() {
    memset(_ntpPacket, 0, sizeof(_ntpPacket));
    _ntpPacket[0] = 0b11100011;
    _ntpPacket[1] = 0;
    _ntpPacket[2] = 6;
    _ntpPacket[3] = 0xEC;
    _ntpPacket[12] = 49;
    _ntpPacket[13] = 0x4E;
    _ntpPacket[14] = 49;
    _ntpPacket[15] = 52;
    _lastNtpAttemptMs = millis();

    _ntpUdp.stop();
    if (_ntpUdp.begin(NTP_LOCAL_PORT) == 0) {
        Serial.println("[NTP] Ethernet UDP soketi acilamadi.");
        return;
    }

    if (_ntpUdp.beginPacket(NTP_SUNUCU_1, NTP_SERVER_PORT) == 0) {
        Serial.println("[NTP] Sunucu adresi DNS ile cozumlenemedi.");
        _ntpUdp.stop();
        return;
    }
    _ntpUdp.write(_ntpPacket, sizeof(_ntpPacket));
    _ntpUdp.endPacket();
    _ntpRequestPending = true;
}

bool NetworkManager::pollNtpResponse() {
    const int packetSize = _ntpUdp.parsePacket();
    if (packetSize >= NTP_PACKET_SIZE) {
        _ntpUdp.read(_ntpPacket, sizeof(_ntpPacket));
        _ntpUdp.stop();
        _ntpRequestPending = false;

        const uint32_t ntpSeconds =
            (static_cast<uint32_t>(_ntpPacket[40]) << 24)
            | (static_cast<uint32_t>(_ntpPacket[41]) << 16)
            | (static_cast<uint32_t>(_ntpPacket[42]) << 8)
            | static_cast<uint32_t>(_ntpPacket[43]);
        if (ntpSeconds <= NTP_UNIX_EPOCH_OFFSET) return false;

        timeval systemTime{
            static_cast<time_t>(ntpSeconds - NTP_UNIX_EPOCH_OFFSET),
            0
        };
        settimeofday(&systemTime, nullptr);
        Serial.println("[NTP] Saat W5500 Ethernet uzerinden basariyla cekildi!");
        printLocalTime();
        return true;
    }

    if (millis() - _lastNtpAttemptMs >= NTP_RESPONSE_TIMEOUT_MS) {
        _ntpUdp.stop();
        _ntpRequestPending = false;
        Serial.println("[NTP] Ethernet NTP cevabi zaman asimina ugradi.");
    }
    return false;
}

bool NetworkManager::isTimeSet() const {
    return _timeSynced;
}

String NetworkManager::localIpString() const {
    return Ethernet.localIP().toString();
}

void NetworkManager::printLocalTime() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo, 10)) {
        Serial.println("[NTP] Saat henuz ayarlanmadi.");
        return;
    }
    Serial.println(&timeinfo, "[Tarih/Saat] %A, %B %d %Y %H:%M:%S");
}
