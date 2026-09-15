#include "AlertSystem.h"

#include <Wire.h>

static constexpr uint8_t BUZZER_PWM_CHANNEL = 7;
static constexpr uint8_t BUZZER_PWM_RESOLUTION = 10;
static constexpr uint32_t BUZZER_PWM_MAX_DUTY =
    (1U << BUZZER_PWM_RESOLUTION) - 1U;

const AlertSystem::AlertStep AlertSystem::KEYPRESS_STEPS[] = {
    {true,  true,  90},
    {false, false, 1}
};

/*
 * Başarılı giriş:
 * Bir kısa bip ve kısa LED gösterimi.
 */
const AlertSystem::AlertStep AlertSystem::SUCCESS_STEPS[] = {
    {true,  true,  250},
    {false, true,  450},
    {false, false, 1}
};

/*
 * Hata veya yanlış PIN:
 * İki kısa bip.
 */
const AlertSystem::AlertStep AlertSystem::ERROR_STEPS[] = {
    {true,  true,  180},
    {false, false, 120},
    {true,  true,  220},
    {false, false, 1}
};

/*
 * Erişim reddedildi:
 * Daha belirgin üçlü uyarı.
 */
const AlertSystem::AlertStep AlertSystem::ACCESS_DENIED_STEPS[] = {
    {true,  true,  220},
    {false, false, 120},
    {true,  true,  220},
    {false, false, 120},
    {true,  true,  400},
    {false, false, 1}
};

/*
 * Kullanıcı geçici olarak kilitlendi:
 * Beş kısa bip, ardından bekleme.
 */
const AlertSystem::AlertStep AlertSystem::LOCKOUT_STEPS[] = {
    {true,  true,  100},
    {false, false, 100},

    {true,  true,  100},
    {false, false, 100},

    {true,  true,  100},
    {false, false, 100},

    {true,  true,  100},
    {false, false, 100},

    {true,  true,  100},
    {false, false, 700}
};

/*
 * Kapı uzun süre açık:
 * Her iki saniyede bir kısa bip.
 */
const AlertSystem::AlertStep AlertSystem::DOOR_OPEN_STEPS[] = {
    {true, true,  400},
    {true, false, 400}
};

/*
 * Zorla giriş:
 * Hızlı ve sürekli alarm.
 */
const AlertSystem::AlertStep AlertSystem::FORCED_ENTRY_STEPS[] = {
    {true,  true,  250},
    {false, false, 100},
    {true,  false, 250},
    {false, true,  100}
};

/*
 * İnternet bağlantısı yok:
 * Buzzer sürekli çalmaz.
 * LED yavaş şekilde yanıp söner.
 */
const AlertSystem::AlertStep AlertSystem::OFFLINE_STEPS[] = {
    {false, true,  300},
    {false, false, 1700}
};

/*
 * Genel cihaz hatası:
 * Uzun ve belirgin hata uyarısı.
 */
const AlertSystem::AlertStep AlertSystem::DEVICE_ERROR_STEPS[] = {
    {true,  true,  400},
    {false, false, 200},
    {true,  true,  400},
    {false, false, 800}
};

AlertSystem::AlertSystem(
    uint8_t buzzerPin,
    uint8_t ledPin,
    bool buzzerActiveHigh,
    bool ledActiveHigh,
    uint8_t blueLedPin,
    bool blueLedActiveHigh,
    uint8_t redLedPin,
    bool redLedActiveHigh,
    uint8_t ledExpanderAddress
)
    : _buzzerPin(buzzerPin),
      _ledPin(ledPin),
      _blueLedPin(blueLedPin),
      _redLedPin(redLedPin),
      _buzzerActiveHigh(buzzerActiveHigh),
      _ledActiveHigh(ledActiveHigh),
      _blueLedActiveHigh(blueLedActiveHigh),
      _redLedActiveHigh(redLedActiveHigh),
      _ledExpanderAddress(ledExpanderAddress),
      _ledExpanderState(0xFF),
      _lastLedExpanderErrorAtMs(0),
      _activePattern(AlertPattern::None),
      _activeSteps(nullptr),
      _activeStepCount(0),
      _currentStep(0),
      _repeat(false),
      _started(false),
      _pinEntryActive(false),
      _stepStartedAt(0) {}

