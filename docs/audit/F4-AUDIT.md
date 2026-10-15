> Dokumen historis dipindahkan dari `barberbarbar/server/F4-AUDIT.md`. Hasil dan path bukti mencatat waktu audit; panduan aktif ada di README utama dan laporan cleanup. Arsip privat kini berada di luar Stage 2.

# F4 Booking Foundation — Audit aktual

14 Oktober 2026 · `feature/project5-integration`.

**Status F4: selesai untuk foundation backend sesuai lampiran.** Booking terpisah
dari Pesanan/Pembayaran/refund. Tidak mendahului F5–F12. Tidak ada dependency,
extension, software atau konfigurasi environment tambahan. Master PRD v2.0/
handover belum ditemukan; aturan mengacu lampiran serta source aktual F2/F3.

## Audit dan kompatibilitas

Sebelum F4 hanya tersedia Pesanan/ItemPesanan, bukan reservasi. Project4 memakai
POST `/orders`, PATCH `/orders/:id/status`, POST `/orders/:id/payment`. URL,
controller, schema dan service order/payment tersebut tidak diubah. F4 memakai
middleware CUSTOMER F2 existing; operator/customer tetap terpisah dan blokir berlaku.
Membership F3 tetap sumber status benefit. Diskon booking ACTIVE disnapshot 10%
sesuai F4; diskon kustom operator/order existing tidak diubah.

Dua file dilindungi tetap byte-identik sebelum/sesudah pekerjaan:
`server/src/lib/prisma.ts` dan Project4 `src/layar/LayarTambahPelanggan.tsx`.

## Database / backup

Backup sebelum migration create-only:
`Stage 2/backup-database/f4-2026-10-14T08-14-15-878Z/database.dump`.
Ukuran 56.088 byte; SHA-256
`53b893350e6a28e09525311c4760af4175a78c132a0bc4008795a97c012ddcff`.
PASS pg_dump custom, daftar isi, pembacaan/dekompresi penuh tanpa restore, checksum
dan snapshot 13 model existing sebelum/sesudah backup. Tidak dilakukan restore
trial. Backup/manifest di luar repository/ZIP.

Migration `20261014081424_tambah_booking_foundation` dibuat create-only, ditinjau,
lalu migrate deploy. BEGIN/COMMIT hanya menambah Booking/ItemBooking, enum, indeks,
FK dan CHECK pada tabel baru. Tidak ada update/delete/drop atau kolom baru pada
tabel existing. Booking mempunyai relasi customer, barber pilihan nullable,
Pesanan nullable unik untuk fase berikutnya; item menyimpan snapshot layanan.
FK Restrict melindungi referensi historis.

CHECK menguji interval/durasi/menit/jam Jakarta, aritmetika nominal, diskon 0/10%,
DP50% dan qty/item subtotal. Kapasitas/overlap memakai advisory transaction lock
global `(7354,1)`, bukan extension/exclusion constraint. Writer F5+ wajib mengikuti
protokol lock yang sama. READ COMMITTED membaca commit sebelumnya setelah lock.

## Waktu, snapshot dan perbaikan yang ditemukan

Asia/Jakarta, setiap hari09–23; input offset/Z dan seconds/milliseconds0. Horizon
rolling14×24 jam, lead3 jam same-day, selesai tepat23 diterima. Interval [start,end)
dan sweep occupancy menghitung specific/any bersama, tanpa menjumlah semua booking
yang hanya menyentuh interval secara berurutan. Pending sudah menahan kapasitas.

Pengujian awal menemukan PrismaPg mengirim parameter Date UTC tanpa offset pada
sesi PostgreSQL lokal; TIMESTAMPTZ bergeser dan CHECK menolak fixture. Diperbaiki
dengan `SET LOCAL TIME ZONE 'UTC'` di transaksi booking, bukan konfigurasi global,
environment atau file koneksi. Pengujian final membuktikan waktu tersimpan benar.

Booking dan nested item atomik. Fault injection setelah create membuktikan rollback
seluruh booking/items dan slot tidak bocor. Harga/nama/durasi/membership berubah
tidak menghitung ulang booking historis. DP hanya kontrak rupiah: ceil(total/2)
setelah floor diskon; bukan payment atau konfirmasi DP.

## Hasil PASS / FAIL

