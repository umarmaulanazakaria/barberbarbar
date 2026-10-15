# Storyboard portofolio 90-120 detik

**Status: storyboard siap; video aplikasi asli belum direkam.** ADB/AVD tidak menemukan perangkat saat pemeriksaan. Lima screenshot Web asli tersedia, tetapi gambar diam bukan rekaman alur Android. Durasi berikut adalah target edit, bukan durasi video yang sudah dihasilkan. Tidak membuat pembayaran/refund atau mengubah database pada tahap dokumentasi ini.

## Versi utama 120 detik

| Waktu | Shot list dan layar | Narasi/caption | Syarat/batas |
|---|---|---|---|
| 00:00-00:10 | Judul dan diagram tiga aplikasi | BARBER BARBAR - Integrated Barbershop Management System. Project akademik dan demo lokal. | Diagram diberi label diagram, bukan UI. |
| 00:10-00:25 | Customer: Beranda, layanan, searchable barber | Customer memilih layanan, jumlah dan barber. | Footage native asli belum tersedia; jangan mengganti dengan UI rekaan. |
| 00:25-00:40 | Customer: jadwal dan detail booking | Booking diajukan untuk konfirmasi operator. | Capture fixture yang sudah aman; jangan membuat data baru pada tugas ini. |
| 00:40-00:55 | Web: daftar dan detail booking | Operator menerima booking melalui backend yang sama. | Lima gambar existing dapat dipakai sebagai slide berlabel screenshot, bukan rekaman interaksi. |
| 00:55-01:10 | Staff: booking/check-in/barber final | Check-in dan layanan mengikuti DP yang telah terverifikasi. | Jangan memaksa prasyarat atau mengedit status database demi video. |
| 01:10-01:25 | Staff layanan dan detail Customer | Socket.IO memberi sinyal; client refetch status dari REST. | Rekam perubahan hanya saat fixture/demo dan tindakan diotorisasi; jika tidak, jelaskan konsep memakai diagram. |
| 01:25-01:40 | Panel pembayaran dan invoice dummy | Nominal server, ledger idempotent dan satu invoice final. | Gambar existing adalah DP MOCK + kasir fixture; jangan menyebutnya checkout Sandbox nyata Android. Gunakan footage Sandbox hanya jika sudah sah/diotorisasi, tanpa URL Snap. |
| 01:40-02:00 | Stack dan tiga repository | React, React Native/Expo, Express, Prisma/PostgreSQL, Socket.IO dan Midtrans Sandbox. Demo Ready With Limitations. | Cantumkan tiga URL GitHub publik; email nyata/refund historis/native rinci masih memiliki batas bukti. |

Versi 90 detik: judul 5s, layanan/barber 12s, jadwal 10s, Web 12s, Staff 12s, sinkronisasi 12s, invoice 12s, ringkasan 15s. Total target 90s. Jangan mempercepat/cut sedemikian rupa sehingga menyiratkan transaksi atau fitur yang tidak terjadi.

## Panduan rekaman

1. Gunakan [panduan screenshot](PANDUAN-SCREENSHOT-PORTOFOLIO.md), data dummy, login sebelum rekaman, tutup notifikasi pribadi dan terminal credential. Rekam pada resolusi asli; label setiap aplikasi.
2. Rekam hanya aplikasi yang benar-benar dapat diakses. Untuk Web, gunakan perekam sistem yang sudah tersedia; jangan membuka UI customer asli. Android dapat memakai screen recorder bawaan atau ADB yang sudah ada.
3. Rekam beberapa klip pendek sesuai shot list. Simpan video mentah secara privat, periksa setiap frame yang memperlihatkan identitas atau alamat browser sebelum publikasi. Gunakan editor existing bila ada; tidak perlu menginstal editor baru.
4. Jika hanya Web tersedia, publikasikan sebagai showcase Web dengan slide screenshot yang diberi label. Jangan mengklaim itu video E2E tiga aplikasi. Rekaman lengkap menunggu akses Staff/Customer native dan fixture aman yang sudah tersedia.
5. Pilih MP4 1080p bila recorder mendukung, audio jelas, landscape untuk Web dan rasio asli untuk mobile. Jangan meregangkan layar HP. Jangan memasukkan file video besar ke Git; taruh video final yang ditinjau pada media pilihan pengguna dan tambahkan URL hanya setelah benar-benar tersedia.

## Checklist sebelum tayang

Tidak ada password/JWT/token reset/URL Snap/Server Key, data pelanggan asli, notifikasi pribadi atau transaksi provider sensitif. Tidak menampilkan raw API. Pisahkan screenshot, mock, Sandbox nyata dan native. Jangan mengklaim email terkirim/refund selesai/Production-ready. Belum ada URL video publik pada README karena video asli belum tersedia.
