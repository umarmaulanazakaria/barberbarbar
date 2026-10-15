> Dokumen historis dipindahkan dari `barberbarbar/server/F5-AUDIT.md`. Hasil dan path bukti mencatat waktu audit; panduan aktif ada di README utama dan laporan cleanup. Arsip privat kini berada di luar Stage 2.

# F5 Operational Lifecycle — Hasil aktual

14 Oktober 2026 · `feature/project5-integration`.

**Status implementasi: fondasi F5 yang disetujui telah diuji; lifecycle operasional
penuh BELUM tersedia sampai F6.** Jangan menyebut check-in/IN_SERVICE dengan DP
valid berhasil. Sinkronisasi Git diperiksa setelah commit/push dalam laporan akhir.
Tidak ada dependency, extension, software atau environment tambahan.

## Keputusan pengguna yang membatasi scope

1. **C:** check-in dan IN_SERVICE wajib bukti DP; diblokir sampai F6 menyediakan
   pembayaran terverifikasi. Tidak menambah flag PAID atau cara bypass bukti.
2. **A:** reschedule setelah menolak usulan barber kembali PENDING_CONFIRMATION,
   memerlukan konfirmasi ulang; deadline DP baru = waktu konfirmasi baru +1 jam.
3. **B:** tidak mengubah pembayaran legacy. Pembuatan Pesanan dan perubahan item
   booking ditunda sampai F6 agar tidak membuat keuangan parsial.

Master PRD v2.0/handover tidak ditemukan; implementasi mengikuti lampiran, source
aktual serta keputusan eksplisit tersebut. Tidak ada UI F10–F12 atau E2E F13.

## Audit source dan database

F4 Booking terpisah dari Pesanan/Pembayaran, hanya memiliki snapshot DP nominal.
Tidak ada model bukti DP booking atau ledger balance/refund. Service item pesanan
existing mendukung edit sebelum PAID dan memakai discountPercent pesanan, tetapi
tidak memahami DP. Karena itu source order/item/payment legacy tidak diubah.
JWT CUSTOMER/operator dan flow kasir F2–F4 tetap dipakai.

Sebelum migration ada **0 Booking, 0 order terkait Booking, 17 Pembayaran existing**.
Backup baru dibuat dan diperiksa sebelum migration create-only:
`Stage 2/backup-database/f5-2026-10-14T09-07-01-646Z/database.dump`.
Ukuran 67.332 byte, SHA-256
`ac2bf4f5388419011715219b659dccbc6a6b81ea9f78709601985c77596f874a`.
PASS daftar isi dan pembacaan/dekompresi seluruh custom archive tanpa restore,
checksum serta perbandingan snapshot 15 model sebelum/sesudah backup. Backup/
manifest di luar Git dan ZIP; tidak dilakukan restore trial.

Migration `20261014091009_tambah_operasional_booking_f5`: dibuat create-only,
ditinjau dan migrate deploy. BEGIN/COMMIT; enum CHECKED_IN ditambah, Booking diberi
kolom nullable alasan/aktor keputusan, deadline/check-in/waktu layanan, barber
disetujui/final. Tabel baru UsulanBarberBooking/RiwayatBooking dan FK; unique index
parsial satu proposal PENDING per booking, CHECK alasan dan deadline tepat1jam.
Tidak ada backfill/update/delete/drop data existing; nullable metadata pada tabel
Booking kosong tidak mengubah record bisnis existing.

Semua writer jadwal memakai helper `kunciJadwalBooking`: SET LOCAL TIME ZONE UTC
dan transaction advisory lock `(7354,1)` yang sama dengan F4. Keputusan/usulan/
consent/reschedule/completion dan audit log atomik; kegagalan audit rollback status.

## Fitur yang tersedia

- ADMIN/STAFF list/detail/confirm/reject Booking. Reject wajib alasan, terminal,
  alasan dapat dibaca owner. Confirm mencatat aktor/waktu dan deadline DP +1jam.
- Usulan barber untuk preferensi specific pada CONFIRMED/CHECKED_IN, tanpa timeout.
  Hanya owner CUSTOMER dapat menerima/menolak. Preferensi asli tetap disimpan;
  barberDisetujuiId baru menjadi barber efektif setelah consent dan validasi ulang.
- Reschedule owner setelah menolak proposal pada CONFIRMED, sebelum Pesanan ada:
  validasi F4, snapshot harga/durasi tetap, status pending, deadline/konfirmasi reset;
  riwayat menyimpan jadwal/deadline sebelumnya. Tidak menawarkan reschedule keuangan
  setelah DP atau saat sudah check-in; kebijakan tersebut memerlukan F6.
  Penolakan proposal lama tidak dapat dipakai ulang setelah konfirmasi baru untuk
  berulang kali mereset deadline; waktu keputusan harus dalam round konfirmasi kini.
- F4 menahan CHECKED_IN dan memakai barber final/disetujui/pilihan sebagai barber
  efektif pada cek konflik. Perubahan F4 ini perlu agar consent/check-in tidak
  melepaskan slot atau membiarkan barber efektif dipesan dua kali.
