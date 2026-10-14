# BARBER BARBAR - Paket F7 Midtrans & Refund (PARSIAL)

14 Oktober 2026 Â· feature/project5-integration Â· baseline F6
44c4be8bfcf0e9600c7d47d2d763fd8820e34655.

Kode Snap/webhook/refund ADMIN dan integrasi F5 tersedia, 12 kelompok MOCK PASS.
Diagnosis lanjutan: Snap201, webhook settlement DP5000 dan integrasi operasional
F5 PASS dengan provider Sandbox nyata. HTTP500 lama tidak lagi reproducible;
penyebab internal historis belum pasti, payment-domain tidak diubah spekulatif.
Finalisasi dari commit3d751dc: pelunasan QRIS Sandbox Rp5.000 PASS, setelah DP
Rp5.000; webhook asli menghasilkan paid Rp10.000/balance nol/PAID/satu invoice.
Replay tiga webhook tidak menggandakan kredit atau invoice. Refund QRIS Rp2.000
historis diterima202 tetapi Get Status terbaru masih settlement tanpa entri refund
atau bank-confirmed; final refund DEFERRED. Tidak mengirim refund/retry baru.
F7 masih PARSIAL, F8 belum dinyatakan siap. Laporan: server/F7-AUDIT.md;
panduan: server/F7-SANDBOX.md. Finalisasi hanya dokumentasi, tanpa dependency,
schema/migration atau perubahan payment-domain. Fixture lokal sudah dibersihkan.

## Penerapan

ZIP BARBERBARBAR-F7-MIDTRANS-REFUND.zip diekstrak ke **Stage 2**, parent barberbarbar.
Berisi file lengkap, bukan patch. Working tree ini sudah diterapkan/migrasi;
tidak perlu replace ulang. Checkout tujuan wajib baseline F6, backup source dan
periksa perubahan lokal sebelum replace. ZIP F3â€“F6 lama tidak dihapus.

Jangan mengganti dua file dilindungi yang tidak masuk paket:
server/src/lib/prisma.ts dan Project4 src/layar/LayarTambahPelanggan.tsx.
Jangan menyalin .env dari mesin lain atau memasukkan key ke chat/source/ZIP.

Dependency midtrans-client1.4.3 dan @types1.4.0 sudah disetujui/terpasang.
Lockfile memuat patch proxy-addr2.0.8, menutup critical Express. Tidak ada upgrade
major. Sisa audit14 package (0 critical) wajib ditinjau pada F7-AUDIT, bukan
klaim semua dependency aman. Pada checkout tujuan jalankan npm.cmd ci hanya
setelah kebutuhan instalasi lokal ditinjau/disetujui. Tidak ada extension baru.

Isi manual empat variabel di server/.env: MIDTRANS_MERCHANT_ID,
MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, MIDTRANS_IS_PRODUCTION=false.
DATABASE_URL/JWT_SECRET existing tetap. Runtime hanya menerima Sandbox.

## Database

Sebelum migrate, buat pg_dump custom di luar Git, verifikasi pg_restore --list,
pembacaan seluruh arsip tanpa restore, dan SHA256. Script lokal backup-f7.mjs
memakai build existing dan menghasilkan dump/manifest22 model di backup-database.
Credential tidak menjadi argumen command atau output. Backup sebelum dua
migration dan checksum aktual tercatat di server/F7-AUDIT.md.

SQL-only create reviewed sebelum deploy:

- 20261014112500_tambah_midtrans_refund_f7: dua tabel, enum/nullable metadata,
  NO_SHOW, evidence attestation/DP carried round, FK/unique/CHECK/trigger immutable.
- 20261014114000_rekonsiliasi_kredit_dp_terlambat_f7: mengganti predicate satu
  pending DP per round; satu pending settlement online. DROP INDEX hanya
  mengganti index, tidak menghapus data/history. Kredit provider nyata terlambat
  harus direkam dan diproses refund bila berlebih.

Tidak ada reset/drop schema/tabel atau migrasi data. Custom CHECK/index/trigger
harus dipertahankan pada migration selanjutnya, tidak semuanya tercermin di Prisma.

Dari barberbarbar/server:

```powershell
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js migrate status
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js generate
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false --noUnusedLocals --noUnusedParameters
npm.cmd run build
```

