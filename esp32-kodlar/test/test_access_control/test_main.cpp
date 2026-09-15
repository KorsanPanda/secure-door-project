#include <unity.h>
#include "AccessControl.h"

void setUp(void) {}
void tearDown(void) {}

void test_dogru_pin_kullanici_id_donduruyor(void) {
    std::string jsonList = "[{\"u\":\"5\",\"p\":\"1234\"},{\"u\":\"7\",\"p\":\"5678\"}]";
    std::string result = AccessControl::findUserByOfflinePin(jsonList, "1234");
    TEST_ASSERT_EQUAL_STRING("5", result.c_str());
}

void test_ikinci_kullanicinin_pini_de_bulunuyor(void) {
    std::string jsonList = "[{\"u\":\"5\",\"p\":\"1234\"},{\"u\":\"7\",\"p\":\"5678\"}]";
    std::string result = AccessControl::findUserByOfflinePin(jsonList, "5678");
    TEST_ASSERT_EQUAL_STRING("7", result.c_str());
}

void test_yanlis_pin_bos_string_donduruyor(void) {
    std::string jsonList = "[{\"u\":\"5\",\"p\":\"1234\"}]";
    std::string result = AccessControl::findUserByOfflinePin(jsonList, "9999");
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

void test_bos_liste_bos_string_donduruyor(void) {
    std::string result = AccessControl::findUserByOfflinePin("[]", "1234");
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

void test_gecersiz_json_bos_string_donduruyor(void) {
    std::string result = AccessControl::findUserByOfflinePin("gecersiz-json", "1234");
    TEST_ASSERT_EQUAL_STRING("", result.c_str());
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_dogru_pin_kullanici_id_donduruyor);
    RUN_TEST(test_ikinci_kullanicinin_pini_de_bulunuyor);
    RUN_TEST(test_yanlis_pin_bos_string_donduruyor);
    RUN_TEST(test_bos_liste_bos_string_donduruyor);
    RUN_TEST(test_gecersiz_json_bos_string_donduruyor);
    return UNITY_END();
}
