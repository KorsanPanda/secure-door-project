-- CreateTable
CREATE TABLE "birim" (
    "birimId" SERIAL NOT NULL,
    "kod" VARCHAR(16) NOT NULL,
    "ad" VARCHAR(128) NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "birim_pkey" PRIMARY KEY ("birimId")
);

-- CreateTable
CREATE TABLE "kullanici" (
    "kullaniciId" BIGSERIAL NOT NULL,
    "ad" VARCHAR(64) NOT NULL,
    "soyad" VARCHAR(64) NOT NULL,
    "eposta" VARCHAR(128),
    "birimId" INTEGER,
    "durum" VARCHAR(16) NOT NULL DEFAULT 'aktif',
    "rol" VARCHAR(16) NOT NULL DEFAULT 'hoca',
    "olusturmaTamani" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTamani" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "kullanici_pkey" PRIMARY KEY ("kullaniciId")
);

-- CreateTable
CREATE TABLE "kart" (
    "kartId" BIGSERIAL NOT NULL,
    "kartUid" VARCHAR(29) NOT NULL,
    "durum" VARCHAR(16) NOT NULL DEFAULT 'aktif',
    "verilicTarihi" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iptalTarihi" DATE,
    "iptalNedeni" VARCHAR(128),

    CONSTRAINT "kart_pkey" PRIMARY KEY ("kartId")
);

-- CreateTable
CREATE TABLE "kart_yetkilendirme" (
    "kartYetkiId" BIGSERIAL NOT NULL,
    "kartUid" VARCHAR(29) NOT NULL,
    "kullaniciId" BIGINT NOT NULL,
    "birimId" INTEGER,
    "durum" VARCHAR(16) NOT NULL DEFAULT 'aktif',
    "yetkilendirilmeTarihi" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yetkilendiren" BIGINT,
    "notlar" TEXT,
    "sonKullanilmaTarihi" TIMESTAMPTZ,

    CONSTRAINT "kart_yetkilendirme_pkey" PRIMARY KEY ("kartYetkiId")
);

-- CreateTable
CREATE TABLE "kapi" (
    "kapiId" SERIAL NOT NULL,
    "ad" VARCHAR(64) NOT NULL,
    "bina" VARCHAR(64),
    "kat" INTEGER,
    "aciklama" VARCHAR(256),
    "durum" VARCHAR(16) NOT NULL DEFAULT 'aktif',

    CONSTRAINT "kapi_pkey" PRIMARY KEY ("kapiId")
);

-- CreateTable
CREATE TABLE "cihaz" (
    "cihazId" SERIAL NOT NULL,
    "seriNo" VARCHAR(64) NOT NULL,
    "durum" VARCHAR(16) NOT NULL DEFAULT 'aktif',
    "kurulumuTarihi" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cihaz_pkey" PRIMARY KEY ("cihazId")
);

-- CreateTable
CREATE TABLE "cihaz_kapi_atama" (
    "atamaId" BIGSERIAL NOT NULL,
    "cihazId" INTEGER NOT NULL,
    "kapiId" INTEGER NOT NULL,
    "baslangic" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bitis" TIMESTAMPTZ,

    CONSTRAINT "cihaz_kapi_atama_pkey" PRIMARY KEY ("atamaId")
);

-- CreateTable
CREATE TABLE "cihaz_durumu" (
    "cihazDurumuId" BIGSERIAL NOT NULL,
    "cihazId" INTEGER NOT NULL,
    "kapiDurumu" VARCHAR(16) NOT NULL,
    "cihazDurumTip" VARCHAR(16) NOT NULL,
    "bataryaSeviyesi" INTEGER,
    "wifiSignali" INTEGER,
    "firmwareVersiyon" VARCHAR(32),
    "bellekKullanimi" INTEGER,
    "kapiAcilmaSayaci" INTEGER,
    "kapiAcilmaSuresi" INTEGER,
    "sonHeartbeat" TIMESTAMPTZ,
    "guncellenmeTarihi" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cihaz_durumu_pkey" PRIMARY KEY ("cihazDurumuId")
);

