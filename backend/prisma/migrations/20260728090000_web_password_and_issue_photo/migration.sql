ALTER TABLE "kullanici"
ADD COLUMN "sifreHash" VARCHAR(255),
ADD COLUMN "sifreGecerlilikBitis" TIMESTAMPTZ;

UPDATE "kullanici"
SET "sifreHash" = "pinHash"
WHERE "sifreHash" IS NULL;

ALTER TABLE "ariza_bildirimi"
ADD COLUMN "fotografAdi" VARCHAR(128),
ADD COLUMN "fotografVerisi" TEXT;