void AlertSystem::begin() {
    pinMode(_buzzerPin, OUTPUT);

    if (_ledExpanderAddress == 0) {
        pinMode(_ledPin, OUTPUT);
        if (_blueLedPin != 255) {
            pinMode(_blueLedPin, OUTPUT);
        }
        if (_redLedPin != 255) {
            pinMode(_redLedPin, OUTPUT);
        }
    } else {
        // PCF8574 guc acilisinda tum uclari HIGH birakir. Ortak arti RGB
        // LED icin HIGH=sonuk oldugundan once tum renkleri guvenle kapat.
        _ledExpanderState = 0xFF;
        const bool ledExpanderReady = writeLedExpanderState();
        Serial.printf(
            ledExpanderReady
                ? "[RGB LED] PCF8574T hazir (adres=0x%02X, P0/P3/P5).\n"
                : "[RGB LED] PCF8574T bulunamadi (adres=0x%02X). I2C ve adres anahtarlarini kontrol edin.\n",
            _ledExpanderAddress
        );
    }

    ledcSetup(BUZZER_PWM_CHANNEL, 2000, BUZZER_PWM_RESOLUTION);
    ledcAttachPin(_buzzerPin, BUZZER_PWM_CHANNEL);
    ledcWrite(
        BUZZER_PWM_CHANNEL,
        _buzzerActiveHigh ? 0 : BUZZER_PWM_MAX_DUTY
    );
    setLed(false);
    setBlueLed(false);
    setRedLed(false);

    _activePattern = AlertPattern::None;
    _activeSteps = nullptr;
    _activeStepCount = 0;
    _currentStep = 0;
    _repeat = false;
    _stepStartedAt = 0;

    _started = true;
}

void AlertSystem::update() {
    if (
        !_started ||
        !isActive() ||
        _activeSteps == nullptr ||
        _activeStepCount == 0
    ) {
        return;
    }

    const uint32_t currentTime = millis();

    const uint32_t elapsedTime =
        static_cast<uint32_t>(
            currentTime - _stepStartedAt
        );

    const uint32_t currentStepDuration =
        _activeSteps[_currentStep].durationMs;

    if (elapsedTime < currentStepDuration) {
        return;
    }

    ++_currentStep;

    if (_currentStep >= _activeStepCount) {
        if (_repeat) {
            _currentStep = 0;
        } else {
            finishPattern();
            return;
        }
    }

    _stepStartedAt = currentTime;
    applyCurrentStep();
}

bool AlertSystem::play(AlertPattern pattern) {
    if (
        !_started ||
        pattern == AlertPattern::None
    ) {
        return false;
    }

    /*
     * Aynı alarm zaten çalışıyorsa baştan başlatılmaz.
     * Özellikle loop içerisinde tekrar tekrar playOffline()
     * çağrılması desenin sürekli sıfırlanmasını engeller.
     */
    if (_activePattern == pattern) {
        return true;
    }

    /*
     * Düşük öncelikli olay yüksek öncelikli alarmı kesemez.
     */
    if (
        isActive() &&
        getPriority(pattern) < getPriority(_activePattern)
    ) {
        return false;
    }

    const PatternDefinition definition =
        getPatternDefinition(pattern);

    if (
        definition.steps == nullptr ||
        definition.stepCount == 0
    ) {
        return false;
    }

    startPattern(pattern, definition);
    return true;
}

bool AlertSystem::playSuccess() {
    return play(AlertPattern::Success);
}

bool AlertSystem::playKeypress() {
    return play(AlertPattern::Keypress);
}

bool AlertSystem::playError() {
    return play(AlertPattern::Error);
}

bool AlertSystem::playInvalidPin() {
    return play(AlertPattern::InvalidPin);
}

bool AlertSystem::playAccessDenied() {
    return play(AlertPattern::AccessDenied);
}

bool AlertSystem::playLockout() {
    return play(AlertPattern::Lockout);
}

bool AlertSystem::playDoorOpenTooLong() {
    return play(AlertPattern::DoorOpenTooLong);
}

bool AlertSystem::playForcedEntry() {
    return play(AlertPattern::ForcedEntry);
}

bool AlertSystem::playOffline() {
    return play(AlertPattern::Offline);
}

bool AlertSystem::playDeviceError() {
    return play(AlertPattern::DeviceError);
}

void AlertSystem::setPinEntryActive(bool active) {
    _pinEntryActive = active;
    if (!_started || isActive()) return;

    setLed(false);
    setRedLed(false);
    setBlueLed(active);
}

void AlertSystem::stop() {
    finishPattern();
}

void AlertSystem::stop(AlertPattern pattern) {
    if (_activePattern == pattern) {
        finishPattern();
    }
}