| Skenario | Hasil |
| --- | --- |
| Non-member booking | PASS, diskon0 |
| ACTIVE snapshot10%, termasuk fixture diskon operator25% | PASS |
| INACTIVE booking berikutnya | PASS, diskon0 |
| Same-day <3 jam / tepat3 jam | PASS, boundary deterministik dan request invalid HTTP |
| >14 hari / tepat14×24 jam | PASS |
| Luar09–23 / selesai>23 / tepat23 | PASS |
| Fleksibel menit, offset/Z, second invalid | PASS |
| Multi-service/qty/durasi/harga backend | PASS, qty2+1, durasi70, subtotal225.002 |
| Snapshot setelah perubahan layanan/membership | PASS, historis utuh |
| DP50% setelah diskon dan nominal ganjil | PASS, total90.001 → DP45.001 |
| Payload harga/diskon/customer/status/DP injection | PASS, 400 |
| Service/barber nonaktif, qty/duplicate invalid | PASS, 400 |
| Barber tertentu bentrok / customer sendiri overlap | PASS, 409 |
| Pending menahan kapasitas / hanya barber aktif dihitung | PASS |
| Any + specific pada pool yang sama | PASS |
| Dua request last-slot / specific / customer sama | PASS, 201/409 |
| Specific-versus-any serentak | PASS, 201/409 |
| Interval berurutan | PASS, tidak bentrok |
| IDOR / query customerId / detail orang lain | PASS, 404 identik dengan ID tidak ada; list own-scope |
| Tanpa JWT / JWT operator / DIBLOKIR | PASS, 401 |
| CUSTOMER mengakses endpoint operator | PASS, 401 |
| Fault injection setelah nested create | PASS, rollback booking/items |
| CHECK database menolak nominal/qty invalid | PASS, data valid utuh |
| Status terminal fixture melepas slot | PASS; tidak membuat API transisi F5 |
| Regresi kasir Project3/4 | PASS, STAFF create → IN_SERVICE → COMPLETED → PAID, invoice/kembalian, bayar ulang409 |
| Regresi F3 | PASS, 12 kelompok + cleanup |
| Regresi F2 fondasi | PASS, 24 kelompok |
| Regresi F2 reset | PASS, 11 kelompok |
| Regresi API publik/operator | PASS |
| TypeScript strict / backend build | PASS |
| Prisma validate / migrate status | PASS, valid/up to date |
| Git diff check | PASS |
| Cleanup fixture | PASS |
| Data existing13 model vs snapshot sebelum migration | PASS, sidik identik; fixture Booking/ItemBooking nol |
| UI/browser/device Project5 | BELUM DIJALANKAN, bukan scope UI F4 |

Suite F4: **15 kelompok PASS + cleanup**. Semua suite berurutan, DB lokal dan akun
dummy dengan credential acak; tidak mengubah/menghapus customer asli. Warning
deprecation pg muncul pada regresi order existing; exit code akhir test/build0.
Dependency tidak diganti. Test F2/F3 existing tidak diubah.

## Paket dan batas F5

Daftar12 file baru/berubah ada di README-INSTALASI.md. ZIP
`Stage 2/BARBERBARBAR-F4-BOOKING.zip` hanya whitelist12 file dengan prefix
`barberbarbar/`; tiap entry dibaca dan checksum dibandingkan source. File dilindungi,
.env/Git/node_modules/dump/token/secret tidak masuk. ZIP tidak di-commit. Working
tree/migration sudah diterapkan, sehingga tidak perlu replace ulang. Tidak push/merge.

- F5: confirm/reject ADMIN/STAFF, keputusan lengkap, cancel/reschedule, barber final
  saat IN_SERVICE, pengaitan ke Pesanan. Timestamp disiapkan, belum ada API transisi.
- Any masih reservasi **pool kapasitas**, bukan alokasi barber final; F5 harus
  memeriksa ketersediaan/preferensi saat alokasi. Semua writer jadwal wajib lock
  `(7354,1)` dan transaksi UTC untuk TIMESTAMPTZ. Direct SQL/writer yang mengabaikan
  lock tidak memperoleh jaminan concurrency aplikasi ini.
- Pending belum mempunyai expiry otomatis. F6/F8 menangani pelepasan slot sesuai
  kontrak operasional; tidak ada scheduler/cleanup booking otomatis di F4.
- Pengurangan barber aktif tidak membatalkan booking otomatis; booking aktif tetap
  dihitung konservatif. F5 perlu menangani perubahan staf.
- Walk-in/Pesanan operator tetap terpisah, tidak otomatis menjadi reservasi atau
  mengurangi jadwal reservasi masa depan. API yang dipakai Project4 diuji; bukan
  uji Expo/device fisik atau perubahan source mobile.
- DP hanya snapshot kontrak. F6/F7 payment/Midtrans/refund, F8 scheduler, F9 Socket,
  F10–F12 UI tetap belum diimplementasikan. PRD/handover tidak tersedia.
