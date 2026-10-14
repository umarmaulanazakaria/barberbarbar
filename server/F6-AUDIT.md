# Audit F6 — Payment Redesign

14 Oktober 2026 · `feature/project5-integration` · baseline F5
`507c0bccfdf7f92726c9620d3ccf80885a798ef0`.

**Fondasi domain pembayaran F6 lulus acceptance lokal.** Tidak ada FAIL pada tes
akhir. Pembayaran customer nyata menunggu F7; F5 masih sebagian. Master PRD v2.0/
handover lengkap dan source Project5 tidak tersedia; audit menggunakan prompt F6
dan source aktual. Tidak ada dependency/instalasi/config baru.

## Audit awal dan kompatibilitas

Pembayaran existing unique pesananId, hanya setelah COMPLETED, satu invoice.
Project4 mengirim metode/jumlahDiterima/catatan ke endpoint yang sama tanpa DP.
F4 snapshot harga/diskon0atau10%, nominalDP ceil50%, status booking terpisah. F5
belum mempunyai evidence provider; keputusan pengguna C/A/B tetap dihormati.

Ledger terpisah mencegah kredit ganda DP/Pelunasan. Kasir walk-in tetap flow lama;
linked booking memakai bridge ledger. Pembayaran legacy hanya artefak invoice
final dengan metode OTHER (gabungan DP+pelunasan). Payment tidak mengubah status
layanan/booking. Item API legacy untuk linked booking tetap gate sampai F7.

## Database dan data existing

Backup sebelum migration:
`Stage 2/backup-database/f6-2026-10-14T10-00-27-283Z/database.dump`.
79.321 byte; SHA256
`abfb4de03878bd0d819082434333c7ab1914de8d8d674dedbf9a791e670311cf`.
pg_dump custom, pg_restore --list dan pembacaan penuh arsip tanpa restore lulus.
Manifest menyimpan sidik17 model tanpa menampilkan credential.

Migration create-only, reviewed lalu deploy:

1. `20261014100314_tambah_ledger_pembayaran_booking_f6`: deadlinePelunasan nullable,
   tiga enum; TransaksiPembayaranBooking/BuktiProviderBooking/InvoiceBooking;
   FK/unique idempotency/ref provider/invoice, partial unique DP per round,
   CHECK Rupiah/IDR/kasir/DP/refund/invoice dan deferred trigger evidence/refund.
2. `20261014100735_perketat_kuitansi_kasir_booking_f6`: kasir wajib tender/kembalian
   nonnull, menutup perilaku SQL CHECK yang menerima null.

Tidak ada reset/drop/destructive migration/backfill atau perubahan row nyata.
14 migrations up-to-date. Sesudah seluruh suite, snapshot row17 model identik
dengan backup, termasuk17 Pembayaran existing. Tiga tabel F6 kosong setelah
cleanup. Sequence fixture bergerak normal; bukan klaim dump DB byte-for-byte sama.
SHA256 backup kembali diperiksa valid.

File dilindungi tidak diedit/stage/commit/ZIP. SHA256 tetap:

- Project3 `server/src/lib/prisma.ts`:
  `d524d6701a23a32c66c42711102af799cad1d2425b13f47d85d81d987bc1672a`.
- Project4 `src/layar/LayarTambahPelanggan.tsx`:
  `522ad8a3a03bd429b240519f2898bd4a45b88434eb941ab7904b3ae341cda941`.

## Acceptance F6

Suite `scripts/test-payment-f6.mjs`: **8 kelompok PASS** dan cleanup.
Evidence hanya simulasi private sink milik akun/booking dummy suite. Fixture
IN_SERVICE/COMPLETED/linked Pesanan langsung DB tidak membuktikan F5/Midtrans nyata.

| Skenario | Hasil | Bukti/ruang lingkup |
|---|---|---|
| Rupiah integer/subtotal | PASS | BigInt, safe guard, subtotal225002 |
| Snapshot membership10% | PASS | Membership operator25% tetap booking10% |
| DP50% setelah diskon | PASS | 100000→90000→45000; ceil rupiah ganjil |
| Intent sebelum confirm | PASS | HTTP409 |
| Concurrent intent | PASS | Dua nonce satu PENDING per round |
| Injection/IDOR/auth | PASS | Strict400, own404, CUSTOMER operator401 |
| Booking/service/payment terpisah | PASS | Pending tidak PAID; COMPLETED tetap balance |
| DP sukses tanpa evidence | PASS | Constraint DB menolak SUCCEEDED tanpa evidence |
| DP manual kasir | PASS | DB KASIR/DP ditolak; HTTP purpose DP400 |
| Pelunasan sebelum COMPLETED/tanpa DP | PASS | HTTP409; tidak ada invoice palsu |
| Evidence duplikat | PASS | Unique DB menolak reference fixture duplikat |
| COMPLETED dengan balance | PASS | PARTIALLY_PAID, sisa50000 valid |
| Deadline pelunasan | PASS | HTTP complete selisih tepat3600000ms |
| OVERDUE tidak block/cancel | PASS | Customer AKTIF, tetap boleh bayar |
| Kasir pelunasan | PASS | Tender60000, kredit50000, change10000, paid100000 |
| Idempotency | PASS | Retry receipt sama; key sama payload beda409 |
| Concurrent settlement | PASS | Nonce berbeda200/409; nonce sama200/200 tanpa kredit baru |
| Rollback | PASS | Injeksi gagal invoice rollback kredit; retry berhasil |
| Total naik | PASS | Item linked150000, paid50000, balance100000 |
| Total turun/refund readiness | PASS | Total40000, paid50000, excess10000, tanpa auto refund |
| Invoice sementara/final | PASS | Null sebelum lunas; satu final PAID+COMPLETED+DP valid |
| Kasir Project3/4 linked booking | PASS | Payload/envelope lama, kredit hanya balance, ulang409 |
| Kasir walk-in existing | PASS | F4 STAFF order→service→completed→paid, invoice/change |
| F5 tetap terkunci | PASS | Check-in409 meski fixture evidence; start/order/item gate F7 |
| Midtrans Snap/signature/webhook nyata | DEFERRED | F7, bukan PASS |
| Pelunasan online/refund approval/provider | DEFERRED | F7, struktur/perhitungan saja |
| Scheduler/notifikasi timeout | DEFERRED | F8; GET menghitung OVERDUE |
| UI/device Project4/Project5 | DEFERRED | Hanya kontrak HTTP Project4 diuji |

