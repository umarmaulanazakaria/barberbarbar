BEGIN;
SELECT pg_advisory_xact_lock(7354,1);
ALTER TABLE "Membership" ADD COLUMN "berlakuMulai" TIMESTAMPTZ(3), ADD COLUMN "berlakuSampai" TIMESTAMPTZ(3);
CREATE TABLE "PengaturanMembership" (id INTEGER PRIMARY KEY,harga INTEGER NOT NULL DEFAULT 550000,"layananGratisId" INTEGER REFERENCES "Layanan"(id) ON DELETE RESTRICT ON UPDATE CASCADE,"diubahPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "harga_paket_positif" CHECK(harga>0));
INSERT INTO "PengaturanMembership"(id,harga) VALUES(1,550000);
CREATE TABLE "AuditPaketMembership" (id SERIAL PRIMARY KEY,"penggunaId" INTEGER NOT NULL,sebelum JSONB NOT NULL,sesudah JSONB NOT NULL,"dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "PenjualanMembership" (
 id SERIAL PRIMARY KEY,"membershipId" INTEGER NOT NULL REFERENCES "Membership"(id) ON DELETE RESTRICT ON UPDATE CASCADE,"penggunaId" INTEGER NOT NULL,
 kunci TEXT NOT NULL UNIQUE,sidik TEXT NOT NULL,nominal INTEGER NOT NULL CHECK(nominal>0),metode TEXT NOT NULL CHECK(metode IN ('CASH','TRANSFER','QRIS')),status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SUCCEEDED','FAILED')),
 "jumlahDiterima" INTEGER,referensi TEXT,"providerOrderId" TEXT UNIQUE,"providerTransactionId" TEXT UNIQUE,"statusProvider" TEXT,"urlQris" TEXT,"kedaluwarsaPada" TIMESTAMPTZ(3),"buktiProvider" JSONB,
 "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"dibayarPada" TIMESTAMPTZ(3),"periodeMulai" TIMESTAMPTZ(3),"periodeSampai" TIMESTAMPTZ(3),
 CONSTRAINT "aktivasi_dengan_bukti" CHECK(status<>'SUCCEEDED' OR COALESCE(("dibayarPada" IS NOT NULL AND "periodeMulai" IS NOT NULL AND "periodeSampai">"periodeMulai" AND ((metode='QRIS' AND "buktiProvider"->>'metodeVerifikasi'='MIDTRANS_STATUS_V1') OR (metode IN ('CASH','TRANSFER') AND "jumlahDiterima">=nominal))),FALSE))
);
CREATE INDEX "PenjualanMembership_membershipId_dibuatPada_idx" ON "PenjualanMembership"("membershipId","dibuatPada");
CREATE UNIQUE INDEX "satu_penjualan_pending_per_member" ON "PenjualanMembership"("membershipId") WHERE status='PENDING';
ALTER TABLE "Booking" ADD COLUMN "membershipBerbayarId" INTEGER REFERENCES "Membership"(id) ON DELETE RESTRICT ON UPDATE CASCADE,ADD COLUMN "memberBebasDp" BOOLEAN NOT NULL DEFAULT FALSE,ADD COLUMN "identitasMemberPada" TIMESTAMPTZ(3),ADD COLUMN "snapshotManfaat" JSONB;
ALTER TABLE "Pesanan" ADD COLUMN "membershipBerbayarId" INTEGER REFERENCES "Membership"(id) ON DELETE RESTRICT ON UPDATE CASCADE,ADD COLUMN "snapshotManfaat" JSONB,ADD COLUMN "invoiceManfaat" TEXT UNIQUE;
CREATE TABLE "PenggunaanMembership" (id SERIAL PRIMARY KEY,"membershipId" INTEGER NOT NULL REFERENCES "Membership"(id) ON DELETE RESTRICT ON UPDATE CASCADE,"bookingId" INTEGER UNIQUE,"pesananId" INTEGER NOT NULL UNIQUE,"selesaiPada" TIMESTAMPTZ(3) NOT NULL,rincian JSONB NOT NULL);
-- Tidak mengaktifkan, memberi tanggal, atau mengubah saldo member historis.
-- Layanan gratis dipilih eksplisit oleh Admin berdasarkan ID katalog, bukan nama.
COMMIT;
