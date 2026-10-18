# Hasil integrasi dashboard dan tracking booking

Tanggal: 16 Oktober 2026. Dikerjakan pada folder project asli; commit lokal saja.

## Penyebab gangguan Customer Web

Katalog `/public/services` tetap merespons normal karena terpisah dari aktivasi booking tamu. Setelah backend dijalankan kembali lewat `npm run dev`, variabel aktivasi yang sebelumnya hanya disuplai proses sementara tidak tersedia: `/guest/bookings/session/current` merespons 503 `Booking Web belum diaktifkan.`

Perbaikan lokal menambahkan `GUEST_BOOKING_ENABLED=true` tanpa menimpa variabel existing. Kunci tracking independen juga sudah ditambahkan secara privat sesuai persetujuan. `.env` tetap diabaikan Git. `.env.example` menggunakan placeholder dan default nonaktif.

Endpoint baru `GET /public/booking-availability` memeriksa aktivasi, format kunci dan keberadaan struktur tracking secara read-only. Respons hanya menyatakan ketersediaan; tidak mengirim konfigurasi internal. Customer Web menunggu hasil pemeriksaan sebelum menampilkan formulir dan menyediakan pemeriksaan ulang saat belum tersedia.

Verifikasi runtime asli: endpoint kesiapan melalui proxy localhost:5175 menghasilkan 200 dan `tersedia: true`; formulir terlihat. Request booking kosong menghasilkan 400 validasi, bukan 503. Pemeriksaan ini tidak membuat booking atau transaksi.

## Implementasi

- Dashboard memisahkan Hari Ini dan Jadwal Mendatang berdasarkan WIB. Booking mendatang aktif diurutkan terdekat sebelum paginasi; booking terminal atau deadline pembayaran/konfirmasi yang sudah lewat dikecualikan. Tampilan tetap empat kolom, tanpa kode tracking.
- Booking Web baru memakai sesi cookie HttpOnly/SameSite=Lax, bukan token pada URL. Cookie Secure digunakan pada HTTPS/Production. Endpoint mutasi sesi memvalidasi Origin.
- Kode tracking acak 128 bit diterbitkan hanya setelah DP sah dan konfirmasi otomatis dibuktikan data backend. Penyimpanan menggunakan SHA-256 untuk pencarian dan AES-256-GCM untuk penampilan ulang, dengan kunci independen. Kode bukan nomor booking.
- Penerbitan kode dikunci per booking agar request bersamaan/replay tidak menerbitkan kode ganda. Kode tetap sama selama pelayanan, pelunasan dan invoice.
- Pencarian kode dibatasi percobaannya; respons kode tidak valid bersifat umum. Sesi berumur terbatas dan hanya mengakses satu booking. Token legacy tetap dapat ditukar menjadi sesi tanpa diletakkan kembali di URL.
- ADMIN dapat menerbitkan kode pengganti setelah memverifikasi identitas secara manual dan mengisi alasan. STAFF ditolak. Rotasi mencabut sesi/kode/token legacy lama dan menulis audit tanpa kode; booking, ledger dan invoice tidak berubah.
- Detail Customer menampilkan barber final dan waktu lifecycle aktual. Navigasi antarhalaman memuat ulang detail agar penyelesaian layanan segera terlihat.
- Alur finansial, webhook, scheduler, kasir dan source Mobile Staff/React Native Customer tidak diubah.

## Migration dan backup

Migration additive `20261016160000_tambahkan_tracking_booking` sudah diterapkan satu kali setelah persetujuan. Total migration selesai: 21. Kolom tracking ditambahkan ke AksesBookingTamu dan tabel SesiBookingTamu ditambahkan; tidak ada reset atau penghapusan record.

Backup sebelum migration: `%LOCALAPPDATA%/BARBERBARBAR/database-backups/tracking-2026-10-16T08-38-10-611Z/database.dump`, 139653 byte.

