-- AlterTable
ALTER TABLE "kullanici" ADD COLUMN     "pinGecerlilikBitis" TIMESTAMPTZ,
ADD COLUMN     "pinHash" VARCHAR(255),
ADD COLUMN     "pinSonDegisim" TIMESTAMPTZ;