- Completion kontrak IN_SERVICE→COMPLETED tidak membuat PAID/Pembayaran. Positif
  transisi ini hanya diuji menggunakan fixture state masa depan, bukan flow DP nyata.
- Check-in/start/item endpoint menolak saat prasyarat belum tersedia; tidak membuat
  Pesanan, Payment, refund atau status pembayaran palsu.

## PASS / DEFERRED

| Skenario | Hasil aktual |
| --- | --- |
| ADMIN confirm / STAFF confirm | PASS |
| Deadline1jam sesudah confirm, tanpa PAID/Pesanan | PASS |
| Reject beralasan / tanpa alasan ditolak | PASS |
| Reason owner dapat membaca, orang lain404 | PASS |
| Reject terminal dan double keputusan | PASS |
| Confirm concurrent / confirm vs reject | PASS, 200/409 dan satu audit keputusan |
| CUSTOMER tidak memutuskan/check-in, list operator401 | PASS |
| Own-consent/customer lain404 | PASS |
| Satu proposal pending, constraint aktual | PASS |
| Consent concurrent | PASS, 200/409 |
| Pending/tidak disetujui pengganti tidak boleh start | PASS, guard diuji pada fixture CHECKED_IN |
| Barber efektif setelah consent tetap menahan slot F4 | PASS |
| Reject proposal → reschedule → pending → confirm ulang | PASS, snapshot utuh dan deadline baru |
| Reschedule invalid/lebih14hari/customer lain | PASS, 400/404 |
| Check-in tanpa DP, termasuk sebelum jadwal | PASS guard409 sesuai keputusan C |
| Positive check-in dengan DP valid / lebih awal | **DEFERRED F6**, tidak dipalsukan |
| Terminal tidak bisa check-in / invalid transition | PASS guard |
| Any/fixed/replacement validasi sebelum start | PASS guard kapasitas/preferensi pada fixture |
| Positive final barber assignment / IN_SERVICE | **DEFERRED F6**, barberFinalId tidak diisi tanpa DP |
| CHECKED_IN menahan slot | PASS fixture; NO_SHOW otomatis belum tersedia, F8 wajib mengecualikan CHECKED_IN/checkInPada non-null |
| COMPLETED tidak otomatis PAID | PASS kontrak transisi fixture IN_SERVICE; jumlah Payment tidak berubah |
| Membuat Pesanan / add-reduce-delete service booking | **DEFERRED F6 sesuai B**, endpoint menolak409 |
| Rollback audit error | PASS, status/deadline pending dipulihkan atomik |
| Regresi F4 termasuk kasir/invoice | PASS, 15 kelompok + cleanup |
| Regresi F3 | PASS, 12 kelompok + cleanup |
| Regresi F2 auth/profile/role | PASS, 24 kelompok |
| Regresi F2 reset/public API | PASS, 11 kelompok reset dan public/operator |
| TypeScript strict/build/Prisma validate/status | PASS |
| Cleanup fixture + data existing | PASS, 15 model identik dengan backup; Booking/ItemBooking/usulan/riwayat fixture nol |
| Browser/mobile UI | BELUM DIJALANKAN, di luar scope backend |

Suite `test-operasional-f5.mjs`: 11 kelompok PASS + cleanup. Fixture CHECKED_IN dan
IN_SERVICE dibuat langsung khusus menguji guard/transisi yang nanti dicapai F6;
**bukan bukti DP valid, bukan pembayaran palsu dan bukan uji alur operasional penuh**.
Semua suite lokal/berurutan, credential acak, hanya fixture sendiri dibersihkan.
Warning deprecation pg muncul; seluruh exit code akhir test/build0.

## Paket / Git / pekerjaan selanjutnya

Daftar14 file ada di README-INSTALASI.md. ZIP
`Stage 2/BARBERBARBAR-F5-OPERATIONAL.zip` hanya whitelist14 file lengkap, prefix
barberbarbar/, setiap entry/checksum diperiksa terhadap source. Tidak menyertakan
dua file dilindungi, .env/.git/node_modules/dump/credential/token. ZIP tidak di-commit.
Working tree/migration sudah diterapkan. Commit/push hanya feature branch; status
upstream dan hash commit aktual dilaporkan sesudah verifikasi, bukan diasumsikan.

F6 harus menyediakan bukti DP authoritative sebelum membuka check-in/start,
menyimpan barberFinalId/check-in/waktu layanan secara atomik, membuat Pesanan dari
snapshot booking dan menyinkronkan completion/order. Edit layanan menggunakan
discountPercent snapshot, bukan membership terbaru; balance/refund membutuhkan
ledger pembayaran yang benar. Tidak ada pengubahan snapshot reservasi/DP historis
atau jalur pembayaran legacy booking parsial di F5.

F8 menangani deadline/no-show15menit/timeout tanpa menandai CHECKED_IN NO_SHOW;
tidak ada timeout proposal pengganti. F5 tidak otomatis cancel pending atau DP
lewat deadline. F9–F14 tetap fase berikutnya. Keputusan reschedule setelah DP
terverifikasi perlu ditinjau bersama keuangan F6, bukan menghapus bukti pembayaran.
