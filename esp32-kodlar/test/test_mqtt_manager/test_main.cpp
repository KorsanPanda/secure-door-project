#include <unity.h>
#include "MqttManager.h"

void setUp(void) {}
void tearDown(void) {}

void test_topics(void) {
    TEST_ASSERT_EQUAL_STRING("kapi/1/erisim-istek", MqttManager::buildEventTopic().c_str());
    TEST_ASSERT_EQUAL_STRING("kapi/1/+", MqttManager::buildCommandTopic().c_str());
    TEST_ASSERT_EQUAL_STRING("kapi/1/saglik", MqttManager::buildHeartbeatTopic().c_str());
}

void test_serialize_card_request(void) {
    EntryEvent event;
    event.cihazOlayId = "550e8400-e29b-41d4-a716-446655440000";
    event.cihazId = 1;
    event.kapiId = 1;
    event.okunanUid = "3C:B2:24:07";
    event.dogrulamaYontemi = "kart";
    event.timestampEpoch = 1700000000;

    std::string json = MqttManager::serializeEntryEvent(event);

    TEST_ASSERT_TRUE(json.find("\"mesaj_tipi\":\"ACCESS_REQUEST\"") != std::string::npos);
    TEST_ASSERT_TRUE(json.find("\"okunan_uid\":\"3C:B2:24:07\"") != std::string::npos);
    TEST_ASSERT_TRUE(json.find("\"sonuc\"") == std::string::npos);
    TEST_ASSERT_TRUE(json.find("\"pin\"") == std::string::npos);
}

void test_serialize_pin_request(void) {
    EntryEvent event;
    event.cihazOlayId = "550e8400-e29b-41d4-a716-446655440001";
    event.pin = "123456";
    event.dogrulamaYontemi = "pin";

    std::string json = MqttManager::serializeEntryEvent(event);

    TEST_ASSERT_TRUE(json.find("\"pin\":\"123456\"") != std::string::npos);
    TEST_ASSERT_TRUE(json.find("\"sonuc\"") == std::string::npos);
}

void test_serialize_offline_result(void) {
    EntryEvent event;
    event.cihazOlayId = "550e8400-e29b-41d4-a716-446655440002";
    event.dogrulamaYontemi = "pin";
    event.kullaniciId = "30";
    event.sonuc = "izin";

    std::string json = MqttManager::serializeEntryEvent(event);

    TEST_ASSERT_TRUE(json.find("\"sonuc\":\"izin\"") != std::string::npos);
    TEST_ASSERT_TRUE(json.find("\"kullanici_id\":\"30\"") != std::string::npos);
}

void test_parse_access_response(void) {
    const std::string payload =
        "{\"komut_tipi\":\"ACCESS_RESPONSE\","
        "\"cihaz_olay_id\":\"550e8400-e29b-41d4-a716-446655440000\","
        "\"onay\":true,\"kullanici_id\":\"30\"}";

    DeviceCommand command = MqttManager::parseCommand(payload);

    TEST_ASSERT_TRUE(command.type == CommandType::ACCESS_RESPONSE);
    TEST_ASSERT_TRUE(command.accessAllowed);
    TEST_ASSERT_EQUAL_STRING(
        "550e8400-e29b-41d4-a716-446655440000",
        command.requestId.c_str()
    );
    TEST_ASSERT_EQUAL_STRING("30", command.accessUserId.c_str());
}

void test_parse_other_commands(void) {
    DeviceCommand door = MqttManager::parseCommand(
        "{\"komut_tipi\":\"DOOR_OPEN\",\"kullanici_id\":\"42\"}"
    );
    TEST_ASSERT_TRUE(door.type == CommandType::DOOR_OPEN);

    DeviceCommand password = MqttManager::parseCommand(
        "{\"komut_tipi\":\"PASSWORD_RENEW\",\"yeni_liste\":[{\"u\":\"5\",\"p\":\"1234\"}]}"
    );
    TEST_ASSERT_TRUE(password.type == CommandType::PASSWORD_RENEW);
    TEST_ASSERT_TRUE(password.newPasswordListJson.find("1234") != std::string::npos);
}

void test_parse_invalid_command(void) {
    TEST_ASSERT_TRUE(
        MqttManager::parseCommand("gecersiz-json").type == CommandType::UNKNOWN
    );
    TEST_ASSERT_TRUE(
        MqttManager::parseCommand("{\"komut_tipi\":\"BILINMEYEN\"}").type
        == CommandType::UNKNOWN
    );
}

void test_parse_firmware_update(void) {
    DeviceCommand ota = MqttManager::parseCommand(
        "{\"komut_tipi\":\"FIRMWARE_UPDATE\","
        "\"firmware_url\":\"http://server/api/firmware/download/app.bin\","
        "\"firmware_versiyon\":\"1.1.0\","
        "\"firmware_md5\":\"0123456789abcdef0123456789abcdef\","
        "\"firmware_boyut\":1050000,\"force\":true}"
    );

    TEST_ASSERT_TRUE(ota.type == CommandType::FIRMWARE_UPDATE);
    TEST_ASSERT_EQUAL_STRING("1.1.0", ota.firmwareVersion.c_str());
    TEST_ASSERT_EQUAL_STRING(
        "0123456789abcdef0123456789abcdef",
        ota.firmwareMd5.c_str()
    );
    TEST_ASSERT_EQUAL_UINT32(1050000, ota.firmwareSize);
    TEST_ASSERT_TRUE(ota.forceFirmwareUpdate);
}

static int runAllTests() {
    UNITY_BEGIN();
    RUN_TEST(test_topics);
    RUN_TEST(test_serialize_card_request);
    RUN_TEST(test_serialize_pin_request);
    RUN_TEST(test_serialize_offline_result);
    RUN_TEST(test_parse_access_response);
    RUN_TEST(test_parse_other_commands);
    RUN_TEST(test_parse_invalid_command);
    RUN_TEST(test_parse_firmware_update);
    return UNITY_END();
}

#ifdef ARDUINO
void setup() {
    delay(2000);
    runAllTests();
}

void loop() {}
#else
int main(int argc, char **argv) {
    return runAllTests();
}
#endif
