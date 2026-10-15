# Panduan demonstrasi

Panduan aktif demo lokal/portofolio telah dikonsolidasikan:

- [Menjalankan demo dan menyiapkan fixture aman](PANDUAN-JALANKAN-DEMO.md).
- [Presentasi konsep dan arsitektur](PANDUAN-PRESENTASI.md).
- [Naskah 5 menit dan 10?15 menit](NASKAH-DEMO.md).
- [Acceptance dan batas bukti](DEMO-ACCEPTANCE.md).

Harness browser memakai port loopback acak, sehingga backend 3000/Vite 5173 existing tidak perlu dihentikan. Tetap gunakan database uji kosong terpisah, provider MOCK dan hindari pengujian database paralel. Tidak membuat transaksi Midtrans baru tanpa otorisasi.
