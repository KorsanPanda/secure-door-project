#pragma once

#include <Arduino.h>
#include <LiquidCrystal_I2C.h>
#include <Wire.h>

class LcdDisplay {
public:
    LcdDisplay(uint8_t sdaPin, uint8_t sclPin);

    bool begin();
    bool isAvailable() const;
    void update();

    void showBoot();
    void showIdle(bool doorOpen);
    void showPinEntry(uint8_t pinLength);
    void showPinInvalid();
    void showChecking();
    void showApproved();
    void showDenied();
    void showConnectionUnavailable();
    void showAlarm();
    void showEthernetConnecting();
    void showEthernetConnected(const String &ipAddress);
    void showEthernetDisconnected();
    void showMqttWaiting();
    void showMqttConnected();
    void showMqttDisconnected();

private:
    static constexpr uint8_t COLUMN_COUNT = 16;

    uint8_t _sdaPin;
    uint8_t _sclPin;
    uint8_t _address;
    bool _available;
    LiquidCrystal_I2C *_lcd;
    String _lastFirstLine;
    String _lastSecondLine;
    uint32_t _lastRefreshAtMs;

    bool detectAddress();
    bool initializeDisplay();
    void writeCurrentLines();
    void showLines(const String &firstLine, const String &secondLine);
    String formatLine(const String &text) const;
};
