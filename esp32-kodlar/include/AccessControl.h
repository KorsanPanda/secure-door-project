#ifndef ACCESS_CONTROL_H
#define ACCESS_CONTROL_H

#include <string>

#ifdef ARDUINO
#include <Arduino.h>
#include <Preferences.h>
#endif

class AccessControl {
private:
#ifdef ARDUINO
    Preferences preferences;
    String _lastOfflineUserId;
    String _pinSalt;

    String hashPin(const String &pin) const;
    String findUserByHashedPin(const String &jsonList, const String &pin) const;
    void migratePlaintextPins();
#endif

public:
#ifdef ARDUINO
    AccessControl();
    void begin();
    void loop();

    // MQTT baglantisi yokken yalnizca kalici yerel PIN listesini kontrol eder.
    // Kartlar guvenlik geregi her zaman MQTT sunucusundan dogrulanir.
    bool verifyOfflineAccess(String authData, bool isCard);

    // Sunucunun onayladigi kart/PIN'i sonraki cevrimdisi kullanim icin saklar.
    void rememberOfflineAccess(String authData, bool isCard, String userId);

    void syncOfflinePins(String jsonList, bool replaceList = true);
    String getLastOfflineUserId();
#endif

    static std::string findUserByOfflinePin(
        const std::string &jsonList,
        const std::string &pin
    );

};

#endif
