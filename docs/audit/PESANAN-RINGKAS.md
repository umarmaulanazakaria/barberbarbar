# Perapian Pesanan Terbaru dan daftar Pesanan

16 Oktober 2026 WIB. Dikerjakan langsung pada Project3 asli `Stage 2/barberbarbar`, branch `feature/project5-integration`, basis78c47be641a3c11b9b61769c53b8102c08cfa2d2. Alamat pengujian dan operasional tetap http://localhost:5173, backend3000. Tidak membuat folder project/worktree, memasang dependency, mengubah konfigurasi pribadi/database, push, merge atau PR.

## Tampilan dan navigasi

Dashboard menampilkan tepat4 kolom Pelanggan / Jam / Barber / Status. Nama pelanggan menjadi tautan utama, dengan label Booking/Walk-in di bawahnya. Jam memakai formatter Asia/Jakarta tanpa tanggal berulang. Kode booking/order/invoice, pembayaran, check-in, total dan aksi terpisah tidak lagi tampil pada tabel Dashboard. Informasi tersebut tetap tersedia di detail existing.

Menu Pesanan juga memakai nama sebagai kolom utama, tanpa kode panjang. Jadwal lengkap WIB, barber, status, pembayaran/total dan Detail tetap tersedia. Seluruh filter/pencarian/pagination existing dipertahankan; pencarian nomor booking/order tidak bergantung pada kode yang ditampilkan. Riwayat tetap memakai tabel lengkap lama; halaman Invoice tidak diubah.

Desktop memakai tabel dengan lebar sesuai container, tanpa minimum950px pada tampilan ringkas. Dashboard beralih ke daftar kartu di bawah768px; Pesanan di bawah1024px. Nama dan barber dapat membungkus, tanpa pemotongan paksa. Seluruh kartu mobile dapat dibuka. Baris desktop dapat diklik; tautan nama tetap dapat dipakai melalui keyboard dan navigasi browser biasa. Sidebar, navbar, warna dan susunan kartu Dashboard tidak didesain ulang.

Semua navigasi menggunakan bookingId/pesananId asli. Booking, termasuk linked order, membuka DetailBookingPage existing yang memuat tindakan operasional dan pembayaran booking. Walk-in membuka OrderDetailModal existing dan mempertahankan filter/page URL. Nama identik bukan identifier. Tidak membuat nomor pendek atau status backend baru.

Status ringkas hanya label presentasi untuk enum existing: Menunggu, Menunggu DP, Dikonfirmasi, Check-in, Dilayani, Selesai, Dibatalkan, Ditolak, Tidak hadir. StatusBadge memperoleh properti label opsional; default semua pemakaian existing tetap sama, termasuk Riwayat dan informasi pembayaran.

Query Dashboard HARI_INI, batas7, aturan WIB/deduplikasi, query keys, polling dan invalidate Socket.IO tidak berubah. Tidak ada perubahan backend/schema/migration/financial/ledger/Midtrans/DP/refund/invoice.

## Pengujian aktual

| Pemeriksaan | Hasil |
| --- | --- |
| TypeScript Web (`node node_modules/typescript/bin/tsc -b`) | PASS |
| Build Vite CLI existing | PASS;1933 modules |
| Backend TypeScript/build (`npm.cmd run build`) | PASS |
| Browser Chrome di http://localhost:5173 | 8 kelompok PASS, diulang dan tetap PASS |
| Viewport320/375/430/768/1024/1440 | PASS; Dashboard dan Pesanan tanpa overflow halaman maupun tabel/list |
| Nomor booking/order dicari walau tidak ditampilkan | PASS |
| Klik baris linked booking, kartu mobile, Detail walk-in | PASS; ID asli dan nomor lengkap benar |
| Booking besok, filter jenis/status/pembayaran, pagination | PASS |
| Riwayat dan Invoice existing | PASS; layout Riwayat tetap lengkap, invoice linked terbuka |
| Mutasi API/provider dari suite browser | Nol; API non-GET diblokir dan tidak ada percobaan mutasi |
| Pageerror browser | Nol |
| Source backend, protected files dan staging historis | Identik dengan checkpoint |

Screenshot di folder checkpoint yang sudah ada `Stage 2/.audit-integrasi-20261016/browser/`:

- `dashboard-ringkas-desktop.png`
- `dashboard-ringkas-mobile.png`
- `pesanan-ringkas-desktop.png`
- `pesanan-ringkas-mobile.png`