## Regresi/tooling

| Pemeriksaan | Hasil |
|---|---|
| TypeScript noEmit strict/noUnusedLocals/noUnusedParameters | PASS |
| Backend build | PASS |
| Prisma validate/migrate status | PASS |
| Git diff --check | PASS |
| F5 test-operasional-f5.mjs | PASS:11 kelompok |
| F4 test-booking-f4.mjs termasuk kasir walk-in | PASS:15 kelompok |
| F3 test-membership-f3.mjs | PASS:12 kelompok |
| F2 test-fondasi-pelanggan.mjs | PASS:24 checks termasuk cleanup |
| F2 reset-password | PASS:11 kelompok |
| API publik | PASS:4 checks utama dan cleanup |
| Snapshot row17 model/backup/checksum file dilindungi | PASS |
| Client build | Tidak diperlukan, source client tidak berubah |

Driver pg existing mengeluarkan DeprecationWarning query concurrent pada sebagian
suite, exit tetap0. Tidak mengupgrade dependency atau file Prisma dilindungi.
Pesan historis suite F5 masih menyebut F6 sebagai gate; source terbaru menunggu F7.

## Batas keamanan dan handover

Tidak ada API F6 writer evidence atau SUCCEEDED provider. BuktiProvider tidak
diekspos ke customer. Trigger matching record bukan signature verifier; akses SQL
privileged tentu mampu membuat evidence. F7 wajib memverifikasi signature/merchant/
reference/nominal/IDR/status/purpose/round sebelum satu transaksi evidence+kredit.
Pakai advisory lock booking yang sama dan row lock Pesanan saat linked, unique
key/reference untuk dedup webhook. Rekonsiliasi provider terlambat/berlebih wajib
mempertahankan paid nyata, tidak menghilangkannya.

Refund debit terpisah, jumlahDibayarBruto historis tetap, jumlahRefund terpisah,
jumlahDibayar net dan balance/excess diturunkan. Tidak ada refund writer F6.
F7 harus menambahkan approval, validasi provider asal, lock/refund idempotency,
retensi invoice final dan rekonsiliasi round/DP setelah refund. DP net pascarefund
belum menjadi izin lifecycle; F5 hard-gated. Reschedule setelah kredit berhasil
ditolak sampai rekonsiliasi F7. DP nol gagal tertutup dengan pesan eksplisit;
tidak ada layanan aktif gratis pada DB audit.

F5 aktif: confirm/reject/deadlineDP, proposal/consent, reschedule dan riwayat.
Completion guard existing menulis deadline pelunasan tetapi jalur menuju
IN_SERVICE produksi belum terbuka. Struktur F6 siap: ledger/evidence sink/refund
parent/cash bridge/invoice. Check-in/IN_SERVICE/barber final/Pesanan/perubahan
layanan hanya diselesaikan sesudah bukti sah F7 dan tes ulang. F6 tidak mendahului
F8 scheduler, F9 Socket.IO, F10–F12 UI atau aplikasi customer lengkap.

## File, ZIP dan Git

19 file baru/berubah tercantum lengkap di `../README-INSTALASI.md`. ZIP memakai
struktur barberbarbar/, source lengkap dan dua SQL. Tiap entry diverifikasi SHA256
terhadap source; checksum ada di `Stage 2/BARBERBARBAR-F6-PAYMENT.sha256.txt`.
Tidak ada secret/dump/dependencies/.git/dist/generated/file dilindungi dalam paket.

Commit hanya path eksplisit, pesan Bahasa Indonesia; push ke
origin/feature/project5-integration sesuai tugas F6 tanpa force/main/merge/amend.
Hash commit, hasil push dan HEAD/upstream dilaporkan pada hasil akhir; tidak
ditanam di dokumen commit itu sendiri agar tidak menghasilkan hash melingkar.
