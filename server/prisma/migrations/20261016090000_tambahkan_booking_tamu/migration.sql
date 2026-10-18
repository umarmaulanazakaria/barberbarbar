BEGIN;
-- Additive only: existing rows retain their original lifecycle.
ALTER TYPE "StatusBooking" ADD VALUE 'AWAITING_DP';
ALTER TABLE "Booking" ADD COLUMN "sumberBooking" TEXT NOT NULL DEFAULT 'AKUN';
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sumberBooking_check" CHECK ("sumberBooking" IN ('AKUN','TAMU'));
CREATE TABLE "AksesBookingTamu" (
 "id" SERIAL NOT NULL,
 "bookingId" INTEGER NOT NULL,
 "tokenHash" TEXT NOT NULL,
 "kunciIdempotensi" TEXT NOT NULL,
 "sidikPermintaan" TEXT NOT NULL,
 "nama" TEXT NOT NULL,
 "nomorTelepon" TEXT NOT NULL,
 "kedaluwarsaPada" TIMESTAMPTZ(3) NOT NULL,
 "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AksesBookingTamu_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AksesBookingTamu_hash_check" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
 CONSTRAINT "AksesBookingTamu_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AksesBookingTamu_bookingId_key" ON "AksesBookingTamu"("bookingId");
CREATE UNIQUE INDEX "AksesBookingTamu_tokenHash_key" ON "AksesBookingTamu"("tokenHash");
CREATE UNIQUE INDEX "AksesBookingTamu_kunciIdempotensi_key" ON "AksesBookingTamu"("kunciIdempotensi");
CREATE INDEX "AksesBookingTamu_kedaluwarsaPada_idx" ON "AksesBookingTamu"("kedaluwarsaPada");

COMMIT;
