#include <unity.h>
#include "CardReader.h"

void setUp(void) {}
void tearDown(void) {}

void test_uidToString_gecerli_4_byte(void) {
    uint8_t uid[4] = {0xA1, 0xB2, 0xC3, 0xD4};
    std::string result = CardReader::uidToString(uid, 4);
    TEST_ASSERT_EQUAL_STRING("A1:B2:C3:D4", result.c_str());
}

void test_uidToString_gecerli_7_byte(void) {
    uint8_t uid[7] = {0x04, 0x1A, 0x2B, 0x3C, 0x4D, 0x5E, 0x6F};
    std::string result = CardReader::uidToString(uid, 7);
    TEST_ASSERT_EQUAL_STRING("04:1A:2B:3C:4D:5E:6F", result.c_str());
}

void test_uidToString_cok_kisa_uid_bos_doner(void) {
    uint8_t uid[2] = {0xA1, 0xB2};
    std::string result = CardReader::uidToString(uid, 2);
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

void test_uidToString_cok_uzun_uid_bos_doner(void) {
    uint8_t uid[11] = {0};
    std::string result = CardReader::uidToString(uid, 11);
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

void test_uidGecerliMi_dogru_format(void) {
    TEST_ASSERT_TRUE(CardReader::uidGecerliMi("A1:B2:C3:D4"));
}

void test_uidGecerliMi_kucuk_harf_reddedilir(void) {
    TEST_ASSERT_FALSE(CardReader::uidGecerliMi("a1:b2:c3:d4"));
}

void test_uidGecerliMi_eksik_ayirac_reddedilir(void) {
    TEST_ASSERT_FALSE(CardReader::uidGecerliMi("A1B2C3D4"));
}

void test_uidGecerliMi_bos_string_reddedilir(void) {
    TEST_ASSERT_FALSE(CardReader::uidGecerliMi(""));
}

void test_isDuplicateRead_ayni_uid_kisa_surede_true(void) {
    bool result = CardReader::isDuplicateRead("A1:B2:C3:D4", "A1:B2:C3:D4", 1500, 1000, 1000);
    TEST_ASSERT_TRUE(result);
}

void test_isDuplicateRead_ayni_uid_uzun_surede_false(void) {
    bool result = CardReader::isDuplicateRead("A1:B2:C3:D4", "A1:B2:C3:D4", 5000, 1000, 1000);
    TEST_ASSERT_FALSE(result);
}

void test_isDuplicateRead_farkli_uid_false(void) {
    bool result = CardReader::isDuplicateRead("A1:B2:C3:D4", "FF:FF:FF:FF", 1200, 1000, 1000);
    TEST_ASSERT_FALSE(result);
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_uidToString_gecerli_4_byte);
    RUN_TEST(test_uidToString_gecerli_7_byte);
    RUN_TEST(test_uidToString_cok_kisa_uid_bos_doner);
    RUN_TEST(test_uidToString_cok_uzun_uid_bos_doner);
    RUN_TEST(test_uidGecerliMi_dogru_format);
    RUN_TEST(test_uidGecerliMi_kucuk_harf_reddedilir);
    RUN_TEST(test_uidGecerliMi_eksik_ayirac_reddedilir);
    RUN_TEST(test_uidGecerliMi_bos_string_reddedilir);
    RUN_TEST(test_isDuplicateRead_ayni_uid_kisa_surede_true);
    RUN_TEST(test_isDuplicateRead_ayni_uid_uzun_surede_false);
    RUN_TEST(test_isDuplicateRead_farkli_uid_false);
    return UNITY_END();
}