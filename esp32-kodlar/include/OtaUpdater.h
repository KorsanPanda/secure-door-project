#pragma once

#ifdef ARDUINO

#include "MqttManager.h"

class OtaUpdater {
public:
    explicit OtaUpdater(MqttManager &mqttManager);

    bool performUpdate(const DeviceCommand &command);

private:
    MqttManager &_mqttManager;

    static bool isValidHttpUrl(const std::string &url);
    static bool isValidMd5(const std::string &md5);
    bool performEthernetDownload(const DeviceCommand &command);
};

#endif
