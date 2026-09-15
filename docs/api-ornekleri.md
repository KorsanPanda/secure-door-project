# API Örnekleri

Bu doküman, backend'deki tüm endpoint'lerin gerçek (seed edilmiş test verisiyle üretilmiş) örnek response'larını içerir. Amaç: 5. Kişi'nin (Frontend) mock veri yazarken gerçek JSON formatına birebir uyumlu ilerleyebilmesi.

Taban adres: `http://localhost:3000`

Genel not: Tüm `BigInt` alanlar (`kullaniciId`, `kartId`, `kayitId` vb.) JSON'a **string** olarak serileştirilir (örn. `"kullaniciId": "1"`), `Int` alanlar (`birimId`, `kapiId`, `cihazId` vb.) ise düz sayı olarak kalır. Frontend tarafında bu ayrıma dikkat edilmeli.

---

## `GET /`

Sağlık kontrolü.

```json
{ "message": "Backend, Prisma ORM ve PostgreSQL veritabanı ile aktif olarak çalışıyor!" }
```

---

## `GET /api/birimler`

```json
[
  {
    "birimId": 1,
    "kod": "CENG",
    "ad": "Bilgisayar Mühendisliği",
    "aktif": true
  }
]
```

---

## `GET /api/kullanicilar`

**Query parametreleri:** `durum` (aktif/pasif/askida), `rol` (hoca/admin/sistem) — isteğe bağlı filtreler.

```json
[
  {
    "kullaniciId": "1",
    "ad": "Gregory",
    "soyad": "Gerhold",
    "eposta": "Philip_Johnston@yahoo.com",
    "birimId": 1,
    "durum": "aktif",
    "rol": "hoca",
    "pinHash": null,
    "pinSonDegisim": null,
    "pinGecerlilikBitis": null,
    "olusturmaTamani": "2026-07-24T08:05:10.417Z",
    "guncellemeTamani": "2026-07-24T08:05:10.417Z",
    "birim": {
      "birimId": 1,
      "kod": "CENG",
      "ad": "Bilgisayar Mühendisliği",
      "aktif": true
    }
  }
]
```

**Hata durumu:** DB'ye erişilemezse `500` → `{ "hata": "Sunucu hatası" }`

## `GET /api/kullanicilar/:id`

Aynı şekli tek bir obje olarak döner. `id` sayısal değilse veya kullanıcı yoksa: `404` → `{ "hata": "Kullanıcı bulunamadı" }`

---

## `GET /api/kartlar`

```json
[
  {
    "kartId": "1",
    "kartUid": "A0:B0:C0:D0",
    "durum": "aktif",
    "verilicTarihi": "2026-07-24T00:00:00.000Z",
    "iptalTarihi": null,
    "iptalNedeni": null
  }
]
```

---

## `GET /api/kart-yetkilendirmeler`

```json
[
  {
    "kartYetkiId": "1",
    "kartUid": "A0:B0:C0:D0",
    "kullaniciId": "1",
    "birimId": 1,
    "durum": "aktif",
    "yetkilendirilmeTarihi": "2025-07-26T19:32:38.347Z",
    "yetkilendiren": null,
    "notlar": "Seed ile oluşturuldu",
    "sonKullanilmaTarihi": null,
    "kullanici": { "kullaniciId": "1", "ad": "Gregory", "soyad": "Gerhold", "...": "..." },
    "birim": { "birimId": 1, "kod": "CENG", "ad": "Bilgisayar Mühendisliği", "aktif": true }
  }
]
```

---

## `GET /api/kapilar`

```json
[
  {
    "kapiId": 1,
    "ad": "Laboratuvar Kapısı",
    "bina": "A",
    "kat": 2,
    "aciklama": "Bilgisayar Lab",
    "durum": "aktif"
  }
]
```

`GET /api/kapilar/:id` aynı şekli tek obje olarak döner; yoksa `404`.

---

## `GET /api/cihazlar`

```json
[
  {
    "cihazId": 1,
    "seriNo": "ESP32-LAB-001",
    "durum": "aktif",
    "kurulumuTarihi": "2026-07-24T00:00:00.000Z"
  }
]
```

---

## `GET /api/cihaz-kapi-atamalar`