Screenshot memakai data existing dari backend, tanpa mock REST, injeksi respons, fixture baru atau perubahan tanggal/nama. Data Sandbox yang memang sudah tersimpan tetap ditampilkan apa adanya. Tidak menyalin screenshot berisi data lokal ke Git. Sesi operator uji ADMIN existing disediakan runner privat sebagai JWT berumur10menit hanya melalui environment proses; token/credential tidak dicetak/disimpan ke repository. Ini bukan pengujian ulang form login.

Suite baru `test-ringkasan-pesanan-browser.mjs` hanya membaca backend nyata; membutuhkan ADMIN_UI_TOKEN privat dan memakai folder screenshot existing bila ADMIN_UI_ARTIFACTS disetel. Suite fixture lama diperbarui selectornya agar memakai href ID asli dan empat kolom; hanya syntax-check pada tugas ini, tidak dijalankan karena suite tersebut menulis fixture. Suite finansial/checkout dan pengujian Android tidak diulang untuk perubahan presentasi ini.

### Catatan environment build

`npm.cmd run build` frontend awalnya gagal karena direktori wrapper `client/node_modules/.bin` tidak ditemukan. Paket TypeScript5.9.3 dan Vite7.3.6 sendiri masih tersedia. Build equivalent dijalankan langsung dengan CLI terpasang, tanpa install, pembuatan shim, atau perubahan package/lock:

```powershell
node node_modules/typescript/bin/tsc -b
node node_modules/vite/bin/vite.js build --configLoader runner
```

Keduanya PASS. Wrapper npm frontend tetap merupakan keterbatasan environment lokal; runtime Vite utama yang memakai CLI langsung tetap aktif. Warning bundle lebih500kB dan anotasi Zod tetap ada; tidak dilakukan refactor unrelated.

### Database dan aktivitas bersamaan

Snapshot24 tabel read-only diambil sebelum/sesudah tes. Snapshot keseluruhan tidak identik karena booking tamu baru3747 dibuat selama pekerjaan, lalu mendapat entri pelayanan/pembayaran dari aktivitas yang berlangsung bersamaan. Suite browser sendiri mencatat nol request mutasi dan nol request provider; runner DB hanya menjalankan transaksi READ ONLY. Tidak melakukan rollback, restore, penghapusan atau perubahan pada booking tersebut.

Audit lanjutan memakai SELECT dalam satu snapshot RepeatableRead, memisahkan graph booking3747 hanya untuk perbandingan: booking, pelanggan barunya, akses tamu, item/riwayat, order terkait, transaksi/evidence/Snap dan dependensi invoice/pembayaran. Seluruh row yang sudah ada sebelum pekerjaan pada24 tabel, termasuk ledger/evidence/invoice dan migration, memiliki count/hash identik dengan baseline. Ini bukan klaim bahwa seluruh database live berhenti berubah. Bukti hasil perbandingan tanpa data pribadi tersimpan di checkpoint `ui-verifikasi-konkuren.json`. Tidak mengklaim pembayaran baru tersebut sebagai hasil pengujian perubahan UI.

## File dan Git

- `client/src/components/RingkasanPesanan.tsx`: presentasi ringkas desktop/mobile.
- `client/src/components/TabelPesananTerpadu.tsx`: pilihan tampilan; default tabel lengkap tetap dipakai Riwayat.
- `client/src/components/DaftarPesananTerpadu.tsx`: mengaktifkan tampilan ringkas hanya menu Pesanan.
- `client/src/pages/DashboardPage.tsx`: tampilan Dashboard empat kolom dan container min-width0.
- `client/src/components/ui.tsx`: label badge opsional, default tidak berubah.
- `client/scripts/test-ringkasan-pesanan-browser.mjs`: regresi UI read-only baru.
- `client/scripts/test-pesanan-terpadu-browser.mjs`: selector fixture diselaraskan dengan tampilan.
- `docs/audit/PESANAN-RINGKAS.md`: laporan ini.

Checkpoint source/staging sebelum perubahan: `.audit-integrasi-20261016/ui-baseline.json`. Protected `server/src/lib/prisma.ts` tetap staged dan isi patch identik, `RingkasanBookingDashboard.tsx` serta `F10-AUDIT.md` tetap unstaged dan hash identik. Commit hanya8 file di atas melalui path eksplisit, tanpa menyertakan perubahan historis. Tidak ada perubahan Project4/Native Customer/Customer Web atau folder project baru.
