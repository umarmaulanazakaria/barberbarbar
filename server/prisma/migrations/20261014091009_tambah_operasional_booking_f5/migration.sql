BEGIN;

-- CreateEnum
CREATE TYPE "StatusUsulanBarber" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "StatusBooking" ADD VALUE 'CHECKED_IN';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "alasanPenolakan" TEXT,
ADD COLUMN     "barberDisetujuiId" INTEGER,
ADD COLUMN     "barberFinalId" INTEGER,
ADD COLUMN     "checkInPada" TIMESTAMPTZ(3),
ADD COLUMN     "deadlineDp" TIMESTAMPTZ(3),
ADD COLUMN     "diputuskanOlehId" INTEGER,
ADD COLUMN     "layananMulaiPada" TIMESTAMPTZ(3),
ADD COLUMN     "layananSelesaiPada" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "UsulanBarberBooking" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "barberId" INTEGER NOT NULL,
    "diusulkanOlehId" INTEGER,
    "alasan" TEXT NOT NULL,
    "status" "StatusUsulanBarber" NOT NULL DEFAULT 'PENDING',
    "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diputuskanPada" TIMESTAMPTZ(3),

    CONSTRAINT "UsulanBarberBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiwayatBooking" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "aksi" TEXT NOT NULL,
    "statusSebelum" "StatusBooking" NOT NULL,
    "statusSetelah" "StatusBooking" NOT NULL,
    "penggunaId" INTEGER,
    "akunPelangganId" INTEGER,
    "rincian" JSONB,
    "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiwayatBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsulanBarberBooking_bookingId_status_idx" ON "UsulanBarberBooking"("bookingId", "status");

-- CreateIndex
CREATE INDEX "RiwayatBooking_bookingId_dibuatPada_idx" ON "RiwayatBooking"("bookingId", "dibuatPada");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_barberDisetujuiId_fkey" FOREIGN KEY ("barberDisetujuiId") REFERENCES "Barber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_barberFinalId_fkey" FOREIGN KEY ("barberFinalId") REFERENCES "Barber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_diputuskanOlehId_fkey" FOREIGN KEY ("diputuskanOlehId") REFERENCES "Pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsulanBarberBooking" ADD CONSTRAINT "UsulanBarberBooking_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsulanBarberBooking" ADD CONSTRAINT "UsulanBarberBooking_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsulanBarberBooking" ADD CONSTRAINT "UsulanBarberBooking_diusulkanOlehId_fkey" FOREIGN KEY ("diusulkanOlehId") REFERENCES "Pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatBooking" ADD CONSTRAINT "RiwayatBooking_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatBooking" ADD CONSTRAINT "RiwayatBooking_penggunaId_fkey" FOREIGN KEY ("penggunaId") REFERENCES "Pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiwayatBooking" ADD CONSTRAINT "RiwayatBooking_akunPelangganId_fkey" FOREIGN KEY ("akunPelangganId") REFERENCES "AkunPelanggan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "UsulanBarberBooking_satu_pending_key"
ON "UsulanBarberBooking" ("bookingId") WHERE "status" = 'PENDING';
ALTER TABLE "UsulanBarberBooking" ADD CONSTRAINT "UsulanBarber_alasan_valid"
CHECK (length(trim("alasan")) BETWEEN 1 AND 500);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_penolakan_valid"
CHECK ("status" <> 'REJECTED' OR length(trim(coalesce("alasanPenolakan", ''))) > 0);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_deadline_dp_valid"
CHECK ("deadlineDp" IS NULL OR ("dikonfirmasiPada" IS NOT NULL AND "deadlineDp" = "dikonfirmasiPada" + INTERVAL '1 hour'));

COMMIT;
