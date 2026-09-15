ALTER TABLE "kapi_sifre_gecmisi"
ALTER COLUMN "pinSifreli" DROP NOT NULL;

ALTER TABLE "kapi_sifre_gecmisi"
ADD COLUMN "pinHash" VARCHAR(255);

INSERT INTO "kapi_sifre_gecmisi" (
    "kullaniciId",
    "pinSifreli",
    "pinHash",
    "kaynak",
    "aktif",
    "olusturulma",
    "gecerlilikBitis"
)
SELECT
    k."kullaniciId",
    NULL,
    k."pinHash",
    'eski_kayit',
    true,
    COALESCE(k."pinSonDegisim", k."guncellemeTamani", CURRENT_TIMESTAMP),
    k."pinGecerlilikBitis"
FROM "kullanici" k
WHERE k."pinHash" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM "kapi_sifre_gecmisi" g
      WHERE g."kullaniciId" = k."kullaniciId"
  );
