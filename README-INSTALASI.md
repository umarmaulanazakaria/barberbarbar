# BARBER BARBAR — Paket F5 Operational Foundation

14 Oktober 2026 · feature/project5-integration · baseline F2–F4 wajib lengkap.

Fondasi F5 tersedia; lifecycle operasional penuh menunggu F6 sesuai keputusan
pengguna C/A/B. Check-in dan IN_SERVICE wajib bukti DP, sehingga diblokir409 saat
ini. Pembuatan Pesanan/perubahan item booking juga ditunda ke F6. Pembayaran
legacy tidak diubah. Jangan menyebut DP lunas atau alur operasional penuh selesai.
Laporan aktual: server/F5-AUDIT.md.

## Replace, tooling dan backup

Ekstrak BARBERBARBAR-F5-OPERATIONAL.zip ke **Stage 2**, parent barberbarbar. ZIP
berisi file lengkap, bukan patch. Backup source target dan periksa perubahan lokal
sebelum replace. **Working tree ini sudah diterapkan/migration; tidak perlu replace ulang.**
ZIP F3/F4 sebelumnya tidak dihapus/diganti. Tidak ada package, extension, software,
environment atau konfigurasi tambahan. Gunakan dependency dan DATABASE_URL/
JWT_SECRET existing. Generated Prisma/build harus dibuat di checkout tujuan.

Tidak memasukkan .env/.git/node_modules/dump/token/secret ataupun dua file lokal
dilindungi: server/src/lib/prisma.ts dan Project4 src/layar/LayarTambahPelanggan.tsx.

Sebelum migration checkout tujuan: backup source dan pg_dump custom di luar Git,
verifikasi pg_restore --list dan seluruh arsip tanpa restore (PowerShell
pg_restore --file=- <arsip> | Out-Null, exit0), catat Get-FileHash. Jangan menaruh
password dalam argumen. Setelah script tersedia dengan build F4, alternatif DB
lokal: node scripts/backup-f5.mjs dari server (output Stage 2/backup-database).
Tinjau SQL: metadata nullable Booking, enum CHECKED_IN, tabel proposal/riwayat,
FK/index/CHECK. Tidak ada update/delete/drop/backfill. Jika checkout tujuan memiliki
Booking existing, periksa validitas alasan REJECTED dan dampak CHECK sebelum
migration; jangan memaksakan migration/reset. Workspace pengembangan memiliki0
Booking sebelum F5 dan seluruh data existing sudah diverifikasi tetap identik.

Dari barberbarbar/server:

```powershell
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js migrate status
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js generate
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false --noUnusedLocals --noUnusedParameters
npm.cmd run build
```

Restart backend melalui flow existing. Tidak ada migrasi reset, force push schema,
atau pengubahan file koneksi. Pertahankan CHECK dan unique partial index dalam SQL
pada migration berikutnya. F4 datetime tetap UTC dalam transaksi; operasional Jakarta.

## API operator (Bearer JWT ADMIN/STAFF)

- GET /bookings dan GET /bookings/:id — list/detail operasional.
- POST /bookings/:id/confirm — body{}; pending→confirmed, deadlineDP waktu confirm+1jam.
- POST /bookings/:id/reject — body{ "alasan": "Alasan wajib" }; terminal REJECTED.
- POST /bookings/:id/barber-proposals — body{ "barberId": 2, "alasan": "Alasan pengganti" }.
- POST /bookings/:id/check-in — body{}; guard prasyarat, **409 sampai bukti DP F6**.
- POST /bookings/:id/start — body{ "barberId": 2 }; guard status/preferensi/kapasitas/consent,
  **409 sampai bukti DP F6**, belum menulis barber final/Pesanan.
- POST /bookings/:id/complete — body{}; hanya IN_SERVICE→COMPLETED, bukan PAID.
- PUT /bookings/:id/services — **409**, perubahan item/Pesanan deferred F6 sesuai B.

CUSTOMER ditolak401 dari seluruh API operator. Empty-body endpoint strict: tidak
menerima fake dpPaid, harga, customerId atau status. Reject/proposal alasan1–500
karakter setelah trim. Keputusan/usulan/consent/audit atomik; konflik409, ID tidak
ada404, body invalid400. Tidak ada endpoint untuk membuat DP PAID manual.

## API customer (Bearer JWT CUSTOMER)

API create/list/detail F4 tetap. Tambahan own-booking:

- POST /customer/bookings/:id/barber-proposals/:proposalId/accept — body{}.
- POST /customer/bookings/:id/barber-proposals/:proposalId/reject — body{}.
- POST /customer/bookings/:id/reschedule — body{ "mulaiPada": "2026-10-16T10:00:00+07:00",
  "barberPilihanId": null } (tanggal ilustrasi; null=any, omitted=pilihan asli).

ID booking/proposal lain ditolak404. Customer tidak bisa propose/check-in sendiri.
Usulan tersedia untuk booking preference specific pada CONFIRMED/CHECKED_IN; any
cukup menunggu assignment saat start setelah F6. Satu pending proposal per booking;
tidak ada timeout. Persetujuan divalidasi ulang terhadap barber aktif/kapasitas.
barberPilihanId asli dipertahankan; barberDisetujuiId hanya diisi setelah consent.
F4 memakai final/disetujui/pilihan sebagai barber efektif untuk bentrok.

