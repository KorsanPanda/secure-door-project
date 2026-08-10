#include "LockController.h"

LockController::LockController(uint8_t relayPin)
    : relayPin(relayPin),
      unlockTimer(0),
      cooldownTimer(0),
      isUnlocked(false),
      isCoolingDown(false) {}

void LockController::begin() {
    // Role karti aktif-dusuk calisir. Open-drain cikis HIGH yazildiginda
    // hat serbest/pasif, LOW yazildiginda GND'ye cekilmis/aktif olur.
    // Mod degistirilmeden once HIGH yazarak acilista istemsiz tetiklemeyi onle.
    digitalWrite(relayPin, HIGH);
    pinMode(relayPin, OUTPUT_OPEN_DRAIN);

    Serial.printf(
        "[KILIT] GPIO%d PASIF/HIGH (hat serbest). Okunan lojik=%d.\n",
        relayPin,
        digitalRead(relayPin)
    );
}

bool LockController::unlockDoor() {
    if (isCoolingDown || isUnlocked) {
        return false;
    }

    digitalWrite(relayPin, LOW);
    isUnlocked = true;
    unlockTimer = millis();

    Serial.printf(
        "[KILIT] GPIO%d AKTIF/LOW (GND'ye cekildi). Okunan lojik=%d; 2000 ms.\n",
        relayPin,
        digitalRead(relayPin)
    );
    return true;
}

void LockController::update() {
    const unsigned long now = millis();

    if (isUnlocked && now - unlockTimer >= UNLOCK_DURATION) {
        digitalWrite(relayPin, HIGH);
        isUnlocked = false;
        isCoolingDown = true;
        cooldownTimer = now;

        Serial.printf(
            "[KILIT] GPIO%d PASIF/HIGH. Tetikleme suresi=%lu ms.\n",
            relayPin,
            now - unlockTimer
        );
    }

    if (isCoolingDown && now - cooldownTimer >= COOLDOWN_DURATION) {
        isCoolingDown = false;
    }
}
