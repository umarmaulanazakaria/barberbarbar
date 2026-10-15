BEGIN;

-- CreateEnum
CREATE TYPE "TujuanPembayaranBooking" AS ENUM ('DP', 'PELUNASAN', 'REFUND');

-- CreateEnum
CREATE TYPE "KanalPembayaranBooking" AS ENUM ('MIDTRANS', 'KASIR');

-- CreateEnum
CREATE TYPE "StatusTransaksiBooking" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "deadlinePelunasan" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "TransaksiPembayaranBooking" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "tujuan" "TujuanPembayaranBooking" NOT NULL,
    "kanal" "KanalPembayaranBooking" NOT NULL,
    "status" "StatusTransaksiBooking" NOT NULL DEFAULT 'PENDING',
    "nominal" INTEGER NOT NULL,
    "mataUang" TEXT NOT NULL DEFAULT 'IDR',
    "metode" "MetodePembayaran",
    "jumlahDiterima" INTEGER,
    "kembalian" INTEGER,
    "kunciIdempotensi" TEXT NOT NULL,
    "sidikPermintaan" TEXT NOT NULL,
    "referensiProvider" TEXT,
    "roundKonfirmasiPada" TIMESTAMPTZ(3),
    "deadlinePada" TIMESTAMPTZ(3),
    "dibayarPada" TIMESTAMPTZ(3),
    "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "penggunaId" INTEGER,
    "transaksiAsalId" INTEGER,

    CONSTRAINT "TransaksiPembayaranBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuktiProviderBooking" (
    "id" SERIAL NOT NULL,
    "transaksiId" INTEGER NOT NULL,
    "referensiProvider" TEXT NOT NULL,
    "nominal" INTEGER NOT NULL,
    "mataUang" TEXT NOT NULL DEFAULT 'IDR',
    "fingerprintPayload" TEXT NOT NULL,
    "terverifikasiPada" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BuktiProviderBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceBooking" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "nomorInvoice" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "diskon" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "jumlahDibayar" BIGINT NOT NULL,
    "kelebihan" BIGINT NOT NULL,
    "pembayaranLegacyId" INTEGER,
    "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransaksiPembayaranBooking_kunciIdempotensi_key" ON "TransaksiPembayaranBooking"("kunciIdempotensi");

-- CreateIndex
CREATE UNIQUE INDEX "TransaksiPembayaranBooking_referensiProvider_key" ON "TransaksiPembayaranBooking"("referensiProvider");

-- CreateIndex
CREATE INDEX "TransaksiPembayaranBooking_bookingId_status_tujuan_idx" ON "TransaksiPembayaranBooking"("bookingId", "status", "tujuan");

-- CreateIndex
CREATE UNIQUE INDEX "BuktiProviderBooking_transaksiId_key" ON "BuktiProviderBooking"("transaksiId");

-- CreateIndex
CREATE UNIQUE INDEX "BuktiProviderBooking_referensiProvider_key" ON "BuktiProviderBooking"("referensiProvider");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceBooking_bookingId_key" ON "InvoiceBooking"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceBooking_nomorInvoice_key" ON "InvoiceBooking"("nomorInvoice");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceBooking_pembayaranLegacyId_key" ON "InvoiceBooking"("pembayaranLegacyId");

-- AddForeignKey
ALTER TABLE "TransaksiPembayaranBooking" ADD CONSTRAINT "TransaksiPembayaranBooking_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransaksiPembayaranBooking" ADD CONSTRAINT "TransaksiPembayaranBooking_penggunaId_fkey" FOREIGN KEY ("penggunaId") REFERENCES "Pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransaksiPembayaranBooking" ADD CONSTRAINT "TransaksiPembayaranBooking_transaksiAsalId_fkey" FOREIGN KEY ("transaksiAsalId") REFERENCES "TransaksiPembayaranBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuktiProviderBooking" ADD CONSTRAINT "BuktiProviderBooking_transaksiId_fkey" FOREIGN KEY ("transaksiId") REFERENCES "TransaksiPembayaranBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceBooking" ADD CONSTRAINT "InvoiceBooking_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceBooking" ADD CONSTRAINT "InvoiceBooking_pembayaranLegacyId_fkey" FOREIGN KEY ("pembayaranLegacyId") REFERENCES "Pembayaran"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "TransaksiBooking_dp_round_aktif_key"
ON "TransaksiPembayaranBooking" ("bookingId", "roundKonfirmasiPada")
WHERE "tujuan" = 'DP' AND "status" IN ('PENDING', 'SUCCEEDED');
ALTER TABLE "TransaksiPembayaranBooking" ADD CONSTRAINT "TransaksiBooking_valid" CHECK (
 "nominal" >= 0 AND "mataUang" = 'IDR'
 AND ("tujuan" <> 'DP' OR ("kanal" = 'MIDTRANS' AND "roundKonfirmasiPada" IS NOT NULL AND "deadlinePada" IS NOT NULL))
 AND ("kanal" <> 'KASIR' OR ("tujuan" = 'PELUNASAN' AND "metode" IS NOT NULL
   AND "jumlahDiterima" >= "nominal" AND "kembalian" = "jumlahDiterima" - "nominal"))
 AND ("tujuan" <> 'REFUND' OR ("kanal" = 'MIDTRANS' AND "transaksiAsalId" IS NOT NULL))
 AND ("status" <> 'SUCCEEDED' OR "dibayarPada" IS NOT NULL)
);
ALTER TABLE "BuktiProviderBooking" ADD CONSTRAINT "BuktiProvider_valid" CHECK (
 "nominal" >= 0 AND "mataUang" = 'IDR' AND "fingerprintPayload" ~ '^[a-f0-9]{64}$'
);
ALTER TABLE "InvoiceBooking" ADD CONSTRAINT "InvoiceBooking_valid" CHECK (
 "subtotal" >= 0 AND "discountPercent" IN (0,10)
 AND "diskon" = floor("subtotal"::numeric * "discountPercent" / 100)
 AND "total" = "subtotal" - "diskon" AND "jumlahDibayar" >= "total"
 AND "kelebihan" = "jumlahDibayar" - "total"
);

-- Constraint data provenance, bukan implementasi verifikasi signature Midtrans.
-- F7 satu-satunya writer bukti provider. Tidak ada endpoint writer bukti di F6.
CREATE FUNCTION validasi_bukti_booking_f6() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tid integer; tr "TransaksiPembayaranBooking"%ROWTYPE; asal "TransaksiPembayaranBooking"%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME = 'TransaksiPembayaranBooking' THEN tid := NEW."id";
 ELSIF TG_OP = 'DELETE' THEN tid := OLD."transaksiId";
 ELSE tid := NEW."transaksiId"; END IF;
 SELECT * INTO tr FROM "TransaksiPembayaranBooking" WHERE "id" = tid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF tr."kanal" = 'MIDTRANS' AND tr."status" = 'SUCCEEDED' THEN
   IF NOT EXISTS (SELECT 1 FROM "BuktiProviderBooking" b WHERE b."transaksiId" = tr."id"
     AND b."referensiProvider" = tr."referensiProvider" AND b."nominal" = tr."nominal" AND b."mataUang" = tr."mataUang") THEN
     RAISE EXCEPTION 'Transaksi provider berhasil wajib memiliki bukti cocok' USING ERRCODE='23514';
   END IF;
 END IF;
 IF tr."tujuan" = 'REFUND' AND tr."status" = 'SUCCEEDED' THEN
   SELECT * INTO asal FROM "TransaksiPembayaranBooking" WHERE "id" = tr."transaksiAsalId" FOR UPDATE;
   IF NOT FOUND OR asal."bookingId" <> tr."bookingId" OR asal."status" <> 'SUCCEEDED' OR asal."tujuan" = 'REFUND'
    OR (SELECT coalesce(sum("nominal"),0) FROM "TransaksiPembayaranBooking"
      WHERE "transaksiAsalId" = asal."id" AND "status" = 'SUCCEEDED') > asal."nominal" THEN
     RAISE EXCEPTION 'Refund melebihi transaksi asal valid' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER bukti_booking_ledger_valid AFTER INSERT OR UPDATE ON "TransaksiPembayaranBooking"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validasi_bukti_booking_f6();
CREATE CONSTRAINT TRIGGER bukti_booking_provider_valid AFTER INSERT OR UPDATE OR DELETE ON "BuktiProviderBooking"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validasi_bukti_booking_f6();

COMMIT;
