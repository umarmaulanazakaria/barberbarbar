BEGIN;
CREATE TABLE "PembayaranOperasional" (
 "id" SERIAL PRIMARY KEY, "pesananId" INTEGER NOT NULL, "penggunaId" INTEGER NOT NULL,
 "metode" "MetodePembayaran" NOT NULL, "status" "StatusTransaksiBooking" NOT NULL DEFAULT 'PENDING',
 "nominal" INTEGER NOT NULL CHECK ("nominal">0), "jumlahDiterima" INTEGER, "kembalian" INTEGER,
 "referensi" VARCHAR(300), "kunciIdempotensi" VARCHAR(128) NOT NULL, "sidikPermintaan" CHAR(64) NOT NULL,
 "providerOrderId" TEXT, "providerTransactionId" TEXT, "urlQris" TEXT, "kedaluwarsaPada" TIMESTAMPTZ(3),
 "faseProvider" TEXT, "statusProvider" TEXT, "buktiHash" CHAR(64), "terverifikasiPada" TIMESTAMPTZ(3),
 "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "dibayarPada" TIMESTAMPTZ(3),
 "transaksiBookingId" INTEGER, "pembayaranId" INTEGER,
 CONSTRAINT "PembayaranOperasional_metode_check" CHECK ("metode" IN ('CASH','TRANSFER','QRIS')),
 CONSTRAINT "PembayaranOperasional_pesananId_fkey" FOREIGN KEY ("pesananId") REFERENCES "Pesanan"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PembayaranOperasional_penggunaId_fkey" FOREIGN KEY ("penggunaId") REFERENCES "Pengguna"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PembayaranOperasional_transaksiBookingId_fkey" FOREIGN KEY ("transaksiBookingId") REFERENCES "TransaksiPembayaranBooking"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PembayaranOperasional_pembayaranId_fkey" FOREIGN KEY ("pembayaranId") REFERENCES "Pembayaran"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PembayaranOperasional_kunciIdempotensi_key" ON "PembayaranOperasional"("kunciIdempotensi");
CREATE UNIQUE INDEX "PembayaranOperasional_providerOrderId_key" ON "PembayaranOperasional"("providerOrderId");
CREATE UNIQUE INDEX "PembayaranOperasional_providerTransactionId_key" ON "PembayaranOperasional"("providerTransactionId");
CREATE UNIQUE INDEX "PembayaranOperasional_transaksiBookingId_key" ON "PembayaranOperasional"("transaksiBookingId");
CREATE UNIQUE INDEX "PembayaranOperasional_pembayaranId_key" ON "PembayaranOperasional"("pembayaranId");
CREATE UNIQUE INDEX "PembayaranOperasional_satu_pending" ON "PembayaranOperasional"("pesananId") WHERE status='PENDING';
CREATE INDEX "PembayaranOperasional_pesananId_dibuatPada_idx" ON "PembayaranOperasional"("pesananId","dibuatPada");
COMMIT;
