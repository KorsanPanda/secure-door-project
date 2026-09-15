# MQTT Topic Dokümantasyonu

Broker: Görev 1.4'te kurulacak (ör. Mosquitto / EMQX)
QoS: Tüm topic'lerde QoS 1 kullanılır (en az bir kez teslim).

## Sunucu -> Cihaz (Backend publish eder, ESP32 dinler)

| Topic                              | Yön              | Payload Örneği                                                                 | Açıklama |
|-------------------------------------|------------------|----------------------------------------------------------------------------------|----------|
| `kapi/<cihazId>/komut`              | sunucu -> cihaz  | `{ "komut": "kilitle" }`                                                          | Genel kapı komutları (kilitle/aç vb.) |
| `kapi/<cihazId>/sifre-guncelleme`   | sunucu -> cihaz  | `{ "cihazId": 12, "pin": "482913", "gecerlilikBitis": "2026-07-25T00:00:00Z" }`   | Günlük/manuel şifre güncelleme |
| `kapi/<cihazId>/erisim-yanit`       | sunucu -> cihaz  | `{ "istekId": "abc123", "onay": true }`                                           | Erişim isteğine sunucu yanıtı |

## Cihaz -> Sunucu (ESP32 publish eder, backend dinler)

| Topic                          | Yön              | Payload Örneği                                                          | Açıklama |
|----------------------------------|------------------|----------------------------------------------------------------------------|----------|
| `kapi/<cihazId>/durum`           | cihaz -> sunucu  | `{ "kapiDurumu": "kapali", "kilitDurumu": "kilitli", "zaman": "..." }`     | Kapı/kilit durum bildirimi -> `CihazDurumu` tablosu |
| `kapi/<cihazId>/saglik`         | cihaz -> sunucu  | `{ "batarya": 87, "sinyal": -62 }`                                         | Heartbeat / sağlık bilgisi -> `Cihaz` tablosu güncellenir |
| `kapi/<cihazId>/erisim-istek`   | cihaz -> sunucu  | `{ "istekId": "abc123", "girilenPin": "482913", "sonuc": "basarili" }`     | PIN girişi denemesi -> `Olay` tablosuna loglanır |

## Notlar
- `<cihazId>` tüm topic'lerde sayısal cihaz ID'sidir (Prisma `Cihaz.cihazId`).
- Wildcard subscribe: backend `kapi/+/durum`, `kapi/+/saglik`, `kapi/+/erisim-istek` şeklinde tek seferde tüm cihazlara abone olur.
- Broker bağlantı bilgileri `.env` üzerinden `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` ile sağlanır.