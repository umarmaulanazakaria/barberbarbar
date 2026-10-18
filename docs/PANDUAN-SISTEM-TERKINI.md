# Panduan sistem dan desain terkini

Dokumen ini menggambarkan source branch kerja yang diaudit pada 18 Oktober 2026. Laporan historis tetap berlaku hanya untuk snapshot dan bukti pada tanggalnya.

## Menjalankan tiga aplikasi

1. Backend dari server: npm.cmd run dev (port 3000), dengan database existing dan konfigurasi privat yang benar.
2. Admin dari client: npm.cmd run dev (port 5173).
3. Customer dari repository barberbarbar-customer-web: npm.cmd run dev (port 5175).
4. Staff dari barberbarbar-mobile: npm.cmd start; EXPO_PUBLIC_API_URL menunjuk IP komputer yang dapat dijangkau perangkat.

Instalasi clone baru menggunakan npm.cmd ci sesuai lockfile. Backend memerlukan npm.cmd run prisma:generate. Jangan menjalankan seed, reset atau deploy migration pada database operasional sebagai langkah startup rutin. Periksa prisma validate dan migrate status dahulu; perubahan database membutuhkan izin/backup tersendiri.

Admin dan Customer memakai proxy /api ke backend serta /socket.io untuk WebSocket. IP localhost pada konfigurasi proxy adalah komputer, bukan HP. Customer Vite menerima LAN; buka IP komputer:5175. Pengaturan guest origin harus sesuai; jangan mengizinkan wildcard credential. Production/reverse proxy/HTTPS belum disertifikasi oleh audit development ini.

## Sumber kebenaran

Route/controller memvalidasi payload dan service menjalankan aturan dalam transaksi Prisma. PostgreSQL menyediakan constraint, waktu dan lock penjadwalan bersama. UI memakai harga/status terbaru dari API; field frontend tidak mengesahkan diskon, verifikasi Member atau pembayaran. Waktu layanan/penutupan ditampilkan Asia/Jakarta; parameter tanggal transaksi memakai sesi UTC untuk menghindari pergeseran TIMESTAMPTZ adapter.

Dashboard menghitung KPI terverifikasi dan hari WIB. Pesanan menggabungkan Booking serta Walk-in tanpa menggandakan relasi. Riwayat memakai penutupan operasional, bukan waktu pembayaran terakhir; filter/pagination berasal dari backend. Invoice sementara/final dan struk membaca sumber finansial yang sama. Profil memiliki riwayat/arsip; penghapusan permanen pelanggan dinonaktifkan.

## Booking dan Membership

Customer memilih layanan, barber dan slot melalui wizard mobile-first. Quote dan POST memvalidasi ulang layanan aktif, kapasitas barber, harga dan jadwal. Satu booking baru memakai45 menit, bukan penjumlahan durasi/qty layanan. Reguler tanpa akun wajib kontak valid; DP 50% dihitung backend dan hold15 menit dari waktu database.

Member memakai nomor numerik atau legacy yang sudah terbit. Nomor tidak membuktikan identitas. Backend memeriksa penjualan sah, status aktif, periode, profil serta batas satu booking gratis aktif. Manfaat paket mengikuti pengaturan layanan gratis; layanan lain mengikuti manfaat backend. Tidak memberi diskon global kedua. Member yang layak dikonfirmasi tanpa DP. Di toko, operator mencocokkan Kartu Member dan KTP secara fisik. Mismatch mencabut cap verifikasi tanpa mengubah harga/status diam-diam; Staff meminta bantuan Admin bila perlu.

Booking melalui check-in, penentuan barber final, IN_SERVICE dan COMPLETED. Walk-in mendukung anonim/profil existing serta profil baru khusus Admin dengan data wajib yang berlaku; bukan memakai form lama tanpa HP. Quote dibaca ulang sebelum konfirmasi. UUID/idempotensi dan bukti fisik Walk-in terikat request/operator; retry mempertahankan payload dan kunci.

## Midtrans Sandbox dan dokumen

Backend memakai MIDTRANS_MERCHANT_ID, MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY dan MIDTRANS_IS_PRODUCTION=false. Credential tidak dicetak atau dimasukkan dokumentasi/bundle. Payment Notification URL mengarah ke HTTPS tunnel aktif + /midtrans/notifications, bukan port frontend. Tunnel/domain harus diverifikasi sebelum pengujian nyata.

Webhook memeriksa signature dan status provider resmi; order, merchant, nominal, currency dan waktu harus sesuai. Pending/error/callback sukses frontend bukan kredit ledger. Idempotensi mencegah replay menggandakan kredit/invoice. DP yang sah mengonfirmasi guest sesuai aturan deadline; pelunasan memakai balance database. Tunai dan Transfer memerlukan konfirmasi dana/operator sesuai kontrak; QRIS memakai bukti provider. Tidak membuat transaksi atau refund provider dalam audit terbaru.

Invoice final mengikuti syarat backend dan saldo; struk merupakan preview dokumen, bukan integrasi printer fisik. Endpoint/ledger refund historis masih ada pada commit terpublikasi; perubahan penghapusannya masih WIP lokal. Jangan menyimpulkan UI atau ledger baru telah dirilis dari keberadaan WIP.

## Otorisasi dan realtime

JWT CUSTOMER dipisahkan dari ADMIN/STAFF. Reset/perubahan kredensial Customer mencabut sesi lama; profil hanya milik sendiri. Route operator memerlukan JWT operator dan tindakan administratif memiliki guard ADMIN. Verifikasi Member memeriksa role operator aktual, konteks Booking/profil dan status terbaru; bukti Walk-in berlaku15 menit dan tidak dapat dipakai operator/request lain. Tidak menyimpan NIK atau foto KTP.

Endpoint publik membatasi percobaan IP; pembatas tambahan nomor Member memakai HMAC kode ternormalisasi lintas IP. Request Reguler tidak memakai kuota Member. Tracking rahasia, session cookie HttpOnly, rotasi akses dan autentikasi Socket.IO scoped menjadi pembatas akses customer. Event hanya berisi invalidasi dan memicu REST, bukan PII/credential/bukti lunas. REST/polling/refocus/reconnect tetap diperlukan.

## Desain dan arsip

Admin Minimal, Customer mobile-first dan Staff Minimal V3 tidak didesain ulang pada audit ini. Tidak menambahkan gambar dummy atau screenshot WIP yang belum disanitasi. Folder screenshot Admin untracked dipertahankan lokal. Seluruh dokumen/migration/backup historis dipertahankan; tidak dipindahkan/dihapus. [Matriks hasil aktual](audit/AUDIT-SISTEM-TERKINI.md) menjadi rujukan audit terbaru.
