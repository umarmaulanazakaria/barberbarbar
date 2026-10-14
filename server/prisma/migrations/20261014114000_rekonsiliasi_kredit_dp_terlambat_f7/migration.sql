BEGIN;
-- Ubah hanya predicate index, tidak menghapus row/history pembayaran.
-- Satu pending per round, tetapi dua pembayaran provider nyata yang terlanjur
-- berhasil harus tetap tercatat untuk rekonsiliasi/refund, bukan ditolak index.
DROP INDEX "TransaksiBooking_dp_round_aktif_key";
CREATE UNIQUE INDEX "TransaksiBooking_dp_round_aktif_key"
ON "TransaksiPembayaranBooking" ("bookingId", "roundKonfirmasiPada")
WHERE "tujuan" = 'DP' AND "status" = 'PENDING';
CREATE UNIQUE INDEX "TransaksiBooking_pelunasan_online_pending_key"
ON "TransaksiPembayaranBooking" ("bookingId")
WHERE "tujuan" = 'PELUNASAN' AND "kanal" = 'MIDTRANS' AND "status" = 'PENDING';
COMMIT;