Reschedule ini hanya setelah proposal terbaru REJECTED pada round CONFIRMED kini, sebelum
Pesanan ada. Validasi waktu/capacity F4, snapshot harga/durasi/diskon tetap.
Status kembali PENDING_CONFIRMATION, deadline/konfirmasi dikosongkan, riwayat
menyimpan jadwal/deadline lama. Konfirmasi ulang membuat deadlineDP baru+1jam.
Penolakan usulan lama tidak dapat dipakai ulang setelah konfirmasi baru.
Reschedule setelah DP/check-in memerlukan rekonsiliasi F6, belum disediakan.

GET customer menambahkan alasanPenolakan, deadlineDp, timestamp operasional,
barberDisetujuiId/barberFinalId, usulan dan riwayat milik sendiri. Tidak mengirim
hash atau ID aktor operator/customer lain. DP tetap kontrak nominal F4, bukan PAID.

## Protokol F6 dan scheduler

Semua writer jadwal wajib kunciJadwalBooking (SET LOCAL TIME ZONE UTC dan
pg_advisory_xact_lock(7354,1)) dalam READ COMMITTED sebelum baca/update. CHECKED_IN
juga menahan kapasitas. Jangan bypass dengan direct SQL atau writer tanpa lock.
F6 menyediakan bukti DP authoritative sebelum mengaktifkan check-in/start,
mencatat aktor/barberFinalId/waktu layanan, membuat Pesanan dari snapshot dan
menghubungkan lifecycle. Completion tidak memerlukan pelunasan dan tidak membuat
Payment palsu. Perubahan layanan memakai diskon snapshot dan harus merekonsiliasi
balance/refund pada model pembayaran F6/F7; pembayaran kasir legacy tetap utuh.

F8 wajib mengecualikan CHECKED_IN/checkInPada dari no-show15menit. Belum ada
pembatalan/expiry otomatis deadlineDP. Usulan barber tidak mempunyai timeout.
F9 Socket/UI/E2E/cleanup tetap fase berikutnya. PRD/handover lengkap belum ditemukan.

## Tes

Dari server, DB lokal, jalankan berurutan:

```powershell
node scripts/test-operasional-f5.mjs
node scripts/test-booking-f4.mjs
node scripts/test-membership-f3.mjs
node scripts/test-fondasi-pelanggan.mjs
node scripts/test-reset-password-pelanggan.mjs
node scripts/test-api-publik.mjs
```

F5:11kelompok foundation PASS+cleanup. Status CHECKED_IN/IN_SERVICE pada suite
hanya fixture simulasi fase berikutnya untuk guard/completion; bukan pembayaran
atau bukti DP palsu dan bukan uji operasional end-to-end. Positive check-in/start/
assignment dengan DP valid DEFERRED F6. Regresi F2–F4/flow kasir existing PASS.
Fixture hanya ID proses sendiri; data customer asli tidak disentuh. Tidak ada
UI/device test dalam scope backend.

## Rollback dan Git

Backup file target sebelum replace; pulihkan hanya daftar paket dari baselineF4,
build dan restart. Dua file dilindungi jangan disentuh. Pertahankan schema additive
agar riwayat/proposal tidak hilang; jangan drop/reset/otomatis restore DB. Pemulihan
DB memerlukan rencana dan persetujuan terpisah, dapat diverifikasi di DB isolasi.

Agent mengelola commit/push ke origin/feature/project5-integration dengan path
staging eksplisit; tidak main/merge/force/amend/rebase. Hash dan sinkronisasi aktual
sesudah push ada pada laporan akhir percakapan; jangan mengasumsikan push berhasil.
ZIP tidak di-commit. Bila source dipatch, ZIP harus diperbarui dan checksum diperiksa.

## Daftar14 file (relatif root ZIP/Stage 2)

1. barberbarbar/README-INSTALASI.md — berubah.
2. barberbarbar/server/F5-AUDIT.md — baru.
3. barberbarbar/server/prisma/schema.prisma — berubah.
4. barberbarbar/server/prisma/migrations/20261014091009_tambah_operasional_booking_f5/migration.sql — baru.
5. barberbarbar/server/src/app.ts — berubah.
6. barberbarbar/server/src/services/booking.service.ts — berubah (CHECKED_IN/consented barber/DTO).
7. barberbarbar/server/src/routes/booking.routes.ts — berubah.
8. barberbarbar/server/src/lib/transaksi-booking.ts — baru.
9. barberbarbar/server/src/schemas/operasional-booking.schema.ts — baru.
10. barberbarbar/server/src/services/operasional-booking.service.ts — baru.
11. barberbarbar/server/src/controllers/operasional-booking.controller.ts — baru.
12. barberbarbar/server/src/routes/operasional-booking.routes.ts — baru.
13. barberbarbar/server/scripts/backup-f5.mjs — baru.
14. barberbarbar/server/scripts/test-operasional-f5.mjs — baru.