-- CreateTable
CREATE TABLE "erisim_kaydi" (
    "kayitId" BIGINT NOT NULL,
    "cihazOlayId" UUID NOT NULL,
    "cihazId" INTEGER NOT NULL,
    "kapiId" INTEGER NOT NULL,
    "kullaniciId" BIGINT,
    "kartId" BIGINT,
    "okunanUid" VARCHAR(29),
    "dogrulamaYontemi" VARCHAR(8) NOT NULL,
    "sonuc" VARCHAR(8) NOT NULL,
    "redNedeni" VARCHAR(32),
    "olayTamani" TIMESTAMPTZ NOT NULL,
    "kayitTamani" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erisim_kaydi_pkey" PRIMARY KEY ("kayitId","olayTamani")
);

-- CreateTable
CREATE TABLE "ihlal_kaydi" (
    "ihlalId" BIGSERIAL NOT NULL,
    "kullaniciId" BIGINT NOT NULL,
    "tarih" DATE NOT NULL,
    "tur" VARCHAR(32) NOT NULL,
    "aciklama" TEXT,
    "olusturmaTamani" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ihlal_kaydi_pkey" PRIMARY KEY ("ihlalId")
);

-- CreateTable
CREATE TABLE "ariza_bildirimi" (
    "arizaId" SERIAL NOT NULL,
    "bildiren" VARCHAR(128) NOT NULL DEFAULT 'Anonim',
    "arizaTuru" VARCHAR(64) NOT NULL,
    "aciklama" VARCHAR(512) NOT NULL,
    "durum" VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    "olusturulma" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ariza_bildirimi_pkey" PRIMARY KEY ("arizaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "birim_kod_key" ON "birim"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "kart_kartUid_key" ON "kart"("kartUid");

-- CreateIndex
CREATE UNIQUE INDEX "kart_yetkilendirme_kartUid_key" ON "kart_yetkilendirme"("kartUid");

-- CreateIndex
CREATE UNIQUE INDEX "cihaz_seriNo_key" ON "cihaz"("seriNo");

-- CreateIndex
CREATE UNIQUE INDEX "erisim_kaydi_cihazOlayId_key" ON "erisim_kaydi"("cihazOlayId");

-- AddForeignKey
ALTER TABLE "kullanici" ADD CONSTRAINT "kullanici_birimId_fkey" FOREIGN KEY ("birimId") REFERENCES "birim"("birimId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kart_yetkilendirme" ADD CONSTRAINT "kart_yetkilendirme_kartUid_fkey" FOREIGN KEY ("kartUid") REFERENCES "kart"("kartUid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kart_yetkilendirme" ADD CONSTRAINT "kart_yetkilendirme_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanici"("kullaniciId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kart_yetkilendirme" ADD CONSTRAINT "kart_yetkilendirme_birimId_fkey" FOREIGN KEY ("birimId") REFERENCES "birim"("birimId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cihaz_kapi_atama" ADD CONSTRAINT "cihaz_kapi_atama_cihazId_fkey" FOREIGN KEY ("cihazId") REFERENCES "cihaz"("cihazId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cihaz_kapi_atama" ADD CONSTRAINT "cihaz_kapi_atama_kapiId_fkey" FOREIGN KEY ("kapiId") REFERENCES "kapi"("kapiId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cihaz_durumu" ADD CONSTRAINT "cihaz_durumu_cihazId_fkey" FOREIGN KEY ("cihazId") REFERENCES "cihaz"("cihazId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erisim_kaydi" ADD CONSTRAINT "erisim_kaydi_cihazId_fkey" FOREIGN KEY ("cihazId") REFERENCES "cihaz"("cihazId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erisim_kaydi" ADD CONSTRAINT "erisim_kaydi_kapiId_fkey" FOREIGN KEY ("kapiId") REFERENCES "kapi"("kapiId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erisim_kaydi" ADD CONSTRAINT "erisim_kaydi_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanici"("kullaniciId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erisim_kaydi" ADD CONSTRAINT "erisim_kaydi_kartId_fkey" FOREIGN KEY ("kartId") REFERENCES "kart"("kartId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ihlal_kaydi" ADD CONSTRAINT "ihlal_kaydi_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanici"("kullaniciId") ON DELETE RESTRICT ON UPDATE CASCADE;