bool AlertSystem::isActive() const {
    return _activePattern != AlertPattern::None;
}

AlertPattern AlertSystem::getActivePattern() const {
    return _activePattern;
}

void AlertSystem::setLed(bool enabled) {
    writeLedOutput(
        _ledPin,
        enabled,
        _ledActiveHigh
    );
}

void AlertSystem::setBuzzer(bool enabled) {
    /*
     * Takili buzzer pasif tiptir; yalnizca HIGH/LOW vermek ses uretmez.
     * tone() ile kare dalga olusturulur. Onay sesi daha ince, red sesi
     * daha kalin duyulur; desen adimlari bip sayisini belirlemeye devam eder.
     */
    if (enabled) {
        unsigned int frequency = 2800;

        if (
            _activePattern == AlertPattern::Success
            || _activePattern == AlertPattern::Keypress
        ) {
            frequency = 3200;
        } else if (_activePattern == AlertPattern::DoorOpenTooLong) {
            frequency = 4000;
        } else if (
            _activePattern == AlertPattern::AccessDenied
            || _activePattern == AlertPattern::InvalidPin
            || _activePattern == AlertPattern::Error
        ) {
            frequency = 2400;
        }

        ledcWriteTone(BUZZER_PWM_CHANNEL, frequency);
        return;
    }

    ledcWrite(
        BUZZER_PWM_CHANNEL,
        _buzzerActiveHigh ? 0 : BUZZER_PWM_MAX_DUTY
    );
}

AlertSystem::PatternDefinition
AlertSystem::getPatternDefinition(
    AlertPattern pattern
) const {
    switch (pattern) {
        case AlertPattern::Keypress:
            return {
                KEYPRESS_STEPS,
                static_cast<uint8_t>(
                    sizeof(KEYPRESS_STEPS) /
                    sizeof(KEYPRESS_STEPS[0])
                ),
                false
            };

        case AlertPattern::Success:
            return {
                SUCCESS_STEPS,
                static_cast<uint8_t>(
                    sizeof(SUCCESS_STEPS) /
                    sizeof(SUCCESS_STEPS[0])
                ),
                false
            };

        case AlertPattern::Error:
        case AlertPattern::InvalidPin:
            return {
                ERROR_STEPS,
                static_cast<uint8_t>(
                    sizeof(ERROR_STEPS) /
                    sizeof(ERROR_STEPS[0])
                ),
                false
            };

        case AlertPattern::AccessDenied:
            return {
                ACCESS_DENIED_STEPS,
                static_cast<uint8_t>(
                    sizeof(ACCESS_DENIED_STEPS) /
                    sizeof(ACCESS_DENIED_STEPS[0])
                ),
                false
            };

        case AlertPattern::Lockout:
            return {
                LOCKOUT_STEPS,
                static_cast<uint8_t>(
                    sizeof(LOCKOUT_STEPS) /
                    sizeof(LOCKOUT_STEPS[0])
                ),
                true
            };

        case AlertPattern::DoorOpenTooLong:
            return {
                DOOR_OPEN_STEPS,
                static_cast<uint8_t>(
                    sizeof(DOOR_OPEN_STEPS) /
                    sizeof(DOOR_OPEN_STEPS[0])
                ),
                true
            };

        case AlertPattern::ForcedEntry:
            return {
                FORCED_ENTRY_STEPS,
                static_cast<uint8_t>(
                    sizeof(FORCED_ENTRY_STEPS) /
                    sizeof(FORCED_ENTRY_STEPS[0])
                ),
                true
            };

        case AlertPattern::Offline:
            return {
                OFFLINE_STEPS,
                static_cast<uint8_t>(
                    sizeof(OFFLINE_STEPS) /
                    sizeof(OFFLINE_STEPS[0])
                ),
                true
            };

        case AlertPattern::DeviceError:
            return {
                DEVICE_ERROR_STEPS,
                static_cast<uint8_t>(
                    sizeof(DEVICE_ERROR_STEPS) /
                    sizeof(DEVICE_ERROR_STEPS[0])
                ),
                true
            };

        case AlertPattern::None:
        default:
            return {
                nullptr,
                0,
                false
            };
    }
}

