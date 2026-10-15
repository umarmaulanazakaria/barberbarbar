# Dasar diagram arsitektur

[SVG arsitektur](barberbarbar-architecture.svg) adalah diagram dokumentasi yang dibuat dari source, bukan screenshot aplikasi. Tidak menggunakan gambar AI, layanan tambahan, credential atau alamat tunnel aktual.

| Koneksi | Referensi source Project 3 | Arti |
|---|---|---|
| Client ke REST backend | client/src/lib/api.ts, server/src/app.ts; layanan API kedua mobile | Operasi utama/response HTTP; identitas dan role diperiksa server. |
| Backend ke PostgreSQL | server/src/lib/prisma.ts, prisma/schema.prisma | Prisma/adapter-pg menyimpan data domain, ledger dan invoice. File historis lokal tidak diubah. |
| Backend ke Midtrans | server/src/lib/midtrans.ts, services/midtrans-booking.service.ts | Snap dan pemeriksaan status memakai kredensial server, bukan nominal frontend. |
| Webhook provider ke backend | routes/midtrans.routes.ts, services/midtrans-booking.service.ts; scripts/jalankan-proxy-webhook.mjs | Development: HTTPS ngrok ke loopback proxy3001, hanya POST /midtrans/notifications; signature dan status diverifikasi backend. |
| Socket.IO ke client | server/src/realtime/server.ts; layanan realtime Web/Staff/Customer | Socket client terhubung dengan JWT, room sesuai peran/pemilik; server memberi sinyal refetch dan REST mengambil state terbaru. |
| Jadwal dan transaksi | server/src/services/booking.service.ts | Lock transaksi, durasi dan kapasitas divalidasi backend sebelum perubahan booking. |

Arah panah menunjukkan alur utama request atau notifikasi; response HTTP tidak digambar terpisah. Koneksi Socket.IO dan refetch tidak menentukan status pembayaran. SVG dapat dibuka tanpa JavaScript atau font eksternal; alt text dan deskripsi tersedia untuk pembaca layar. Tampilan harus ditinjau pada ukuran README desktop dan mobile.