```json
[
  {
    "atamaId": "1",
    "cihazId": 1,
    "kapiId": 1,
    "baslangic": "2026-07-24T08:05:10.553Z",
    "bitis": null,
    "cihaz": { "cihazId": 1, "seriNo": "ESP32-LAB-001", "durum": "aktif", "kurulumuTarihi": "2026-07-24T00:00:00.000Z" },
    "kapi": { "kapiId": 1, "ad": "Laboratuvar Kapısı", "bina": "A", "kat": 2, "aciklama": "Bilgisayar Lab", "durum": "aktif" }
  }
]
```

---

## `GET /api/cihaz-durumlari`

```json
[
  {
    "cihazDurumuId": "1",
    "cihazId": 1,
    "kapiDurumu": "kapali",
    "cihazDurumTip": "cevrimici",
    "bataryaSeviyesi": 85,
    "wifiSignali": -55,
    "firmwareVersiyon": "1.0.0",
    "bellekKullanimi": null,
    "kapiAcilmaSayaci": null,
    "kapiAcilmaSuresi": null,
    "sonHeartbeat": "2026-07-24T08:05:10.557Z",
    "guncellenmeTarihi": "2026-07-24T08:05:10.557Z"
  }
]
```

---

## `GET /api/erisim-kayitlari`

**Query parametreleri:** `limit` (varsayılan 10), `offset` (varsayılan 0). *(Not: Planda istenen tarih aralığı filtresi henüz eklenmedi — bkz. eksikler listesi.)*

Örnek istek: `GET /api/erisim-kayitlari?limit=3`

```json
[
  {
    "kayitId": "11",
    "cihazOlayId": "c6ac6236-4094-45b2-ab0c-931e24327651d",
    "cihazId": 1,
    "kapiId": 1,
    "kullaniciId": "3",
    "kartId": "5",
    "okunanUid": "A4:B4:C4:D4",
    "dogrulamaYontemi": "kart",
    "sonuc": "izin",
    "redNedeni": null,
    "olayTamani": "2026-07-23T00:36:24.148Z",
    "kayitTamani": "2026-07-24T08:05:10.597Z",
    "cihaz": { "cihazId": 1, "seriNo": "ESP32-LAB-001", "durum": "aktif", "...": "..." },
    "kapi": { "kapiId": 1, "ad": "Laboratuvar Kapısı", "...": "..." },
    "kullanici": { "kullaniciId": "3", "ad": "Moses", "soyad": "Fisher", "...": "..." }
  }
]
```

---

## `GET /api/ihlal-kayitlari`

Seed hiç ihlal kaydı oluşturmadığı için şu an boş dizi döner (hatasız):

```json
[]
```

**Beklenen şekil** (şemadan): `{ "ihlalId": "1", "kullaniciId": "1", "tarih": "...", "tur": "cikis_kacirma", "aciklama": null, "olusturmaTamani": "...", "kullanici": { ... } }`

---

## `GET /api/gruplar`

Seed henüz grup verisi oluşturmadığı için şu an boş dizi döner (hatasız):

```json
[]
```

**Beklenen şekil** (şemadan, üye sayısıyla birlikte):

```json
[
  { "grupId": 1, "ad": "Örnek Grup", "aciklama": null, "aktif": true, "uyeSayisi": 0 }
]
```

`GET /api/gruplar/:id` tek grubu, üyeleriyle (`uyeler: [{ kullanici: {...} }]`) birlikte döner.

---

## Genel hata formatı

Tüm endpoint'ler aynı deseni kullanır:

- Kayıt bulunamadı → `404` → `{ "hata": "<Kaynak adı> bulunamadı" }`
- Sunucu/veritabanı hatası → `500` → `{ "hata": "Sunucu hatası" }`
- Geçersiz ID (bazı endpoint'lerde) → `400` → `{ "hata": "Geçersiz ... ID" }`

---

## Bilinen eksikler / henüz yapılmamış olanlar

- `GET /api/kullanicilar` şu an sadece `durum`/`rol` filtreliyor; plandaki `birim` filtresi yok.
- `GET /api/kullanicilar/:id` kartları/gruplarını/son erişim kayıtlarını include etmiyor, sadece `birim`.
- `GET /api/erisim-kayitlari` tarih aralığı filtresi desteklemiyor, sadece `limit`/`offset`.
- Genel olarak route'larda input validasyonu sınırlı (çoğu sadece `parseInt` yapıyor, formatı doğrulamıyor).
