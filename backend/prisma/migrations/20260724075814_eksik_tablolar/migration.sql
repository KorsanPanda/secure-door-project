-- CreateTable
CREATE TABLE "grup" (
    "grupId" SERIAL NOT NULL,
    "ad" VARCHAR(128) NOT NULL,
    "aciklama" VARCHAR(256),
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "grup_pkey" PRIMARY KEY ("grupId")
);

-- CreateTable
CREATE TABLE "kullanici_grup" (
    "kullaniciGrupId" BIGSERIAL NOT NULL,
    "kullaniciId" BIGINT NOT NULL,
    "grupId" INTEGER NOT NULL,
    "eklenmeTarihi" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kullanici_grup_pkey" PRIMARY KEY ("kullaniciGrupId")
);

-- CreateTable
CREATE TABLE "yetki_kurali" (
    "yetkiKuraliId" BIGSERIAL NOT NULL,
    "grupId" INTEGER,
    "kullaniciId" BIGINT,
    "kapiId" INTEGER NOT NULL,
    "gunMaskesi" INTEGER NOT NULL,
    "saatBaslangic" VARCHAR(5) NOT NULL,
    "saatBitis" VARCHAR(5) NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "olusturmaTamani" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yetki_kurali_pkey" PRIMARY KEY ("yetkiKuraliId")
);

-- CreateTable
CREATE TABLE "olay" (
    "olayId" BIGSERIAL NOT NULL,
    "tur" VARCHAR(32) NOT NULL,
    "kaynak" VARCHAR(16) NOT NULL,
    "cihazId" INTEGER,
    "kapiId" INTEGER,
    "kullaniciId" BIGINT,
    "detay" JSONB,
    "olayTamani" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "olay_pkey" PRIMARY KEY ("olayId")
);

-- CreateTable
CREATE TABLE "denetim_kaydi" (
    "denetimId" BIGSERIAL NOT NULL,
    "islemYapan" BIGINT,
    "islemTuru" VARCHAR(32) NOT NULL,
    "tabloAdi" VARCHAR(64) NOT NULL,
    "kayitId" VARCHAR(64),
    "eskiDeger" JSONB,
    "yeniDeger" JSONB,
    "islemTamani" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "denetim_kaydi_pkey" PRIMARY KEY ("denetimId")
);

-- CreateTable
CREATE TABLE "offline_liste_surumu" (
    "surumId" BIGSERIAL NOT NULL,
    "cihazId" INTEGER NOT NULL,
    "olusturmaTamani" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gecerlilikBitis" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "offline_liste_surumu_pkey" PRIMARY KEY ("surumId")
);

-- CreateTable
CREATE TABLE "offline_liste_uyesi" (
    "uyeId" BIGSERIAL NOT NULL,
    "surumId" BIGINT NOT NULL,
    "kullaniciId" BIGINT NOT NULL,
    "kartUid" VARCHAR(29),
    "pinHmac" VARCHAR(64),
    "gunMaskesi" INTEGER,
    "saatBaslangic" VARCHAR(5),
    "saatBitis" VARCHAR(5),

    CONSTRAINT "offline_liste_uyesi_pkey" PRIMARY KEY ("uyeId")
);

-- CreateTable
CREATE TABLE "senkron_calismasi" (
    "senkronId" BIGSERIAL NOT NULL,
    "cihazId" INTEGER NOT NULL,
    "durum" VARCHAR(16) NOT NULL,
    "baslangicTamani" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bitisTamani" TIMESTAMPTZ,
    "hataMesaji" TEXT,

    CONSTRAINT "senkron_calismasi_pkey" PRIMARY KEY ("senkronId")
);

-- CreateIndex
CREATE UNIQUE INDEX "kullanici_grup_kullaniciId_grupId_key" ON "kullanici_grup"("kullaniciId", "grupId");

-- AddForeignKey
ALTER TABLE "kullanici_grup" ADD CONSTRAINT "kullanici_grup_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanici"("kullaniciId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kullanici_grup" ADD CONSTRAINT "kullanici_grup_grupId_fkey" FOREIGN KEY ("grupId") REFERENCES "grup"("grupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yetki_kurali" ADD CONSTRAINT "yetki_kurali_grupId_fkey" FOREIGN KEY ("grupId") REFERENCES "grup"("grupId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yetki_kurali" ADD CONSTRAINT "yetki_kurali_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanici"("kullaniciId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yetki_kurali" ADD CONSTRAINT "yetki_kurali_kapiId_fkey" FOREIGN KEY ("kapiId") REFERENCES "kapi"("kapiId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olay" ADD CONSTRAINT "olay_cihazId_fkey" FOREIGN KEY ("cihazId") REFERENCES "cihaz"("cihazId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olay" ADD CONSTRAINT "olay_kapiId_fkey" FOREIGN KEY ("kapiId") REFERENCES "kapi"("kapiId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olay" ADD CONSTRAINT "olay_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanici"("kullaniciId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denetim_kaydi" ADD CONSTRAINT "denetim_kaydi_islemYapan_fkey" FOREIGN KEY ("islemYapan") REFERENCES "kullanici"("kullaniciId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_liste_surumu" ADD CONSTRAINT "offline_liste_surumu_cihazId_fkey" FOREIGN KEY ("cihazId") REFERENCES "cihaz"("cihazId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_liste_uyesi" ADD CONSTRAINT "offline_liste_uyesi_surumId_fkey" FOREIGN KEY ("surumId") REFERENCES "offline_liste_surumu"("surumId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_liste_uyesi" ADD CONSTRAINT "offline_liste_uyesi_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "kullanici"("kullaniciId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "senkron_calismasi" ADD CONSTRAINT "senkron_calismasi_cihazId_fkey" FOREIGN KEY ("cihazId") REFERENCES "cihaz"("cihazId") ON DELETE RESTRICT ON UPDATE CASCADE;
