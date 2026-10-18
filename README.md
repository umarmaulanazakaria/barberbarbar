# BARBER BARBAR — Admin Web & Backend

Sistem operasional barbershop untuk pembelajaran, portofolio dan demo lokal. Repository ini menyediakan Web Management bagi ADMIN/STAFF dan backend pusat untuk Customer Web serta React Native Staff.

## Arsitektur

Tiga aplikasi memakai satu API Express/Prisma dan PostgreSQL yang sama. Admin memakai desain **Admin Minimal**, Customer memakai **mobile-first**, Staff memakai **Minimal V3**. Harga, slot, kelayakan Member, keputusan operasional dan pembayaran ditetapkan backend. Socket.IO hanya memberi sinyal refetch REST.

- [Admin Web dan Backend](https://github.com/umarmaulanazakaria/barberbarbar/tree/main)
- [React Native Staff](https://github.com/umarmaulanazakaria/barberbarbar-mobile/tree/main)
- [Customer Web](https://github.com/umarmaulanazakaria/barberbarbar-customer/tree/main)

## Teknologi dan fitur

React, TypeScript, Vite, Tailwind, React Query; Node.js/Express, Prisma, PostgreSQL, bcrypt/JWT; Socket.IO dan Midtrans Sandbox.

- Dashboard hari ini WIB, aktivitas Booking/Walk-in, perhatian operasional dan daftar mendatang.
- Pesanan terpadu, detail/tindakan, penentuan barber, check-in, IN_SERVICE dan COMPLETED.
- Riwayat berdasarkan waktu penutupan dengan pencarian, pagination, jenis dan status pembayaran.
- Walk-in anonim atau profil existing; quote backend, konfirmasi harga dan idempotensi.
- Pelanggan, Membership berbayar, Kartu Member, barber dan layanan aktif/inaktif.
- Verifikasi fisik Kartu Member + KTP dengan audit; koreksi identitas khusus ADMIN. Tidak menyimpan NIK/foto KTP.
- Invoice/struk, laporan dan pengaturan; Tunai, Transfer serta QRIS sesuai workflow backend.
- Customer Reguler DP 50%/15 menit; Member layak tanpa DP; satu slot 45 menit per booking.
- Tracking privat, sesi HttpOnly, webhook terverifikasi dan ledger idempotent.

## Struktur

| Folder | Isi |
| --- | --- |
| client/src/pages, components | Halaman Admin Minimal dan komponen |
| client/src/lib | HTTP, autentikasi dan sinkronisasi |
| server/src/routes, controllers, services | API dan aturan bisnis |
| server/src/middleware, realtime, lib | Keamanan, Socket.IO dan utilitas |
| server/prisma | Schema dan migration existing |
| server/scripts | Pengujian dan perkakas developer |
| docs | Panduan, desain dan bukti historis |

## Instalasi dan menjalankan

Baseline audit memakai Node.js 24 dan npm dengan dependency existing. Pada clone baru:

```powershell
cd server
npm.cmd ci
npm.cmd run prisma:generate
# Buat .env lokal secara privat; gunakan database yang sudah disiapkan.
npm.cmd run dev
```

Terminal lain dari repository ini:

```powershell
cd client
npm.cmd ci
npm.cmd run dev
```

Backend http://localhost:3000; Admin http://localhost:5173. Admin memakai /api dan proxy /socket.io menuju backend. Jalankan Customer dari repository Customer dengan npm.cmd run dev (5175), Staff dari repository Mobile dengan npm.cmd start. Jangan memakai port Admin untuk Customer.

## Environment privat backend

Salin server/.env.example secara manual ke server/.env; isi credential sendiri. Contoh berikut hanya placeholder:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE
JWT_SECRET=ISI_SECRET_ACAK_PRIVAT
MIDTRANS_MERCHANT_ID=ISI_MERCHANT_SANDBOX
MIDTRANS_SERVER_KEY=ISI_SERVER_KEY_SANDBOX
MIDTRANS_CLIENT_KEY=ISI_CLIENT_KEY_SANDBOX
MIDTRANS_IS_PRODUCTION=false
GUEST_BOOKING_ENABLED=false
BOOKING_TRACKING_ENCRYPTION_KEY=ISI_KUNCI_32_BYTE_BASE64_PRIVAT
GUEST_WEB_ORIGINS=http://localhost:5175,http://127.0.0.1:5175
SOCKET_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Aktifkan booking hanya setelah schema, kunci dan origin benar. Cocokkan origin LAN secara manual. Tidak ada credential backend di VITE_* atau EXPO_PUBLIC_*. Jangan reset/seed database operasional. Migration database existing memerlukan backup, pemeriksaan dan persetujuan tersendiri.

## Alur dan keamanan

Reguler membuat booking tanpa akun, memilih layanan/barber/slot lalu menerima nomor booking. DP dibayar sebelum deadline dari database. Callback Snap tidak mengonfirmasi pembayaran; backend memeriksa provider dan nominal sebelum CONFIRMED. Staff memverifikasi kedatangan, barber dan layanan; saldo aktual menjadi dasar pelunasan dan invoice final. Member aktif memakai manfaat paket sesuai pengaturan, tanpa DP, dengan pemeriksaan fisik di toko.

JWT CUSTOMER terpisah dari operator. Tindakan khusus ADMIN tetap diperiksa backend. Nomor Member tidak menjadi bukti identitas. Kode tracking/link privat harus dirahasiakan. Kompatibilitas refund historis masih ada pada snapshot commit; WIP penghapusannya belum dipublikasikan.

## Batas verifikasi

Audit 18 Oktober 2026 memisahkan snapshot commit dari WIP lokal. TypeScript / build bukan bukti seluruh alur UI atau pembayaran provider. Lihat [laporan audit pusat](https://github.com/umarmaulanazakaria/barberbarbar/blob/main/docs/audit/AUDIT-SISTEM-TERKINI.md). Pengujian integrasi memakai PostgreSQL fixture dan provider mock; bukan settlement Sandbox baru. Perangkat Android/iOS dan printer fisik belum diuji dalam audit ini. Advisory dependency masih terbuka. **Belum siap dinyatakan rilis penuh; bukan Production.**

## Panduan terbaru dan arsip

- [Panduan teknis dan desain](docs/PANDUAN-SISTEM-TERKINI.md)
- [Matriks audit dan hasil pengujian](docs/audit/AUDIT-SISTEM-TERKINI.md)
- [Acceptance historis](docs/FINAL-ACCEPTANCE-CLOSURE.md)
- [Integrasi Socket.IO/Midtrans historis](docs/INTEGRASI-SOCKET-MIDTRANS.md)

Laporan lama tetap disimpan sebagai snapshot saat ditulis. Jumlah suite, migration, UI dan bukti provider pada laporan lama tidak otomatis menjadi hasil audit terbaru.

## Remediasi dependency terbaru

Prisma diperbarui ke7.10.1 dan audit Backend kini 0. Admin tetap 2 advisory Router; upgrade major memerlukan keputusan. Staff 44 →37 laporan; Customer tetap 0. [Rincian dan bukti remediasi](docs/audit/REMEDIASI-KEAMANAN.md). Angka laporan audit sebelumnya merupakan baseline historis.

## Versi demo pada main

Branch `main` memuat snapshot fitur terbaru yang digabungkan dengan tetap mempertahankan riwayat. Verifikasi rilis memakai build/TypeScript dan fixture/mock lokal; tidak membuat transaksi nyata atau mengubah data operasional. Jalankan demo dengan konfigurasi lokal dan Midtrans Sandbox existing. Pengujian perangkat HP, printer fisik dan pembayaran provider langsung tidak diklaim lulus dari pengujian ini. WIP lokal tetap terpisah dari versi GitHub.
