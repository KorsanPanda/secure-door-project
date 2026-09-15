ALTER TABLE "kullanici"
ADD COLUMN "oturumSurumu" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "web_sifre_sifirlama" (
    "sifirlamaId" BIGSERIAL NOT NULL,
    "kullaniciId" BIGINT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "gecerlilikBitis" TIMESTAMPTZ NOT NULL,
    "kullanildi" TIMESTAMPTZ,
    "iptal" BOOLEAN NOT NULL DEFAULT false,
    "talepIp" VARCHAR(64),
    "olusturulma" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "web_sifre_sifirlama_pkey" PRIMARY KEY ("sifirlamaId")
);

CREATE UNIQUE INDEX "web_sifre_sifirlama_tokenHash_key"
ON "web_sifre_sifirlama"("tokenHash");

CREATE INDEX "web_sifre_sifirlama_kullaniciId_olusturulma_idx"
ON "web_sifre_sifirlama"("kullaniciId", "olusturulma");

CREATE INDEX "web_sifre_sifirlama_gecerlilikBitis_iptal_idx"
ON "web_sifre_sifirlama"("gecerlilikBitis", "iptal");

ALTER TABLE "web_sifre_sifirlama"
ADD CONSTRAINT "web_sifre_sifirlama_kullaniciId_fkey"
FOREIGN KEY ("kullaniciId") REFERENCES "kullanici"("kullaniciId")
ON DELETE CASCADE ON UPDATE CASCADE;
