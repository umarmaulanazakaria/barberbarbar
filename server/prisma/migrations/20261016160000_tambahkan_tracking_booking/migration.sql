BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "AksesBookingTamu"
 ADD COLUMN "trackingHash" TEXT,
 ADD COLUMN "trackingTerenkripsi" TEXT,
 ADD COLUMN "versiAkses" INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX "AksesBookingTamu_trackingHash_key" ON "AksesBookingTamu"("trackingHash");
ALTER TABLE "AksesBookingTamu" ADD CONSTRAINT "AksesBookingTamu_tracking_check" CHECK (
 "versiAkses">0 AND (("trackingHash" IS NULL AND "trackingTerenkripsi" IS NULL) OR
 ("trackingHash" IS NOT NULL AND "trackingHash" ~ '^[0-9a-f]{64}$' AND "trackingTerenkripsi" IS NOT NULL)));
CREATE TABLE "SesiBookingTamu" (
 "id" SERIAL NOT NULL,
 "tokenHash" TEXT NOT NULL,
 "bookingId" INTEGER NOT NULL,
 "versiAkses" INTEGER NOT NULL,
 "sumber" TEXT NOT NULL,
 "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "kedaluwarsaPada" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "SesiBookingTamu_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "SesiBookingTamu_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "AksesBookingTamu"("bookingId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "SesiBookingTamu_valid_check" CHECK ("tokenHash" ~ '^[0-9a-f]{64}$' AND "versiAkses">0 AND "sumber" IN ('SEMENTARA','TRACKING'))
);
CREATE UNIQUE INDEX "SesiBookingTamu_tokenHash_key" ON "SesiBookingTamu"("tokenHash");
CREATE INDEX "SesiBookingTamu_bookingId_versiAkses_idx" ON "SesiBookingTamu"("bookingId","versiAkses");
CREATE INDEX "SesiBookingTamu_kedaluwarsaPada_idx" ON "SesiBookingTamu"("kedaluwarsaPada");
COMMIT;
