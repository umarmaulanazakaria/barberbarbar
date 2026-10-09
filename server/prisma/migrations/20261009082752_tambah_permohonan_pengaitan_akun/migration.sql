-- CreateEnum
CREATE TYPE "StatusPermohonanPengaitan" AS ENUM ('MENUNGGU', 'DISETUJUI', 'DITOLAK');

-- CreateTable
CREATE TABLE "PermohonanPengaitanAkun" (
    "id" SERIAL NOT NULL,
    "pelangganId" INTEGER NOT NULL,
    "namaPendaftar" TEXT NOT NULL,
    "nomorTelepon" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "StatusPermohonanPengaitan" NOT NULL DEFAULT 'MENUNGGU',
    "diputuskanOlehId" INTEGER,
    "catatanKeputusan" TEXT,
    "dibuatPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diputuskanPada" TIMESTAMP(3),

    CONSTRAINT "PermohonanPengaitanAkun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PermohonanPengaitanAkun_pelangganId_status_idx" ON "PermohonanPengaitanAkun"("pelangganId", "status");

-- CreateIndex
CREATE INDEX "PermohonanPengaitanAkun_email_idx" ON "PermohonanPengaitanAkun"("email");

-- CreateIndex
CREATE INDEX "PermohonanPengaitanAkun_status_dibuatPada_idx" ON "PermohonanPengaitanAkun"("status", "dibuatPada");

-- AddForeignKey
ALTER TABLE "PermohonanPengaitanAkun" ADD CONSTRAINT "PermohonanPengaitanAkun_pelangganId_fkey" FOREIGN KEY ("pelangganId") REFERENCES "Pelanggan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermohonanPengaitanAkun" ADD CONSTRAINT "PermohonanPengaitanAkun_diputuskanOlehId_fkey" FOREIGN KEY ("diputuskanOlehId") REFERENCES "Pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Satu pelanggan hanya boleh memiliki satu permohonan aktif.
CREATE UNIQUE INDEX "PermohonanPengaitanAkun_pelanggan_menunggu_key"
ON "PermohonanPengaitanAkun" ("pelangganId")
WHERE "status" = 'MENUNGGU';

-- Satu email hanya boleh memiliki satu permohonan aktif.
-- LOWER mencegah perbedaan huruf kapital dianggap sebagai email berbeda.
CREATE UNIQUE INDEX "PermohonanPengaitanAkun_email_menunggu_key"
ON "PermohonanPengaitanAkun" (LOWER("email"))
WHERE "status" = 'MENUNGGU';