uint8_t AlertSystem::getPriority(
    AlertPattern pattern
) const {
    switch (pattern) {
        case AlertPattern::ForcedEntry:
            return 100;

        case AlertPattern::DoorOpenTooLong:
            return 90;

        case AlertPattern::Lockout:
            return 80;

        case AlertPattern::DeviceError:
            return 70;

        case AlertPattern::AccessDenied:
            return 60;

        case AlertPattern::InvalidPin:
        case AlertPattern::Error:
            return 50;

        case AlertPattern::Success:
            return 30;

        case AlertPattern::Offline:
            return 20;

        case AlertPattern::Keypress:
            return 10;

        case AlertPattern::None:
        default:
            return 0;
    }
}

void AlertSystem::startPattern(
    AlertPattern pattern,
    const PatternDefinition& definition
) {
    /*
     * Önce önceki çıkışları kapat.
     */
    setBuzzer(false);
    setLed(false);
    setBlueLed(false);
    setRedLed(false);

    _activePattern = pattern;
    _activeSteps = definition.steps;
    _activeStepCount = definition.stepCount;
    _currentStep = 0;
    _repeat = definition.repeat;
    _stepStartedAt = millis();

    applyCurrentStep();
}

void AlertSystem::applyCurrentStep() {
    if (
        _activeSteps == nullptr ||
        _currentStep >= _activeStepCount
    ) {
        finishPattern();
        return;
    }

    setBuzzer(
        _activeSteps[_currentStep].buzzerOn
    );

    if (_activePattern == AlertPattern::DoorOpenTooLong) {
        setLed(false);
        setBlueLed(false);
        setRedLed(_activeSteps[_currentStep].ledOn);
    } else if (_activePattern == AlertPattern::Keypress) {
        setLed(false);
        setRedLed(false);
        setBlueLed(_activeSteps[_currentStep].ledOn);
    } else if (
        _activePattern == AlertPattern::AccessDenied
        || _activePattern == AlertPattern::InvalidPin
        || _activePattern == AlertPattern::Error
        || _activePattern == AlertPattern::Lockout
        || _activePattern == AlertPattern::ForcedEntry
        || _activePattern == AlertPattern::DeviceError
    ) {
        setLed(false);
        setBlueLed(false);
        setRedLed(_activeSteps[_currentStep].ledOn);
    } else {
        setBlueLed(false);
        setRedLed(false);
        setLed(_activeSteps[_currentStep].ledOn);
    }
}

void AlertSystem::finishPattern() {
    setBuzzer(false);
    setLed(false);
    setBlueLed(false);
    setRedLed(false);

    _activePattern = AlertPattern::None;
    _activeSteps = nullptr;
    _activeStepCount = 0;
    _currentStep = 0;
    _repeat = false;
    _stepStartedAt = 0;

    if (_pinEntryActive) {
        setBlueLed(true);
    }
}

void AlertSystem::setBlueLed(bool enabled) {
    if (_blueLedPin == 255) return;
    writeLedOutput(_blueLedPin, enabled, _blueLedActiveHigh);
}

void AlertSystem::setRedLed(bool enabled) {
    if (_redLedPin == 255) return;
    writeLedOutput(_redLedPin, enabled, _redLedActiveHigh);
}

void AlertSystem::writeLedOutput(
    uint8_t pin,
    bool enabled,
    bool activeHigh
) {
    if (_ledExpanderAddress == 0) {
        writeOutput(pin, enabled, activeHigh);
        return;
    }

    if (pin > 7) return;

    const bool outputHigh = enabled == activeHigh;
    bitWrite(_ledExpanderState, pin, outputHigh ? 1 : 0);
    writeLedExpanderState();
}

bool AlertSystem::writeLedExpanderState() {
    Wire.beginTransmission(_ledExpanderAddress);
    Wire.write(_ledExpanderState);
    const bool success = Wire.endTransmission() == 0;

    if (!success && millis() - _lastLedExpanderErrorAtMs >= 3000) {
        _lastLedExpanderErrorAtMs = millis();
        Serial.printf(
            "[RGB LED] PCF8574T I2C yazma hatasi (adres=0x%02X).\n",
            _ledExpanderAddress
        );
    }

    return success;
}

void AlertSystem::writeOutput(
    uint8_t pin,
    bool enabled,
    bool activeHigh
) {
    /*
     * activeHigh=true:
     * enabled=true  -> HIGH
     * enabled=false -> LOW
     *
     * activeHigh=false:
     * enabled=true  -> LOW
     * enabled=false -> HIGH
     */
    const uint8_t outputLevel =
        (enabled == activeHigh)
            ? HIGH
            : LOW;

    digitalWrite(pin, outputLevel);
}
