BEGIN;

-- CreateEnum
CREATE TYPE "StatusBooking" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'IN_SERVICE', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "nomorBooking" TEXT NOT NULL,
    "pelangganId" INTEGER NOT NULL,
    "barberPilihanId" INTEGER,
    "pesananId" INTEGER,
    "status" "StatusBooking" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "mulaiPada" TIMESTAMPTZ(3) NOT NULL,
    "selesaiPada" TIMESTAMPTZ(3) NOT NULL,
    "zonaWaktu" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "durasiMenit" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "membershipAktif" BOOLEAN NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "diskon" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "dpPersen" INTEGER NOT NULL DEFAULT 50,
    "nominalDp" INTEGER NOT NULL,
    "catatan" TEXT,
    "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbaruiPada" TIMESTAMPTZ(3) NOT NULL,
    "dikonfirmasiPada" TIMESTAMPTZ(3),
    "ditolakPada" TIMESTAMPTZ(3),
    "dibatalkanPada" TIMESTAMPTZ(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemBooking" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "layananId" INTEGER NOT NULL,
    "namaLayanan" TEXT NOT NULL,
    "durasiMenit" INTEGER NOT NULL,
    "harga" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,

    CONSTRAINT "ItemBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_nomorBooking_key" ON "Booking"("nomorBooking");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_pesananId_key" ON "Booking"("pesananId");

-- CreateIndex
CREATE INDEX "Booking_mulaiPada_selesaiPada_idx" ON "Booking"("mulaiPada", "selesaiPada");

-- CreateIndex
CREATE INDEX "Booking_pelangganId_status_idx" ON "Booking"("pelangganId", "status");

-- CreateIndex
CREATE INDEX "Booking_barberPilihanId_status_idx" ON "Booking"("barberPilihanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ItemBooking_bookingId_layananId_key" ON "ItemBooking"("bookingId", "layananId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_barberPilihanId_fkey" FOREIGN KEY ("barberPilihanId") REFERENCES "Barber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_pesananId_fkey" FOREIGN KEY ("pesananId") REFERENCES "Pesanan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemBooking" ADD CONSTRAINT "ItemBooking_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemBooking" ADD CONSTRAINT "ItemBooking_layananId_fkey" FOREIGN KEY ("layananId") REFERENCES "Layanan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariant snapshot lokal; tidak memerlukan extension PostgreSQL baru.
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_snapshot_valid" CHECK (
  "durasiMenit" > 0 AND "selesaiPada" > "mulaiPada"
  AND EXTRACT(EPOCH FROM ("selesaiPada" - "mulaiPada")) = "durasiMenit" * 60
  AND EXTRACT(SECOND FROM "mulaiPada") = 0
  AND "zonaWaktu" = 'Asia/Jakarta'
  AND ("mulaiPada" AT TIME ZONE 'Asia/Jakarta')::date = ("selesaiPada" AT TIME ZONE 'Asia/Jakarta')::date
  AND ("mulaiPada" AT TIME ZONE 'Asia/Jakarta')::time >= TIME '09:00'
  AND ("selesaiPada" AT TIME ZONE 'Asia/Jakarta')::time <= TIME '23:00'
  AND "subtotal" >= 0 AND "total" >= 0
  AND "discountPercent" = CASE WHEN "membershipAktif" THEN 10 ELSE 0 END
  AND "diskon" = floor("subtotal"::numeric * "discountPercent" / 100)
  AND "total" = "subtotal" - "diskon"
  AND "dpPersen" = 50 AND "nominalDp" = ceil("total"::numeric / 2)
);
ALTER TABLE "ItemBooking" ADD CONSTRAINT "ItemBooking_snapshot_valid" CHECK (
  "harga" >= 0 AND "durasiMenit" > 0 AND "qty" BETWEEN 1 AND 100
  AND "subtotal"::bigint = "harga"::bigint * "qty"
);

COMMIT;
