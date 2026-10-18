<div align="center">

# BARBER BARBAR

**Not Cutting Heads, Just Hair.**

### Admin Web & Backend

Satu pusat operasional untuk booking, Membership, walk-in, pelayanan dan pembayaran.

[Admin & Backend](https://github.com/umarmaulanazakaria/barberbarbar/tree/main) · [Staff Mobile](https://github.com/umarmaulanazakaria/barberbarbar-mobile/tree/main) · [Customer Web](https://github.com/umarmaulanazakaria/barberbarbar-customer/tree/main)

</div>

<a href="docs/showcase/dashboard.jpg"><img src="docs/showcase/dashboard.jpg" alt="Dashboard Admin Minimal terbaru dengan data sintetis" width="1200" /></a>

*Dashboard hari ini dalam WIB: aktivitas Booking/Walk-in, status pelayanan dan perhatian operasional.*

> **Tentang gambar:** screenshot diambil ulang dari aplikasi pada source `main` tanggal 18 Oktober 2026. Seluruh respons API untuk capture diintersepsi dengan data sintetis. Tidak ada database atau provider pembayaran yang dihubungi. Status dan nominal contoh adalah ilustrasi UI, **bukan bukti settlement Midtrans**. Tidak ada rekayasa DOM, mockup desain, gambar AI, atau data pelanggan asli. Klik gambar untuk melihat ukuran penuh.

## Di dalam aplikasi

| <a href="docs/showcase/pesanan.jpg"><img src="docs/showcase/pesanan.jpg" alt="Daftar pesanan booking dan walk-in" width="480" /></a> | <a href="docs/showcase/detail.jpg"><img src="docs/showcase/detail.jpg" alt="Drawer detail booking dan ringkasan pembayaran" width="480" /></a> |
| --- | --- |
| **Pesanan** — satu daftar untuk booking dan walk-in. | **Detail & tindakan** — pelanggan, jadwal, layanan dan saldo dalam satu panel. |

| <a href="docs/showcase/membership.jpg"><img src="docs/showcase/membership.jpg" alt="Daftar Membership dengan data member sintetis" width="480" /></a> | <a href="docs/showcase/pembayaran.jpg"><img src="docs/showcase/pembayaran.jpg" alt="Panel pembayaran booking dengan nominal sintetis" width="480" /></a> |
| --- | --- |
| **Membership** — status aktif, masa berlaku dan pengelolaan paket. | **Pembayaran** — DP, pembayaran diterima dan sisa tagihan dari kontrak backend. |

[Asal gambar, versi dan batas capture](docs/showcase/README.md).

## Tiga aplikasi, satu backend

| Aplikasi | Peran |
| --- | --- |
| [Admin Web & Backend](https://github.com/umarmaulanazakaria/barberbarbar/tree/main) | Dashboard operasional, pelanggan, Membership, pesanan, kasir dan laporan. |
| [React Native Staff](https://github.com/umarmaulanazakaria/barberbarbar-mobile/tree/main) | Pelayanan di toko dengan desain Minimal V3: Beranda, Pesanan, Walk-in, Riwayat dan Profil. |
| [Customer Web mobile-first](https://github.com/umarmaulanazakaria/barberbarbar-customer/tree/main) | Katalog, booking tanpa akun, pembayaran dan tracking dari browser HP maupun desktop. |

Ketiganya memakai **Express REST API + Prisma + PostgreSQL** yang sama. Socket.IO memberi sinyal untuk mengambil ulang data REST; harga, kelayakan Member dan status pembayaran tetap ditetapkan backend.

## Dari booking sampai layanan selesai

| Alur | Ringkasan |
| --- | --- |
| Booking Reguler | Pilih layanan, barber dan jadwal; isi identitas tanpa membuat akun. Satu booking memakai slot **45 menit**. |
| DP & konfirmasi | **DP 50%**, batas **15 menit** dari backend. Snap Sandbox bukan penentu status; backend memverifikasi provider sebelum booking dikonfirmasi. |
| Membership | Paket aktif 12 bulan: Haircut + Wash gratis dan layanan lain diskon 10% sesuai kelayakan backend. Booking Member layak tanpa DP; Kartu Member + KTP diperiksa fisik di toko tanpa menyimpan NIK/foto. |
| Walk-in | Operator membuat pesanan Reguler/Member dari toko, memakai quote dan validasi backend yang sama. |
| Pelayanan & pembayaran | Check-in, barber final, pelayanan, selesai, pelunasan sesuai saldo backend, lalu invoice final. Tunai, Transfer dan QRIS mengikuti workflow operator; Snap untuk pembayaran online customer. |

## Teknologi

**React 19 · TypeScript · Vite · Tailwind CSS · React Query · Express 5 · Prisma 7 · PostgreSQL · JWT · Socket.IO · Midtrans Sandbox**

## Menjalankan demo

Gunakan Node.js 24, npm dan PostgreSQL lokal yang sudah disiapkan. Backend di port **3000**, Admin di **5173**, Customer di **5175**. Instalasi lengkap ada pada panel teknis di bawah. Jangan menjalankan reset/seed terhadap database operasional; konfigurasi privat hanya di `server/.env`.

## Bukti pengujian dan batas

Finalisasi `main` sebelumnya meluluskan build/TypeScript, validasi Prisma dan **14 suite integrasi fixture/mock**, ditambah 28 pemeriksaan HTTP baca-saja. Pengambilan gambar ini hanya memeriksa render UI dan privasi; tidak mengulang suite atau membuktikan transaksi baru. Perangkat Android/iOS, printer fisik, advisory dependency tersisa dan bukti provider historis mengikuti [audit terkini](docs/audit/AUDIT-SISTEM-TERKINI.md) serta [remediasi](docs/audit/REMEDIASI-KEAMANAN.md).

**Portofolio dan demo tugas magang; bukan klaim siap Production.**

<details>
<summary><strong>Instalasi, konfigurasi, struktur source dan laporan teknis</strong></summary>

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

</details>
