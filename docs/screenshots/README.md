# Screenshot Web aktual

Diambil oleh harness `client/scripts/test-e2e-browser.mjs` menggunakan Edge headless existing, viewport 1280×800 dan halaman Web asli. Fixture dibuat pada database demo kosong terpisah; provider pembayaran **MOCK**, bukan Sandbox nyata. JPEG kualitas 78 mengurangi ukuran repository. Tidak merekayasa DOM untuk mengubah status atau meniru Android.

| Berkas | Tampilan |
|---|---|
| [dashboard.jpg](dashboard.jpg) | Dashboard sesudah login ADMIN dummy |
| [booking-management.jpg](booking-management.jpg) | Booking baru dari SDK Customer pada daftar Web |
| [detail-booking.jpg](detail-booking.jpg) | Detail booking sesudah konfirmasi |
| [payment-management.jpg](payment-management.jpg) | Panel pembayaran booking lunas, balance/invoice; kasir fixture |
| [membership.jpg](membership.jpg) | Membership fixture setelah persetujuan ADMIN |

Semua nama/identitas di gambar adalah data dummy; tidak ada credential, URL Snap, token atau data pelanggan asli. Payment ditampilkan pada detail booking karena di sanalah UI manajemen pembayaran booking berada.

Reproduksi: [panduan demo](../PANDUAN-JALANKAN-DEMO.md). Set `BB_CAPTURE_SCREENSHOTS=1` sebelum harness; capture menolak database selain loopback `bb_demo_*` dan menolak database yang tidak kosong. Default tes tidak menulis gambar. Tinjau setiap gambar sebelum publikasi; jangan mengambil screenshot login berisi password atau browser berisi URL checkout.
