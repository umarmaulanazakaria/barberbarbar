-- Alter Membership FK so a customer without order history can be deleted together with membership
ALTER TABLE "Membership" DROP CONSTRAINT IF EXISTS "Membership_pelangganId_fkey";
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "StatusPesanan" AS ENUM ('WAITING', 'IN_SERVICE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "StatusPembayaran" AS ENUM ('UNPAID', 'PAID');
CREATE TYPE "MetodePembayaran" AS ENUM ('CASH', 'QRIS', 'CARD', 'TRANSFER', 'OTHER');

CREATE TABLE "Pesanan" (
  "id" SERIAL NOT NULL,
  "nomorPesanan" TEXT NOT NULL,
  "pelangganId" INTEGER NOT NULL,
  "barberId" INTEGER NOT NULL,
  "status" "StatusPesanan" NOT NULL DEFAULT 'WAITING',
  "statusPembayaran" "StatusPembayaran" NOT NULL DEFAULT 'UNPAID',
  "checkInTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "catatan" TEXT,
  "subtotal" INTEGER NOT NULL,
  "discountPercent" INTEGER NOT NULL DEFAULT 0,
  "diskon" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL,
  "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "diperbaruiPada" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Pesanan_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ItemPesanan" (
  "id" SERIAL NOT NULL,
  "pesananId" INTEGER NOT NULL,
  "layananId" INTEGER NOT NULL,
  "namaLayanan" TEXT NOT NULL,
  "durasiMenit" INTEGER NOT NULL,
  "harga" INTEGER NOT NULL,
  "qty" INTEGER NOT NULL DEFAULT 1,
  "subtotal" INTEGER NOT NULL,
  CONSTRAINT "ItemPesanan_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Pembayaran" (
  "id" SERIAL NOT NULL,
  "pesananId" INTEGER NOT NULL,
  "nomorInvoice" TEXT NOT NULL,
  "metode" "MetodePembayaran" NOT NULL,
  "jumlahDiterima" INTEGER NOT NULL,
  "kembalian" INTEGER NOT NULL DEFAULT 0,
  "catatan" TEXT,
  "dibayarPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pembayaran_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RiwayatStatusPesanan" (
  "id" SERIAL NOT NULL,
  "pesananId" INTEGER NOT NULL,
  "status" "StatusPesanan" NOT NULL,
  "penggunaId" INTEGER,
  "diubahPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiwayatStatusPesanan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Pesanan_nomorPesanan_key" ON "Pesanan"("nomorPesanan");
CREATE INDEX "Pesanan_status_idx" ON "Pesanan"("status");
CREATE INDEX "Pesanan_statusPembayaran_idx" ON "Pesanan"("statusPembayaran");
CREATE INDEX "Pesanan_dibuatPada_idx" ON "Pesanan"("dibuatPada");
CREATE INDEX "ItemPesanan_pesananId_idx" ON "ItemPesanan"("pesananId");
CREATE INDEX "ItemPesanan_layananId_idx" ON "ItemPesanan"("layananId");
CREATE UNIQUE INDEX "Pembayaran_pesananId_key" ON "Pembayaran"("pesananId");
CREATE UNIQUE INDEX "Pembayaran_nomorInvoice_key" ON "Pembayaran"("nomorInvoice");
CREATE INDEX "Pembayaran_dibayarPada_idx" ON "Pembayaran"("dibayarPada");
CREATE INDEX "RiwayatStatusPesanan_pesananId_idx" ON "RiwayatStatusPesanan"("pesananId");
ALTER TABLE "Pesanan" ADD CONSTRAINT "Pesanan_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pesanan" ADD CONSTRAINT "Pesanan_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItemPesanan" ADD CONSTRAINT "ItemPesanan_pesananId_fkey" FOREIGN KEY ("pesananId") REFERENCES "Pesanan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemPesanan" ADD CONSTRAINT "ItemPesanan_layananId_fkey" FOREIGN KEY ("layananId") REFERENCES "Layanan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pembayaran" ADD CONSTRAINT "Pembayaran_pesananId_fkey" FOREIGN KEY ("pesananId") REFERENCES "Pesanan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiwayatStatusPesanan" ADD CONSTRAINT "RiwayatStatusPesanan_pesananId_fkey" FOREIGN KEY ("pesananId") REFERENCES "Pesanan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiwayatStatusPesanan" ADD CONSTRAINT "RiwayatStatusPesanan_penggunaId_fkey" FOREIGN KEY ("penggunaId") REFERENCES "Pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;
