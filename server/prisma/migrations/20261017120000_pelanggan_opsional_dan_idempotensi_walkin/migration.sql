-- Perubahan terbatas yang disetujui; nilai dan unique nomor existing dipertahankan.
ALTER TABLE "Pelanggan" ALTER COLUMN "nomorTelepon" DROP NOT NULL;
CREATE TABLE "PermintaanWalkIn" (
 "id" SERIAL NOT NULL,
 "penggunaId" INTEGER NOT NULL,
 "kunci" VARCHAR(128) NOT NULL,
 "sidikPermintaan" CHAR(64) NOT NULL,
 "pesananId" INTEGER NOT NULL,
 "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PermintaanWalkIn_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PermintaanWalkIn_penggunaId_fkey" FOREIGN KEY ("penggunaId") REFERENCES "Pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PermintaanWalkIn_pesananId_fkey" FOREIGN KEY ("pesananId") REFERENCES "Pesanan"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PermintaanWalkIn_pesananId_key" ON "PermintaanWalkIn"("pesananId");
CREATE UNIQUE INDEX "PermintaanWalkIn_penggunaId_kunci_key" ON "PermintaanWalkIn"("penggunaId", "kunci");
