-- This is an empty migration.
BEGIN;
-- CHECK PostgreSQL menerima NULL; kuitansi kasir wajib mengisi keduanya.
ALTER TABLE "TransaksiPembayaranBooking" ADD CONSTRAINT "KuitansiKasir_booking_lengkap" CHECK (
 "kanal" <> 'KASIR' OR ("jumlahDiterima" IS NOT NULL AND "kembalian" IS NOT NULL)
);
COMMIT;
