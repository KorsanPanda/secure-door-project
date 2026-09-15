#include <unity.h>
#include "DoorState.h"

void setUp(void) {}
void tearDown(void) {}

void test_beklemeden_herseye_gecis_izinli(void) {
    TEST_ASSERT_TRUE(DoorState::gecisIzinliMi(Durum::BEKLEMEDE, Durum::OKUNUYOR));
    TEST_ASSERT_TRUE(DoorState::gecisIzinliMi(Durum::BEKLEMEDE, Durum::ONAYLANDI));
    TEST_ASSERT_TRUE(DoorState::gecisIzinliMi(Durum::BEKLEMEDE, Durum::ALARM));
}

void test_okunuyordan_okunuyora_gecis_yasak(void) {
    TEST_ASSERT_FALSE(DoorState::gecisIzinliMi(Durum::OKUNUYOR, Durum::OKUNUYOR));
}

void test_okunuyordan_diger_durumlara_gecis_izinli(void) {
    TEST_ASSERT_TRUE(DoorState::gecisIzinliMi(Durum::OKUNUYOR, Durum::ONAYLANDI));
    TEST_ASSERT_TRUE(DoorState::gecisIzinliMi(Durum::OKUNUYOR, Durum::REDDEDILDI));
    TEST_ASSERT_TRUE(DoorState::gecisIzinliMi(Durum::OKUNUYOR, Durum::BEKLEMEDE));
}

void test_onaylandidan_sadece_beklemeye_gecis_izinli(void) {
    TEST_ASSERT_TRUE(DoorState::gecisIzinliMi(Durum::ONAYLANDI, Durum::BEKLEMEDE));
    TEST_ASSERT_FALSE(DoorState::gecisIzinliMi(Durum::ONAYLANDI, Durum::OKUNUYOR));
    TEST_ASSERT_FALSE(DoorState::gecisIzinliMi(Durum::ONAYLANDI, Durum::REDDEDILDI));
}

void test_reddedildiden_sadece_beklemeye_gecis_izinli(void) {
    TEST_ASSERT_TRUE(DoorState::gecisIzinliMi(Durum::REDDEDILDI, Durum::BEKLEMEDE));
    TEST_ASSERT_FALSE(DoorState::gecisIzinliMi(Durum::REDDEDILDI, Durum::ONAYLANDI));
}

void test_alarmdan_sadece_beklemeye_gecis_izinli(void) {
    TEST_ASSERT_TRUE(DoorState::gecisIzinliMi(Durum::ALARM, Durum::BEKLEMEDE));
    TEST_ASSERT_FALSE(DoorState::gecisIzinliMi(Durum::ALARM, Durum::ONAYLANDI));
}

void test_durumMetni_dogru_metinleri_donuyor(void) {
    TEST_ASSERT_EQUAL_STRING("BEKLEMEDE", DoorState::durumMetni(Durum::BEKLEMEDE));
    TEST_ASSERT_EQUAL_STRING("OKUNUYOR", DoorState::durumMetni(Durum::OKUNUYOR));
    TEST_ASSERT_EQUAL_STRING("ONAYLANDI", DoorState::durumMetni(Durum::ONAYLANDI));
    TEST_ASSERT_EQUAL_STRING("REDDEDILDI", DoorState::durumMetni(Durum::REDDEDILDI));
    TEST_ASSERT_EQUAL_STRING("ALARM", DoorState::durumMetni(Durum::ALARM));
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_beklemeden_herseye_gecis_izinli);
    RUN_TEST(test_okunuyordan_okunuyora_gecis_yasak);
    RUN_TEST(test_okunuyordan_diger_durumlara_gecis_izinli);
    RUN_TEST(test_onaylandidan_sadece_beklemeye_gecis_izinli);
    RUN_TEST(test_reddedildiden_sadece_beklemeye_gecis_izinli);
    RUN_TEST(test_alarmdan_sadece_beklemeye_gecis_izinli);
    RUN_TEST(test_durumMetni_dogru_metinleri_donuyor);
    return UNITY_END();
}