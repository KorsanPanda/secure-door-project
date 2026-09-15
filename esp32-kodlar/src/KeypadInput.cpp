#include "KeypadInput.h"
#include <cstring>

char KeypadInput::KEY_MAP
    [KeypadInput::ROW_COUNT]
    [KeypadInput::COLUMN_COUNT] = {
        {'1', '2', '3'},
        {'4', '5', '6'},
        {'7', '8', '9'},
        {'*', '0', '#'}
};

KeypadInput::KeypadInput(
    byte* rowPins,
    byte* columnPins,
    uint8_t minimumPinLength,
    uint8_t maximumPinLength,
    uint32_t timeoutMs
)
    : _keypad(
          makeKeymap(KEY_MAP),
          rowPins,
          columnPins,
          ROW_COUNT,
          COLUMN_COUNT
      ),
      _pinLength(0),
      _minimumPinLength(minimumPinLength),
      _maximumPinLength(maximumPinLength),
      _timeoutMs(timeoutMs),
      _lastInputTime(0),
      _started(false),
      _pinReady(false),
      _timedOut(false),
      _keyPressedThisUpdate(false),
      _lastEvent{} {
    normalizePinLimits();
    resetPinBuffer();
}

void KeypadInput::begin() {
    _keypad.setDebounceTime(10);
    _started = true;
    resetPinBuffer();
    Serial.println("[Keypad] Dogrudan ESP32 GPIO baglantisi hazir.");
}

void KeypadInput::update() {
    if (!_started) {
        return;
    }

    _keyPressedThisUpdate = false;
    const char key = _keypad.getKey();
    if (key != NO_KEY) {
        _keyPressedThisUpdate = true;
        _lastInputTime = millis();
        _timedOut = false;
        processKey(key);
    }

    checkTimeout();
}

bool KeypadInput::isPinReady() const {
    return _pinReady;
}

bool KeypadInput::wasKeyPressed() const {
    return _keyPressedThisUpdate;
}

bool KeypadInput::hasTimedOut() const {
    return _timedOut;
}

uint8_t KeypadInput::getPinLength() const {
    return _pinLength;
}

CustomKeypadEvent KeypadInput::getLastEvent() const {
    return _lastEvent;
}

String KeypadInput::getMaskedPin() const {
    String masked = "";
    masked.reserve(_pinLength);

    for (uint8_t index = 0; index < _pinLength; ++index) {
        masked += '*';
    }

    return masked;
}

String KeypadInput::consumePin() {
    if (!_pinReady) {
        return String();
    }

    String pin = String(_pinBuffer);
    resetPinBuffer();
    return pin;
}

void KeypadInput::clear() {
    resetPinBuffer();
    setEvent(KeypadEventType::PinCleared, '*');
}

void KeypadInput::cancel() {
    resetPinBuffer();
    setEvent(KeypadEventType::PinCancelled, '*');
}

void KeypadInput::setTimeoutMs(uint32_t timeoutMs) {
    _timeoutMs = timeoutMs;
}

void KeypadInput::setMinimumPinLength(uint8_t length) {
    _minimumPinLength = length;
    normalizePinLimits();
}

void KeypadInput::setMaximumPinLength(uint8_t length) {
    _maximumPinLength = length;
    normalizePinLimits();
}

void KeypadInput::processKey(char key) {
    if (_pinReady) {
        resetPinBuffer();
    }

    if (key >= '0' && key <= '9') {
        handleDigit(key);
        return;
    }

    if (key == '*') {
        clear();
        return;
    }

    if (key == '#') {
        submitPin();
        return;
    }
}

void KeypadInput::handleDigit(char key) {
    if (_pinLength >= _maximumPinLength) {
        setEvent(KeypadEventType::BufferFull, key);
        return;
    }

    _pinBuffer[_pinLength] = key;
    ++_pinLength;
    _pinBuffer[_pinLength] = '\0';

    // PIN sadece '#' tusuna basildiginda tamamlanir.
    setEvent(KeypadEventType::KeyPressed, key);
}

void KeypadInput::submitPin() {
    if (_pinLength < _minimumPinLength || _pinLength > _maximumPinLength) {
        resetPinBuffer();
        setEvent(KeypadEventType::InvalidLength, '#');
        return;
    }

    _pinReady = true;
    setEvent(KeypadEventType::PinCompleted, '#');
}

void KeypadInput::resetPinBuffer() {
    volatile char* secureBuffer = _pinBuffer;

    for (size_t index = 0; index < sizeof(_pinBuffer); ++index) {
        secureBuffer[index] = '\0';
    }

    _pinLength = 0;
    _pinReady = false;
}

void KeypadInput::normalizePinLimits() {
    if (_maximumPinLength == 0) {
        _maximumPinLength = 1;
    }

    if (_maximumPinLength > ABSOLUTE_MAX_PIN_LENGTH) {
        _maximumPinLength = ABSOLUTE_MAX_PIN_LENGTH;
    }

    if (_minimumPinLength == 0) {
        _minimumPinLength = 1;
    }

    if (_minimumPinLength > _maximumPinLength) {
        _minimumPinLength = _maximumPinLength;
    }
}

void KeypadInput::setEvent(KeypadEventType eventType, char key) {
    _lastEvent.type = eventType;
    _lastEvent.key = key;
    _lastEvent.pinLength = _pinLength;
}

void KeypadInput::checkTimeout() {
    if (_timeoutMs == 0 || _pinLength == 0 || _pinReady) {
        return;
    }

    if (millis() - _lastInputTime >= _timeoutMs) {
        resetPinBuffer();
        _timedOut = true;
        setEvent(KeypadEventType::PinTimeout, '\0');
    }
}