Restart backend setelah deploy. Jangan migrate reset/force db push. Semua transaksi
jadwal/keuangan memakai lock advisory yang sama dan SET LOCAL UTC.

## API dan batas

Kontrak lengkap/body/auth tercantum di F7-AUDIT. CUSTOMER mempunyai Snap DP,
online settlement, payment sync, daftar refund sendiri, cancel dan reschedule.
Webhook POST /midtrans/notifications wajib signature+GetStatus/merchant/identity/
amount/IDR/status; tidak ada callback frontend paid. ADMIN-only /refund-requests
list/approve/reject/retry; STAFF403. Semua source refund memerlukan approval ADMIN.

F5 check-in/start/Pesanan/barber final/item dibuka hanya bila evidence resmi dan
net DP cukup. Paid/booking/service terpisah. Pelunasan hanya COMPLETED; kasir
menolak bila online masih pending. Service/reschedule turun membuat request,
bukan refund otomatis. DP cancel<1jam/NO_SHOW hangus tanpa sisa pelunasan.

Refund yang belum bank-confirmed tidak sukses. Metode non-supported/sumber kasir
UNSUPPORTED tanpa call Midtrans; prosedur pengembalian manual membutuhkan keputusan
policy/bukti terpisah. Refund retry key sama; jangan mengganti key setelah outcome
tidak pasti. Snap UNCERTAIN tetap reserved untuk reconcile/expiry, tidak create
charge baru diam-diam. F8 akan menangani scheduler/notifikasi/timeouts/reconcile
berkala. UI/device Project4/5 tidak diubah; kompatibilitas HTTP kasir diuji.

## Pengujian

```powershell
node scripts/test-midtrans-f7.mjs
node scripts/test-operasional-f5.mjs
node scripts/test-payment-f6.mjs
node scripts/test-booking-f4.mjs
node scripts/test-membership-f3.mjs
node scripts/test-fondasi-pelanggan.mjs
node scripts/test-reset-password-pelanggan.mjs
node scripts/test-api-publik.mjs
```

Suite dummy hanya DB lokal; tidak menerima ID existing dan cleanup aman. Mock
menggunakan key acak di proses, tidak mengubah .env. Untuk provider nyata gunakan
harness test-sandbox-f7.mjs dan panduan F7-SANDBOX. Checkout URL/token sementara
hanya digunakan interaktif, jangan disimpan ke Git/ZIP. Tidak memakai Production.

## Daftar 27 file ZIP

Struktur prefix barberbarbar/; source lengkap berikut:

```text
README-INSTALASI.md
server/F7-AUDIT.md
server/F7-SANDBOX.md
server/package.json
server/package-lock.json
server/prisma/schema.prisma
server/prisma/migrations/20261014112500_tambah_midtrans_refund_f7/migration.sql
server/prisma/migrations/20261014114000_rekonsiliasi_kredit_dp_terlambat_f7/migration.sql
server/scripts/backup-f7.mjs
server/scripts/diagnosis-midtrans-sandbox.mjs
server/scripts/test-midtrans-f7.mjs
server/scripts/test-sandbox-f7.mjs
server/scripts/test-operasional-f5.mjs
server/src/app.ts
server/src/controllers/midtrans-booking.controller.ts
server/src/controllers/operasional-booking.controller.ts
server/src/lib/midtrans.ts
server/src/routes/midtrans.routes.ts
server/src/routes/payment-customer.routes.ts
server/src/routes/refund-booking.routes.ts
server/src/routes/booking.routes.ts
server/src/routes/operasional-booking.routes.ts
server/src/schemas/operasional-booking.schema.ts
server/src/services/midtrans-booking.service.ts
server/src/services/operasional-booking.service.ts
server/src/services/pembayaran-booking.service.ts
server/src/services/pesanan.service.ts
```

Setiap entry dibandingkan SHA256 dengan source. Checksum file dan ZIP ada di
Stage 2/BARBERBARBAR-F7-MIDTRANS-REFUND.sha256.txt, di luar Git. Paket tidak berisi
.env, credential/token aktual, dump, .git, node_modules, dist/generated atau file
dilindungi. Generated/build dibuat ulang di checkout tujuan.
