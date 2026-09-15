# SecureLab Erişim Yönetim Sistemi

RFID kart, geçici PIN, kapı cihazları ve erişim kayıtlarını tek panelden yöneten Docker tabanlı uygulama.

## Hızlı başlangıç

1. Ortam dosyasını oluşturun:

   ```powershell
   Copy-Item .env.example .env
   ```

2. `.env` içindeki geliştirme anahtarlarını ve başlangıç parolalarını kontrol edin.
3. Sistemi başlatın:

   ```powershell
   docker compose up -d --build
   ```

4. Tarayıcıdan `http://localhost:8080` adresini açın.

Frontend aynı adres üzerindeki `/api` yolunu backend servisine yönlendirir. Backend sağlık adresi ayrıca `http://localhost:3000/api/health` üzerinden kullanılabilir.

## Geliştirme kullanıcıları

İlk çalıştırmada aşağıdaki hesaplar oluşturulur:

| Rol | E-posta | Varsayılan parola |
|---|---|---|
| Yönetici | `admin@securelab.local` | `SecureLab2026!` |
| Öğretim görevlisi | `ahmet@subu.edu.tr` | `123456` |

Parolalar `.env` içindeki `SEED_ADMIN_PASSWORD` ve `SEED_HOCA_PASSWORD` değerleriyle değiştirilebilir. Üretim ortamında varsayılan parola ve anahtarları mutlaka değiştirin.

Yönetici hesabı kullanıcı ekleme, silme ve kart yetkilendirme işlemlerine erişen tek hesaptır. Diğer hesaplar yönetici rolüne yükseltilmez.

## Şifre sıfırlama ve QR arıza formu

- "Şifremi unuttum" bağlantısının e-posta gönderebilmesi için `.env` dosyasındaki SMTP ayarlarını doldurun.
- Yerel geliştirmede sıfırlama bağlantısı ekranda gösterilebilir; üretimde yalnızca e-posta ile gönderilir ve 15 dakika geçerlidir.
- Telefonla okutulacak kalıcı QR adresini `PUBLIC_ISSUE_URL` ile HTTPS kullanan, ağdan erişilebilir bir alan adına ayarlayın.
- `localhost` adresi yalnızca aynı bilgisayarda çalışır; telefondan açılamaz.

## Servisler

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- MQTT: `localhost:1883`

Servis durumunu görmek için:

```powershell
docker compose ps
```

Sistemi durdurmak için:

```powershell
docker compose down
```

## ESP32 yapılandırması

1. `esp32-kodlar/include/config.local.example.h` dosyasını `config.local.h` adıyla kopyalayın.
2. Wi-Fi, backend IP adresi, MQTT adresi, cihaz/kapı kimlikleri ve pinleri kendi donanımınıza göre düzenleyin.
3. `ESP32_SECRET_KEY` değeri `.env` içindeki `DEVICE_SECRET` ile aynı olmalıdır.
4. PlatformIO ile `esp32-kodlar` klasörünü derleyip karta yükleyin.

`config.local.h` gizli bilgiler içerdiği için Git tarafından izlenmez.

## Güvenlik ve roller

- Yönetici kullanıcı, kart yetkilendirme ve uzaktan kapı açma işlemlerini yapabilir.
- Öğretim görevlisi sistem durumunu, geçmiş kayıtları ve kendi geçici PIN işlemini kullanabilir.
- Korunan bir sayfaya oturumsuz erişim giriş ekranına yönlendirilir.
- Kapı cihazları web kullanıcı tokenı yerine `X-Device-Key` başlığıyla doğrulanır.
- Web parolası ve kapı PIN’i ayrı hash alanlarında saklanır.
