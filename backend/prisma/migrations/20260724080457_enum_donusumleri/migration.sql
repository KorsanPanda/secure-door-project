/*
  Warnings:

  - The `durum` column on the `ariza_bildirimi` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `durum` column on the `cihaz` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `durum` column on the `kapi` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `durum` column on the `kart` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `durum` column on the `kart_yetkilendirme` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `durum` column on the `kullanici` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `rol` column on the `kullanici` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `kapiDurumu` on the `cihaz_durumu` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `cihazDurumTip` on the `cihaz_durumu` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `islemTuru` on the `denetim_kaydi` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `dogrulamaYontemi` on the `erisim_kaydi` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `sonuc` on the `erisim_kaydi` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `kaynak` on the `olay` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `durum` on the `senkron_calismasi` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "KullaniciDurum" AS ENUM ('aktif', 'pasif', 'askida');

-- CreateEnum
CREATE TYPE "KullaniciRol" AS ENUM ('hoca', 'admin', 'sistem');

-- CreateEnum
CREATE TYPE "KartDurum" AS ENUM ('aktif', 'kayip', 'iptal', 'hasarli');

-- CreateEnum
CREATE TYPE "KartYetkilendirmeDurum" AS ENUM ('aktif', 'pasif', 'iptal');

-- CreateEnum
CREATE TYPE "KapiDurum" AS ENUM ('aktif', 'bakimda', 'devredisi');

-- CreateEnum
CREATE TYPE "CihazDurum" AS ENUM ('aktif', 'bakimda', 'arizali', 'emekli');

-- CreateEnum
CREATE TYPE "KapiAcikKapaliDurum" AS ENUM ('acik', 'kapali', 'arizali');

-- CreateEnum
CREATE TYPE "CihazBaglantiDurumu" AS ENUM ('cevrimici', 'cevrimdisi', 'hatali');

-- CreateEnum
CREATE TYPE "DogrulamaYontemi" AS ENUM ('kart', 'pin');

-- CreateEnum
CREATE TYPE "ErisimSonucu" AS ENUM ('izin', 'red');

-- CreateEnum
CREATE TYPE "ArizaDurum" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "OlayKaynak" AS ENUM ('cihaz', 'sistem', 'kullanici');

-- CreateEnum
CREATE TYPE "DenetimIslemTuru" AS ENUM ('olustur', 'guncelle', 'sil');

-- CreateEnum
CREATE TYPE "SenkronDurum" AS ENUM ('basladi', 'tamamlandi', 'hata');

-- AlterTable
ALTER TABLE "ariza_bildirimi" DROP COLUMN "durum",
ADD COLUMN     "durum" "ArizaDurum" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "cihaz" DROP COLUMN "durum",
ADD COLUMN     "durum" "CihazDurum" NOT NULL DEFAULT 'aktif';

-- AlterTable
ALTER TABLE "cihaz_durumu" DROP COLUMN "kapiDurumu",
ADD COLUMN     "kapiDurumu" "KapiAcikKapaliDurum" NOT NULL,
DROP COLUMN "cihazDurumTip",
ADD COLUMN     "cihazDurumTip" "CihazBaglantiDurumu" NOT NULL;

-- AlterTable
ALTER TABLE "denetim_kaydi" DROP COLUMN "islemTuru",
ADD COLUMN     "islemTuru" "DenetimIslemTuru" NOT NULL;

-- AlterTable
ALTER TABLE "erisim_kaydi" DROP COLUMN "dogrulamaYontemi",
ADD COLUMN     "dogrulamaYontemi" "DogrulamaYontemi" NOT NULL,
DROP COLUMN "sonuc",
ADD COLUMN     "sonuc" "ErisimSonucu" NOT NULL;

-- AlterTable
ALTER TABLE "kapi" DROP COLUMN "durum",
ADD COLUMN     "durum" "KapiDurum" NOT NULL DEFAULT 'aktif';

-- AlterTable
ALTER TABLE "kart" DROP COLUMN "durum",
ADD COLUMN     "durum" "KartDurum" NOT NULL DEFAULT 'aktif';

-- AlterTable
ALTER TABLE "kart_yetkilendirme" DROP COLUMN "durum",
ADD COLUMN     "durum" "KartYetkilendirmeDurum" NOT NULL DEFAULT 'aktif';

-- AlterTable
ALTER TABLE "kullanici" DROP COLUMN "durum",
ADD COLUMN     "durum" "KullaniciDurum" NOT NULL DEFAULT 'aktif',
DROP COLUMN "rol",
ADD COLUMN     "rol" "KullaniciRol" NOT NULL DEFAULT 'hoca';

-- AlterTable
ALTER TABLE "olay" DROP COLUMN "kaynak",
ADD COLUMN     "kaynak" "OlayKaynak" NOT NULL;

-- AlterTable
ALTER TABLE "senkron_calismasi" DROP COLUMN "durum",
ADD COLUMN     "durum" "SenkronDurum" NOT NULL;
