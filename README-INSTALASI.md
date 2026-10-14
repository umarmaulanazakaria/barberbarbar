# BARBER BARBAR — Paket F6 Payment Foundation

14 Oktober 2026 · branch `feature/project5-integration` · baseline F5
`507c0bccfdf7f92726c9620d3ccf80885a798ef0` dan seluruh migration F2–F5.

Domain pembayaran F6 sudah diterapkan pada backend Project3. Midtrans, webhook
dan refund nyata belum tersedia (F7). Check-in, IN_SERVICE, barber final,
pembuatan Pesanan dari booking dan perubahan layanan tetap terkunci sampai F7.
F5 belum selesai penuh. Lihat `server/F6-AUDIT.md` untuk bukti pengujian.

## Instalasi dan migration

Ekstrak `BARBERBARBAR-F6-PAYMENT.zip` ke **Stage 2**, parent `barberbarbar`.
Isinya file lengkap, bukan patch. Working tree ini sudah diterapkan dan dimigrasi;
tidak perlu replace ulang. Pada checkout tujuan, backup source, periksa perubahan
lokal dan pastikan baseline F5 sebelum replace. File dilindungi tidak disertakan:
`server/src/lib/prisma.ts` dan Project4 `src/layar/LayarTambahPelanggan.tsx`.

Tidak ada dependency, software, extension, secret atau konfigurasi baru.
Gunakan dependency, PostgreSQL, DATABASE_URL dan JWT_SECRET existing.
Generated Prisma dan dist tidak masuk ZIP; buat ulang di tujuan.

Sebelum migration, buat pg_dump custom terbaru di luar Git, verifikasi
`pg_restore --list`, pembacaan penuh arsip tanpa restore, dan SHA256.
Script lokal `node scripts/backup-f6.mjs` menggunakan build existing dan menyimpan
dump/manifest ke `Stage 2/backup-database`; credential tidak dicetak atau menjadi
argumen pg_dump. Dump mencakup seluruh DB, termasuk tabel F6 jika sudah tersedia;
manifest mempunyai snapshot row17 model existing.

Review dua SQL sebelum deploy:

- `20261014100314_tambah_ledger_pembayaran_booking_f6`: tiga enum, tiga tabel,
  deadlinePelunasan nullable, FK, unique/index, CHECK, trigger evidence/refund.
- `20261014100735_perketat_kuitansi_kasir_booking_f6`: CHECK tender/kembalian
  kasir wajib nonnull, karena PostgreSQL CHECK menerima ekspresi null.

Keduanya dibuat create-only, ditinjau, lalu diterapkan dengan migrate deploy.
Tidak ada UPDATE/DELETE data existing, drop, reset, backfill atau force db push.
Pertahankan partial unique index, CHECK dan constraint trigger pada migration
berikutnya; fitur SQL ini tidak seluruhnya direpresentasikan Prisma schema.

Dari `barberbarbar/server`:

```powershell
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js migrate status
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js generate
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false --noUnusedLocals --noUnusedParameters
npm.cmd run build
```

Restart backend melalui flow existing. Transaksi booking UTC, operasional Jakarta.
Jangan menjalankan migrate reset. Backup F3/F4/F5 tidak dihapus.

## Kontrak API

JWT CUSTOMER, hanya booking sendiri:

- `GET /customer/bookings/:id/payments`: `{ringkasan}` authoritative, amounts,
  status, deadline, riwayat transaksi, invoice sementara/final dan perluRefund.
- `POST /customer/bookings/:id/payments/dp-intent`: body
  `{"kunciIdempotensi":"nonce-intent-unik"}`. Hanya CONFIRMED/sebelum deadlineDP.
  Mengembalikan transaksi **PENDING** dan `integrasiProvider: "DEFERRED_F7"`;
  belum Snap/URL pembayaran/paid. Satu intent aktif per round, retry tidak ganda.

JWT operator ADMIN/STAFF:

- `GET /bookings/:id/payments`: ringkasan operasional.
- `POST /bookings/:id/payments/settlement`: body
  `{"metode":"CASH","jumlahDiterima":60000,"kunciIdempotensi":"nonce-kasir-unik"}`.
  Hanya COMPLETED dengan DP provider terverifikasi. Kredit ditentukan dari balance;
  tender berlebih menjadi kembalian. DP manual ditolak. Key8–128 karakter
  alfanumerik/underscore/hyphen. Retry payload sama mengembalikan transaksi asli;
  payload berbeda dengan key sama409. `catatan` opsional masuk fingerprint request,
  tidak menjadi field riwayat finansial publik.
