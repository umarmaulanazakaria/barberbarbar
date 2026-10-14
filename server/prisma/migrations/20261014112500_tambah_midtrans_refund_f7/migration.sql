BEGIN;
-- CreateEnum
CREATE TYPE "StatusPermohonanRefund" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PROCESSING', 'FAILED', 'SUCCEEDED', 'UNSUPPORTED');

-- AlterEnum
ALTER TYPE "StatusBooking" ADD VALUE 'NO_SHOW';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "dpDibawaDariRound" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "BuktiProviderBooking" ADD COLUMN     "metodeVerifikasi" TEXT;

-- AlterTable
ALTER TABLE "TransaksiPembayaranBooking" ADD COLUMN     "idTransaksiProvider" TEXT,
ADD COLUMN     "jenisPembayaranProvider" TEXT,
ADD COLUMN     "statusProvider" TEXT;

-- CreateTable
CREATE TABLE "PercobaanSnapBooking" (
    "id" SERIAL NOT NULL,
    "transaksiId" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATING',
    "tokenSnap" TEXT,
    "urlSnap" TEXT,
    "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PercobaanSnapBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermohonanRefundBooking" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "transaksiAsalId" INTEGER NOT NULL,
    "transaksiRefundId" INTEGER,
    "kunciSumber" TEXT NOT NULL,
    "nominal" INTEGER NOT NULL,
    "alasan" TEXT NOT NULL,
    "status" "StatusPermohonanRefund" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "diputuskanOlehId" INTEGER,
    "diputuskanPada" TIMESTAMPTZ(3),
    "catatanKeputusan" TEXT,
    "kodeProvider" TEXT,
    "fingerprintProvider" TEXT,
    "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbaruiPada" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PermohonanRefundBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PercobaanSnapBooking_transaksiId_key" ON "PercobaanSnapBooking"("transaksiId");

-- CreateIndex
CREATE UNIQUE INDEX "PercobaanSnapBooking_orderId_key" ON "PercobaanSnapBooking"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PermohonanRefundBooking_transaksiRefundId_key" ON "PermohonanRefundBooking"("transaksiRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "PermohonanRefundBooking_kunciSumber_key" ON "PermohonanRefundBooking"("kunciSumber");

-- CreateIndex
CREATE INDEX "PermohonanRefundBooking_bookingId_status_idx" ON "PermohonanRefundBooking"("bookingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TransaksiPembayaranBooking_idTransaksiProvider_key" ON "TransaksiPembayaranBooking"("idTransaksiProvider");

-- AddForeignKey
ALTER TABLE "PercobaanSnapBooking" ADD CONSTRAINT "PercobaanSnapBooking_transaksiId_fkey" FOREIGN KEY ("transaksiId") REFERENCES "TransaksiPembayaranBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermohonanRefundBooking" ADD CONSTRAINT "PermohonanRefundBooking_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermohonanRefundBooking" ADD CONSTRAINT "PermohonanRefundBooking_transaksiAsalId_fkey" FOREIGN KEY ("transaksiAsalId") REFERENCES "TransaksiPembayaranBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermohonanRefundBooking" ADD CONSTRAINT "PermohonanRefundBooking_transaksiRefundId_fkey" FOREIGN KEY ("transaksiRefundId") REFERENCES "TransaksiPembayaranBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermohonanRefundBooking" ADD CONSTRAINT "PermohonanRefundBooking_diputuskanOlehId_fkey" FOREIGN KEY ("diputuskanOlehId") REFERENCES "Pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PercobaanSnapBooking" ADD CONSTRAINT "SnapBooking_valid" CHECK (
 "status" IN ('CREATING','READY','UNCERTAIN') AND ("status" <> 'READY' OR ("tokenSnap" IS NOT NULL AND "urlSnap" IS NOT NULL))
);
ALTER TABLE "PermohonanRefundBooking" ADD CONSTRAINT "RefundBooking_valid" CHECK (
 "nominal" > 0 AND length(trim("alasan")) BETWEEN 1 AND 255
 AND ("status" = 'PENDING_APPROVAL' OR "diputuskanPada" IS NOT NULL)
 AND ("status" <> 'SUCCEEDED' OR "transaksiRefundId" IS NOT NULL)
);
CREATE FUNCTION lindungi_kredit_booking_f7() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."status" = 'SUCCEEDED' AND (NEW."status" <> OLD."status" OR NEW."nominal" <> OLD."nominal"
   OR NEW."bookingId" <> OLD."bookingId" OR NEW."tujuan" <> OLD."tujuan" OR NEW."kanal" <> OLD."kanal"
   OR NEW."referensiProvider" IS DISTINCT FROM OLD."referensiProvider"
   OR NEW."transaksiAsalId" IS DISTINCT FROM OLD."transaksiAsalId") THEN
  RAISE EXCEPTION 'Kredit berhasil tidak boleh diubah mundur' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kredit_booking_immutable BEFORE UPDATE ON "TransaksiPembayaranBooking"
FOR EACH ROW EXECUTE FUNCTION lindungi_kredit_booking_f7();
COMMIT;