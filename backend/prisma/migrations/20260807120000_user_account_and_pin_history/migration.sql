CREATE TABLE "kapi_sifre_gecmisi" (
    "kapiSifreId" BIGSERIAL NOT NULL,
    "kullaniciId" BIGINT NOT NULL,
    "pinSifreli" TEXT NOT NULL,
    "kaynak" VARCHAR(32) NOT NULL DEFAULT 'kullanici',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturulma" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gecerlilikBitis" TIMESTAMPTZ,

    CONSTRAINT "kapi_sifre_gecmisi_pkey" PRIMARY KEY ("kapiSifreId")
);

CREATE INDEX "kapi_sifre_gecmisi_kullaniciId_aktif_idx"
ON "kapi_sifre_gecmisi"("kullaniciId", "aktif");

CREATE INDEX "kapi_sifre_gecmisi_kullaniciId_olusturulma_idx"
ON "kapi_sifre_gecmisi"("kullaniciId", "olusturulma");

ALTER TABLE "kapi_sifre_gecmisi"
ADD CONSTRAINT "kapi_sifre_gecmisi_kullaniciId_fkey"
FOREIGN KEY ("kullaniciId") REFERENCES "kullanici"("kullaniciId")
ON DELETE CASCADE ON UPDATE CASCADE;
