#ifndef LOCK_CONTROLLER_H
#define LOCK_CONTROLLER_H

#include <Arduino.h>

class LockController {
private:
    uint8_t relayPin;
    unsigned long unlockTimer;
    unsigned long cooldownTimer;
    bool isUnlocked;
    bool isCoolingDown;

    static constexpr unsigned long UNLOCK_DURATION = 2000;
    static constexpr unsigned long COOLDOWN_DURATION = 1000;

public:
    explicit LockController(uint8_t relayPin);

    void begin();
    bool unlockDoor();
    void update();
};

#endif
