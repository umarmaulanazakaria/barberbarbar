# BARBER BARBAR — Paket F4 Booking Foundation

14 Oktober 2026 · feature/project5-integration · baseline wajib F2/F3 lengkap.

F4 hanya foundation API reservasi customer, terpisah dari Pesanan/Pembayaran/refund.
Source/kontrak operator Project3/4 tetap. Laporan: server/F4-AUDIT.md.

## Replace dan prasyarat

Ekstrak BARBERBARBAR-F4-BOOKING.zip ke **Stage 2**, parent barberbarbar. Struktur
ZIP barberbarbar/... berisi file lengkap, bukan patch. Backup source target sebelum
replace dan periksa perubahan lokal. Gunakan baseline F3/branch yang benar.
**Working tree ini sudah menerapkan F4/migration; tidak perlu replace ulang.**
ZIP F3 sebelumnya tetap disimpan; F0–F3 tidak perlu diulang.

Tidak ada dependency, extension, software atau environment baru. Gunakan Node/npm,
Prisma/PostgreSQL, DATABASE_URL/JWT_SECRET dan dependency existing. Jangan mengubah
credential, file koneksi atau zona PostgreSQL global. Generated Prisma/build output
harus dibuat di checkout tujuan, tidak disertakan ZIP.

File dilindungi tidak masuk paket: server/src/lib/prisma.ts dan Project4
src/layar/LayarTambahPelanggan.tsx. ZIP juga tidak memuat .env, .git, node_modules,
dump, token atau secret.

## Backup, migration dan build

1. Backup file target sebelum replace.
2. Backup DB di luar repository: pg_dump -h localhost -U <user> -d <database> --format=custom --file=<arsip>.
   Jangan menaruh password dalam argumen/Git.
3. Verifikasi pg_restore --list <arsip>, lalu PowerShell pg_restore --file=- <arsip> | Out-Null
   (tanpa restore, exit code0); catat SHA-256 melalui Get-FileHash <arsip>.
4. Alternatif setelah script tersedia dan build F3 tersedia: dari server jalankan
   node scripts/backup-f4.mjs. Khusus DB lokal, output Stage 2/backup-database.
5. Tinjau migration 20261014081424_tambah_booking_foundation: hanya enum, tabel baru,
   indeks/FK/CHECK pada Booking/ItemBooking. Tidak ada update/delete/drop data existing.
   Relasi model existing tidak menambah kolom fisik pada tabel existing.

Dari barberbarbar/server:

```powershell
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js migrate status
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js generate
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false --noUnusedLocals --noUnusedParameters
npm.cmd run build
```

Restart backend dengan cara existing. Migration dibuat create-only, ditinjau dan
transactional BEGIN/COMMIT. Jangan reset/force push. CHECK dalam SQL harus dipertahankan
pada migration selanjutnya. Tidak perlu instalasi/upgrade package.

## Kontrak API customer

Semua membutuhkan Bearer JWT CUSTOMER:

- POST /customer/bookings: membuat PENDING_CONFIRMATION (201).
- GET /customer/bookings: daftar sendiri (200, { data: [...] }).
- GET /customer/bookings/:id: detail sendiri (200, { booking: {...} }).

Contoh body (tanggal ilustrasi, ID dari /public/services dan /public/barbers):

```json
{
  "mulaiPada": "2026-10-16T10:07:00+07:00",
  "barberPilihanId": null,
  "items": [{ "layananId": 1, "qty": 2 }, { "layananId": 2, "qty": 1 }],
  "catatan": "Catatan opsional"
}
```

null/tidak mengirim barberPilihanId berarti siapa saja; ID berarti barber aktif
tertentu. Identitas customer diambil dari JWT. Payload strict: harga, diskon,
durasi, customerId, status, nominalDp atau pesananId tidak boleh dikirim. Maks50
layanan berbeda, qty1–100, catatan maks500. Layanan sama digabung menggunakan qty.

Error400 data/waktu invalid;409 jadwal tidak tersedia tanpa identitas booking
bentrok;401 tanpaJWT/operator/DIBLOKIR;404 detail orang lain/tidak ada identik.
Respons tidak memuat hash/kontak operator/barber/customer lain. Customer tidak
memiliki API update/cancel/approve/status/payment di F4.

## Waktu, kapasitas dan snapshot

- Asia/Jakarta setiap hari09–23. Input ISO offset/Z wajib; seconds/milliseconds0.
  Respons ISO UTC + zonaWaktu. Fleksibel per menit, bukan slot30menit.
- Mulai di masa depan. Same-day Jakarta minimum3jam setelah clock backend sesudah
  lock; horizon mulai maksimum rolling14×24jam. Batas tepat diterima.
- Selesai = mulai + sum(durasiMenit×qty); tanggal Jakarta sama, tidak melewati23.
  Selesai tepat23 diterima.
