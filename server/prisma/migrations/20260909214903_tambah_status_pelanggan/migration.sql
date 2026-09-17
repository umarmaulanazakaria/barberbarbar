/*
  Warnings:

  - A unique constraint covering the columns `[nomorTelepon]` on the table `Pelanggan` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StatusPelanggan" AS ENUM ('AKTIF', 'DIBLOKIR');

-- AlterTable
ALTER TABLE "Pelanggan" ADD COLUMN     "status" "StatusPelanggan" NOT NULL DEFAULT 'AKTIF';

-- CreateIndex
CREATE UNIQUE INDEX "Pelanggan_nomorTelepon_key" ON "Pelanggan"("nomorTelepon");
