#pragma once

#include <Arduino.h>
#include <Keypad.h>

/**
 * Keypad üzerinde gerçekleşen olay türleri.
 *
 * Bu modül PIN'in doğru veya yanlış olduğuna karar vermez.
 * Yalnızca fiziksel keypad girişini toplar.
 */
enum class KeypadEventType : uint8_t {
    None,
    KeyPressed,
    PinCompleted,
    PinCleared,
    PinCancelled,
    PinTimeout,
    InvalidLength,
    BufferFull
};

/**
 * Keypad olay bilgisi.
 *
 * Keypad.h kütüphanesindeki isim çakışmasını önlemek için 
 * CustomKeypadEvent olarak adlandırılmıştır.
 */
struct CustomKeypadEvent {
    KeypadEventType type = KeypadEventType::None;
    char key = '\0';
    uint8_t pinLength = 0;
};

/**
 * 3x4 keypad üzerinden non-blocking PIN girişini yönetir.
 *
 * Tuşlar:
 * 0-9 : PIN'e rakam ekler
 * * : PIN girişini temizler
 * #   : PIN girişini tamamlar
 */
class KeypadInput {
public:
    static constexpr byte ROW_COUNT = 4;
    static constexpr byte COLUMN_COUNT = 3;

    /**
     * Güvenlik ve bellek kullanımı için kesin üst sınır.
     */
    static constexpr uint8_t ABSOLUTE_MAX_PIN_LENGTH = 16;

    /**
     * @param rowPins Satır GPIO pin dizisi (4 elemanlı)
     * @param columnPins Sütun GPIO pin dizisi (3 elemanlı)
     * @param minimumPinLength Kabul edilebilir minimum PIN uzunluğu
     * @param maximumPinLength Kabul edilebilir maksimum PIN uzunluğu
     * @param timeoutMs İşlem yapılmazsa PIN'in sıfırlanma süresi (0 = kapalı)
     */
    KeypadInput(
        byte* rowPins,
        byte* columnPins,
        uint8_t minimumPinLength = 4,
        uint8_t maximumPinLength = 6,
        uint32_t timeoutMs = 10000
    );

    /**
     * Keypad donanımını başlatır.
     */
    void begin();

    /**
     * Keypad durumunu ve zaman aşımlarını günceller.
     * loop() içerisinde sürekli çağrılmalıdır.
     */
    void update();

    /**
     * Tamamlanmış ve doğrulanmaya hazır bir PIN var mı?
     */
    bool isPinReady() const;
    bool wasKeyPressed() const;

    /**
     * Son tuş basımından bu yana zaman aşımı oluştu mu?
     */
    bool hasTimedOut() const;

    /**
     * Girilen PIN uzunluğunu döndürür.
     */
    uint8_t getPinLength() const;

    /**
     * Son gerçekleşen olay bilgisini döndürür.
     */
    CustomKeypadEvent getLastEvent() const;

    /**
     * Ekran gösterimi için maskeli PIN döndürür.
     * Örnek: 1234 -> ****
     */
    String getMaskedPin() const;

    /**
     * Tamamlanmış PIN'i döndürür ve tamponu sıfırlar.
     */
    String consumePin();

    /**
     * Mevcut PIN girişini temizler.
     */
    void clear();

    /**
     * Mevcut PIN girişini iptal eder.
     */
    void cancel();

    /**
     * PIN zaman aşımını değiştirir.
     */
    void setTimeoutMs(uint32_t timeoutMs);

    /**
     * Minimum PIN uzunluğunu değiştirir.
     */
    void setMinimumPinLength(uint8_t length);

    /**
     * Maksimum PIN uzunluğunu değiştirir.
     */
    void setMaximumPinLength(uint8_t length);

private:
    static char KEY_MAP[ROW_COUNT][COLUMN_COUNT];

    Keypad _keypad;

    char _pinBuffer[ABSOLUTE_MAX_PIN_LENGTH + 1];

    uint8_t _pinLength;
    uint8_t _minimumPinLength;
    uint8_t _maximumPinLength;

    uint32_t _timeoutMs;
    uint32_t _lastInputTime;

    bool _started;
    bool _pinReady;
    bool _timedOut;
    bool _keyPressedThisUpdate;

    CustomKeypadEvent _lastEvent;

    void processKey(char key);
    void handleDigit(char key);
    void submitPin();
    void resetPinBuffer();
    void normalizePinLimits();
    void setEvent(KeypadEventType eventType, char key);
    void checkTimeout();
};
