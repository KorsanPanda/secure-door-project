# HTTP OTA + MQTT tetikleme

Bu akışta MQTT yalnızca güncelleme komutunu taşır. ESP32, komuttaki kısa
ömürlü URL üzerinden firmware dosyasını backend'den indirir, MD5 değerini
doğrular, OTA bölümüne yazar ve yalnızca başarılı yazımdan sonra yeniden
başlar.

## Bir defalık ilk kurulum

OTA desteğini içeren firmware cihaza ilk kez USB/PlatformIO üzerinden
yüklenmelidir. Bundan sonraki sürümler uzaktan gönderilebilir.

## Sunucu ayarları

`.env` içinde aşağıdaki değerleri gerçek sunucu bilgileriyle ayarlayın:

```env
FIRMWARE_PUBLIC_BASE_URL=http://SUNUCU_IP_VEYA_DOMAIN:3000
OTA_SIGNING_SECRET=uzun-rastgele-ve-gizli-bir-deger
OTA_URL_TTL_SECONDS=900
```

`FIRMWARE_PUBLIC_BASE_URL`, ESP32'nin bulunduğu ağdan erişilebilir olmalıdır.
`localhost` veya Docker servis adı uzaktaki ESP32 için kullanılamaz.

## Yeni firmware hazırlama

1. `esp32-kodlar/include/FirmwareVersion.h` içindeki sürümü artırın. Cihaza
   özel yapı kullanılıyorsa aynı tanım `config.local.h` içine yazılabilir.
2. Firmware'i derleyin:

   ```powershell
   platformio run --environment esp32dev
   ```

3. OTA'ya yüklenecek dosya şudur:

   ```text
   esp32-kodlar/.pio/build/esp32dev/firmware.bin
   ```

Bootloader veya birleştirilmiş flash imajı OTA endpointine yüklenmemelidir.

## Firmware'i backend'e yükleme

Önce `/api/auth/login` üzerinden alınan yönetici JWT tokenını kullanın:

```powershell
$headers = @{ Authorization = "Bearer JWT_TOKEN" }
Invoke-RestMethod `
  -Method Post `
  -Uri "http://SUNUCU:3000/api/firmware/upload?version=1.1.0" `
  -Headers $headers `
  -ContentType "application/octet-stream" `
  -InFile "esp32-kodlar/.pio/build/esp32dev/firmware.bin"
```

Backend dosyanın ESP32 imajı olduğunu kontrol eder ve MD5/SHA-256 değerlerini
üretir. Dosyalar Docker dışında `backend/firmware` klasöründe kalıcı tutulur.

## Cihaza OTA komutu gönderme

```http
POST /api/firmware/cihaz/1/guncelle
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "version": "1.1.0",
  "force": false
}
```

Backend aşağıdaki MQTT konusuna komut yollar:

```text
kapi/1/firmware-guncelle
```

Komut; firmware URL, sürüm, boyut ve MD5 değerini içerir. İndirme URL'si
cihaz kimliğine bağlıdır ve varsayılan olarak 15 dakika sonra geçersiz olur.

ESP32 yalnızca aşağıdaki şartlarda OTA'yı başlatır:

- Wi-Fi ve MQTT bağlı,
- fiziksel kapı kapalı,
- sistem bekleme durumunda,
- devam eden erişim isteği veya kapı alarmı yok,
- firmware OTA bölümüne sığıyor.

Durum mesajları şu MQTT konusunda yayınlanır:

```text
kapi/1/ota-durum
```

Olası durumlar: `BASLADI`, `BASARILI`, `HATA`, `GUNCEL`.

## Güvenlik notu

Bu uygulama talep edildiği gibi düz HTTP kullanır. Genel internet üzerinden
üretim kullanımında firmware içeriğinin ağ üzerinde değiştirilmesini
engellemek için sonraki adım HTTPS sertifika doğrulaması veya imzalı firmware
doğrulaması olmalıdır. MQTT broker için de kullanıcı/parola ve TLS önerilir.
