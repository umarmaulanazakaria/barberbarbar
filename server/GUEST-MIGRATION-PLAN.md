# Rencana migration dan aktivasi lokal — menunggu persetujuan

Target produk: database Project 3 existing yang sama untuk kedua Customer App. Database fixture adalah sarana pengujian sementara, bukan database aplikasi baru.

## Perubahan yang akan disetujui

1. Terapkan hanya dua migration baru yang berada pada branch `feat/guest-booking-web-compatible`, setelah verifikasi ulang backup/snapshot dan schema existing. Kedua SQL dapat ditinjau di `prisma/migrations/20261016090000_tambahkan_booking_tamu/migration.sql` dan `prisma/migrations/20261016091000_batasi_deadline_guest/migration.sql`.
2. Setelah row22 dan invariant existing tetap identik, arahkan proses backend development port3000 ke worktree backend kompatibel dengan connection/JWT/Sandbox environment existing yang sama dan flag proses `GUEST_BOOKING_ENABLED=true`. Tidak menyalin atau menyunting .env original. Hentikan instance kode backend lama yang melayani database yang sama sebelum mengizinkan booking guest, agar writer lama tidak mengabaikan hold AWAITING_DP.
3. Smoke read-only dan pengujian dummy terkontrol untuk kedua alur; bila disetujui secara terpisah dalam pilihan persetujuan, buat satu DP Sandbox dummy Rp5.000 (layanan Rp10.000), kemudian user melakukan checkout Sandbox secara manual. Tidak ada pembayaran Production atau refund otomatis. Fixture tidak memakai customer asli.

## Backup terverifikasi

Backup read-only terbaru: `e2e-2026-10-16T05-08-16-517Z` pada `%LOCALAPPDATA%/BARBERBARBAR/database-backups/`.
Ukuran 129403 byte; SHA-256 `8e8ae3e3fb1b4e993f39722b5b52172b026415c533ebe3cca8793e73db03ddd9`.
Arsip pg_restore --list dan dekompresi berhasil; snapshot22 domain sebelum/sesudah backup identik. Credential dan isi snapshot sensitif tidak masuk repository. Validasi ulang sebelum eksekusi; buat backup baru jika database telah berubah.

## Syarat eksekusi dan pemulihan

- Migration dan provider nyata tidak dijalankan sebelum persetujuan user.
- Tidak ada reset/drop/restore pada database existing, penghapusan row atau perubahan source Native/Staff.
- Jika pemeriksaan sebelum migration gagal, berhenti sebelum DDL.
- Setiap migration dibungkus transaksi: kegagalan di tengah migration me-rollback unit DDL tersebut. Jika unit pertama sudah commit namun unit kedua gagal, jangan aktifkan guest; akun lama masih memiliki aturan lama. Laporkan kondisi dan perbaiki secara terkontrol, bukan menghapus schema/data.
- Bila verifikasi data setelah DDL gagal, jangan menjalankan guest atau transaksi provider; hentikan aktivasi dan laporkan. Jangan menimpa seluruh database dari backup otomatis karena dapat menghapus perubahan sah yang terjadi bersamaan.
- Rollback aplikasi menggunakan flag guest off dan runtime kompatibel, dengan schema additive dipertahankan. Jangan menjalankan writer backend lama sambil membiarkan guest aktif. Backup hanya untuk pemulihan terkontrol dengan persetujuan.

Status saat laporan: SQL telah diuji pada PostgreSQL fixture; database existing belum dimigrasikan, runtime3000 belum dialihkan, transaksi Sandbox/provider nyata belum dibuat.