- `POST /bookings/:id/payments/finalize-invoice`: body `{}`; hanya COMPLETED,
  PAID dan DP terverifikasi. Idempotent, tidak menulis kredit pembayaran.

Kasir Project3/4 `POST /orders/:id/payment` menerima payload/envelope existing
`{data:{pembayaran,pesanan}}`. Walk-in memakai flow existing. Linked Booking memakai
DP/balance ledger, tidak mengkredit total ulang. Key opsional untuk caller baru;
caller legacy tanpa key tetap mendapat409 saat mengulang pembayaran. Purpose DP
eksplisit ditolak. Invoice existing memakai satu Pembayaran legacy sebagai artefak
final; metode OTHER berarti gabungan DP+pelunasan. Rincian tender/metode sebenarnya
ada pada ledger. Artefak ini tidak dihitung sebagai kredit kedua.

## Perhitungan dan batas fase

Rupiah integer, kalkulasi BigInt dan guard safe-number. Snapshot Booking F4
0/10%, floor diskon, ceil DP50% setelah diskon. Item booking atau Pesanan terhubung
menjadi sumber total; perubahan tidak menghapus paid. `nominalDpAwal` adalah DP
awal; `nominalDp` pada ringkasan50% total saat ini. Bukti DP memakai snapshot intent.

PAID/OVERDUE tidak mengubah booking/layanan. Deadline pelunasan COMPLETED+1jam;
GET menghitung OVERDUE tanpa block akun/cancel. Scheduler/notifikasi otomatis F8.
Excess menjadi perluRefund, tidak ada refund otomatis/endpoint refund F6.

F7 satu-satunya writer BuktiProviderBooking setelah signature, merchant/order,
nominal, IDR, status provider, purpose dan round tervalidasi. Constraint matching
record bukan verifikasi kriptografis. Tidak ada writer bukti melalui API F6.
F7 harus menggunakan lock booking yang sama, idempotency/ref unique, webhook
dedup, validasi approval/refund/provider asal dan rekonsiliasi deadline. DP nol
diblokir eksplisit sampai kebijakan provider tersedia, tidak ditandai paid otomatis.
Database saat audit tidak memiliki layanan aktif gratis.

## Pengujian lokal developer

```powershell
node scripts/test-payment-f6.mjs
node scripts/test-operasional-f5.mjs
node scripts/test-booking-f4.mjs
node scripts/test-membership-f3.mjs
node scripts/test-fondasi-pelanggan.mjs
node scripts/test-reset-password-pelanggan.mjs
node scripts/test-api-publik.mjs
```

Suite F6 hanya DB lokal dan akun/booking acak milik proses. Bukti provider adalah
simulasi private sink khusus fixture, tidak menerima ID/email existing/argumen
untuk menandai paid. Fixture IN_SERVICE/COMPLETED/linked Pesanan langsung DB tidak
membuktikan lifecycle F5/Midtrans nyata. Cleanup menghapus hanya data suite.
Jangan menjalankan suite pada database produksi.

## Daftar file paket (19 file)

Semua path berikut berada di dalam `barberbarbar/`:

```text
README-INSTALASI.md
server/F6-AUDIT.md
server/prisma/schema.prisma
server/prisma/migrations/20261014100314_tambah_ledger_pembayaran_booking_f6/migration.sql
server/prisma/migrations/20261014100735_perketat_kuitansi_kasir_booking_f6/migration.sql
server/scripts/backup-f6.mjs
server/scripts/test-payment-f6.mjs
server/src/controllers/pembayaran-booking.controller.ts
server/src/controllers/pesanan.controller.ts
server/src/lib/uang-booking.ts
server/src/routes/booking.routes.ts
server/src/routes/operasional-booking.routes.ts
server/src/schemas/pembayaran-booking.schema.ts
server/src/schemas/pesanan.schema.ts
server/src/services/booking.service.ts
server/src/services/item-pesanan.service.ts
server/src/services/operasional-booking.service.ts
server/src/services/pembayaran-booking.service.ts
server/src/services/pesanan.service.ts
```

Setiap entry ZIP diverifikasi SHA256 terhadap source. Checksum file dan ZIP ada di
`Stage 2/BARBERBARBAR-F6-PAYMENT.sha256.txt`, di luar Git. Tidak ada .env, credential,
dump, .git, node_modules, dist/generated atau file dilindungi dalam arsip.
