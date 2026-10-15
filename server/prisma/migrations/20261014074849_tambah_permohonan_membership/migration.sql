BEGIN;

-- CreateEnum
CREATE TYPE "StatusPermohonanMembership" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PermohonanMembership" (
    "id" SERIAL NOT NULL,
    "pelangganId" INTEGER NOT NULL,
    "status" "StatusPermohonanMembership" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diputuskanPada" TIMESTAMP(3),
    "diputuskanOlehId" INTEGER,
    "catatanKeputusan" TEXT,

    CONSTRAINT "PermohonanMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PermohonanMembership_pelangganId_dibuatPada_idx" ON "PermohonanMembership"("pelangganId", "dibuatPada");

-- CreateIndex
CREATE INDEX "PermohonanMembership_status_dibuatPada_idx" ON "PermohonanMembership"("status", "dibuatPada");

-- AddForeignKey
ALTER TABLE "PermohonanMembership" ADD CONSTRAINT "PermohonanMembership_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermohonanMembership" ADD CONSTRAINT "PermohonanMembership_diputuskanOlehId_fkey" FOREIGN KEY ("diputuskanOlehId") REFERENCES "Pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Satu customer hanya boleh memiliki satu permohonan pending.
CREATE UNIQUE INDEX "PermohonanMembership_pelanggan_pending_key"
ON "PermohonanMembership" ("pelangganId") WHERE "status" = 'PENDING_APPROVAL';

COMMIT;