- Rentang [start,end); interval berurutan tidak bentrok. Pending/CONFIRMED/IN_SERVICE
  menahan slot; COMPLETED/REJECTED/CANCELLED tidak menahan.
- Specific ID dicek konflik; specific/any bersama dihitung sweep occupancy terhadap
  jumlah barber aktif. Nonaktif tidak menambah kapasitas. Booking aktif tetap
  dihitung konservatif jika barber pilihan kemudian dinonaktifkan.
- Customer tidak boleh punya booking aktif overlap. Validasi/insert nested item atomik.
- Snapshot harga/nama/durasi dari DB. Non-member/INACTIVE diskon0; ACTIVE booking10%.
  Kebijakan diskon kustom operator F3/order existing tidak berubah, tetapi tidak
  dipakai untuk diskon booking F4.
- Diskon rupiah floor(subtotal×persen/100). Kontrak DP50% sesudah diskon, rupiah
  bulat ceil(total/2). Belum ada pembayaran atau konfirmasi DP.
- Perubahan harga/membership tidak menghitung ulang booking historis.

## Protokol wajib untuk F5+

Booking tidak membuat Pesanan/Pembayaran. pesananId nullable unik untuk relasi
berikutnya; barberPilihanId adalah preferensi, bukan barber final. Timestamp
konfirmasi/penolakan/pembatalan disiapkan, transisi enum belum mempunyai API.

SEMUA writer/perubahan jadwal F5+ wajib mengambil pg_advisory_xact_lock(7354,1)
dalam transaksi sebelum baca kapasitas/update. READ COMMITTED melihat commit
sebelumnya sesudah menunggu lock. Prisma temporal TIMESTAMPTZ memakai SET LOCAL
TIME ZONE 'UTC' di transaksi; jangan mengubah koneksi/zona global. Operational
validation tetap Jakarta. Direct SQL/writer yang mengabaikan lock tidak memiliki
jaminan double-booking aplikasi; tidak ada exclusion constraint/extension baru.

F5 mengerjakan confirm/reject ADMIN/STAFF, keputusan lengkap, cancel/reschedule,
alokasi barber final IN_SERVICE dan pengaitan Pesanan. Any saat ini menahan pool
kapasitas, belum barber final. Pengurangan barber aktif dan alokasi perlu meninjau
booking yang sudah diterima. Walk-in/Pesanan existing tetap terpisah dari reservasi
masa depan. Pending belum expiry otomatis; payment/refund/scheduler/socket/UI
berada di F6–F12, tidak ditambahkan di F4.

## Pengujian

Dari server, hanya DB lokal, berurutan:

```powershell
node scripts/test-booking-f4.mjs
node scripts/test-membership-f3.mjs
node scripts/test-fondasi-pelanggan.mjs
node scripts/test-reset-password-pelanggan.mjs
node scripts/test-api-publik.mjs
```

F4:15kelompok + cleanup PASS, termasuk kasir create→IN_SERVICE→COMPLETED→PAID/invoice.
Waktu diuji boundary deterministik dan HTTP actual. Fixture hanya ID milik proses,
bukan customer asli. F2/F3 script existing tidak diubah. UI/device tidak diuji;
source host Project5/PRD v2.0/handover belum tersedia.

## Rollback aman

Hentikan aplikasi, pulihkan hanya file pada daftar paket dari backup source/
baseline F3, build dan restart. Jangan menyentuh dua file dilindungi. Pertahankan
migration/tabel additive yang sudah diterapkan; F3 tidak menggunakannya. Jangan
drop/reset/otomatis restore database atau menghapus booking yang sudah masuk.
Pemulihan DB memerlukan rencana terpisah dan persetujuan pemilik data; backup bisa
diverifikasi di DB isolasi tanpa menimpa DB existing.

## Daftar12 file ZIP (relatif Stage 2)

1. barberbarbar/README-INSTALASI.md — berubah, panduan F4.
2. barberbarbar/server/F4-AUDIT.md — baru.
3. barberbarbar/server/prisma/schema.prisma — berubah.
4. barberbarbar/server/prisma/migrations/20261014081424_tambah_booking_foundation/migration.sql — baru.
5. barberbarbar/server/src/app.ts — berubah.
6. barberbarbar/server/src/lib/jadwal-booking.ts — baru.
7. barberbarbar/server/src/schemas/booking.schema.ts — baru.
8. barberbarbar/server/src/services/booking.service.ts — baru.
9. barberbarbar/server/src/controllers/booking.controller.ts — baru.
10. barberbarbar/server/src/routes/booking.routes.ts — baru.
11. barberbarbar/server/scripts/backup-f4.mjs — baru.
12. barberbarbar/server/scripts/test-booking-f4.mjs — baru.