SHA-256: `ca697cfd1c727f64ad5b043e0d442a01feecb945d457f72f5556837703a247df`.

Checksum, pembacaan daftar arsip dan dekompresi diverifikasi. Snapshot 24 tabel existing identik sesudah migration ketika kolom baru dan entri migration baru dikecualikan. Kunci dicadangkan terpisah dalam `tracking-key.dpapi`, terenkripsi untuk pengguna Windows saat ini; roundtrip enkripsi diverifikasi. Backup tersebut bukan backup source dan tidak masuk Git.

## Pengujian aktual

| Pemeriksaan | Hasil |
| --- | --- |
| Tracking backend: 13 kelompok, termasuk readiness, cookie, Origin, DP sah, concurrency, salah kunci, recovery, expiry, replay, legacy, pembatasan percobaan | PASS |
| Booking tamu existing: 12 kelompok, termasuk kompatibilitas Native, DP/lifecycle/realtime | PASS |
| Booking foundation: 15 kelompok | PASS |
| Integrasi Midtrans: 17 kelompok dengan provider mock | PASS |
| Scheduler: 27 kelompok, termasuk restart/multiprocess/race | PASS |
| API publik: 4 kelompok, termasuk proteksi operator | PASS |
| Pesanan terpadu: 9 kelompok, termasuk jadwal mendatang dan paginasi | PASS |
| Browser Admin: 9 kelompok, termasuk navigasi, empat kolom, realtime lintas tab dan responsive | PASS |
| Browser pergantian hari WIB: row mendatang berpindah ke Hari Ini tanpa duplikasi | PASS |
| Browser Customer: booking tanpa akun/barber, DP50%, deadline15menit, callback palsu, settlement, tracking/copy, sesi ulang, pelayanan, pelunasan, invoice, replay dan legacy | PASS |
| Customer responsive 320/375/430/768/1440px dan tampilan saat readiness nonaktif | PASS |
| Smoke browser runtime asli localhost:5173 dan localhost:5175 | PASS |
| TypeScript/build backend, Web Admin dan Customer Web; Prisma generate/validate | PASS |
| Pembayaran Sandbox provider nyata baru | TIDAK DIJALANKAN |
| Uji Android fisik Mobile Staff/Native Customer | DEFERRED; tidak ada perangkat |

Pengujian integrasi mutasi memakai database fixture terpisah; fixture dibersihkan dan snapshot cleanup lolos. Tidak ada transaksi provider baru. Browser memakai gateway/Snap mock dan callback bertanda tangan fixture: hasil ini tidak diklaim sebagai settlement Sandbox nyata. Callback UI sukses sendiri terbukti tidak mengonfirmasi booking atau menerbitkan kode.

## Operasional dan batasan

Untuk melacak booking, customer membuka Lacak Booking dan memasukkan kode dari halaman setelah DP terverifikasi. Kode tidak dikirim melalui URL atau daftar dashboard. Bila kode hilang, ADMIN harus memverifikasi identitas melalui prosedur bisnis yang berlaku, membuka detail booking tamu, mengisi alasan dan konfirmasi verifikasi, lalu menyalin kode pengganti melalui kanal privat. Sistem tidak melakukan verifikasi identitas manusia secara otomatis.

Pengembangan HTTP lokal memakai cookie tanpa Secure; deployment harus HTTPS dengan Origin yang tepat, aktivasi eksplisit dan kunci privat yang dicadangkan. Kehilangan kunci membuat kode terenkripsi tidak dapat ditampilkan ulang. Kode/sesi dibatasi expiry akses booking existing; recovery tidak memperpanjangnya secara diam-diam.

Tidak ada push, merge, PR, transaksi Production atau pengulangan migration. Perubahan historis Prisma staged, ringkasan dashboard lama dan laporan lama dipertahankan di luar commit fitur. Dependency Admin dipulihkan melalui `npm ci --ignore-scripts --no-audit --no-fund` setelah persetujuan, tanpa mengubah package/lock.
