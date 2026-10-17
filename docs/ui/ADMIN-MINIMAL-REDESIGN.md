# Admin Minimal — implementasi dan verifikasi

Tanggal: 17 Oktober 2026. Repository asli `barberbarbar`, branch `feature/project5-integration`.

## Acuan dan batas pekerjaan

Prototipe interaktif tidak tersedia sebagai source atau tab yang dapat diakses. Implementasi mengikuti spesifikasi tertulis Admin Minimal dari pengguna: sidebar navy, workspace terang, kartu putih, tabel operasional, serta drawer kanan. Tidak mengklaim melihat prototipe.

Audit awal menemukan HEAD `f9cc10979283e4aecb620f22bf8ad58e9327c891`, Prisma historis staged, dan pekerjaan penghapusan refund serta desain gelap yang belum di-commit. Snapshot diff, index dan berkas diambil secara privat sebelum perubahan. Backend 3000 dan Vite Admin 5173 yang sudah berjalan dipakai tanpa menjalankan backend utama duplikat.

Pekerjaan ini hanya menyunting frontend Admin, tes frontend, pengecualian keluaran tes, dan dokumentasi. Perubahan backend/Staff/Customer dari pekerjaan sebelumnya dipertahankan tanpa disunting atau dimasukkan ke commit UI. Tidak mengubah package/lock, environment, autentikasi, kontrak API, Prisma, migration, ledger, idempotency, webhook, maupun data pengguna. Tes database memakai database fixture existing terisolasi; tidak melakukan reset/migration.

## Inventaris route aktual

| Route | Presentasi dan fungsi yang dipertahankan |
| --- | --- |
| `/` | Empat KPI, tabel aktivitas hari ini/mendatang, perhatian, pendapatan dan ringkasan katalog |
| `/orders` | Tabel booking/walk-in, pencarian, jenis, tanggal/rentang, status, pembayaran, pagination |
| `/history` | Filter riwayat dengan tabel dan drawer yang sama |
| `/orders/booking/:id` | Workflow booking lengkap, barber final, layanan aktual, pembayaran, riwayat dan pemulihan tracking |
| `/customers` | Tabel pelanggan, permohonan pengaitan ADMIN, form, blokir/buka blokir dan konfirmasi |
| `/membership` | Tabel, permohonan ADMIN, pencarian pelanggan, diskon dan status existing |
| `/barbers` | Tabel, filter dan form barber sesuai role |
| `/services` | Tabel harga/durasi/status, form dan aksi ADMIN; STAFF membaca saja |
| `/invoices` | Invoice lunas, filter, detail serta dokumen cetak existing |
| `/reports` | Empat KPI seragam, rentang tanggal, pendapatan resmi, grafik dan tabel |
| `/settings` | Akun staf dan validasi konfirmasi kata sandi; navigasi hanya ADMIN |
| `/login` | Form autentikasi existing, label/autocomplete dan shell masuk konsisten |

Alias `/bookings`, `/bookings/:id`, `/orders/:id` dan `/orders/:id/payment` tetap berfungsi. `/refunds` mengarah ke dashboard; menu, halaman dan aksi refund aktif tidak ditampilkan. Sinyal historis refund masih menginvalidasi data keuangan melalui REST; bukan akses ke workflow refund baru.

## Bukti perubahan struktur

| Area | Sebelum | Sesudah |
| --- | --- | --- |
| Shell | Sidebar 236 px, topbar 76 px, workspace gelap | Sidebar 216 px, topbar 64 px, workspace terang dengan padding 24–28 px |
| Header dashboard | Sambutan panjang, judul dan elemen dekoratif | Judul serta satu baris konteks operasional WIB |
| KPI | Desain kartu terpisah dari modul lain | `StatCard` reusable, empat kolom `minmax(0,1fr)`, padding/ikon/value seragam |
| Aktivitas | Dua tabel bertumpuk ditambah tiga panel samping | Satu tabel dengan pilihan hari ini/mendatang, berdampingan dengan panel Perlu perhatian |
| Dukungan dashboard | Akses cepat dan paragraf panjang | Pendapatan resmi dan ringkasan resource yang benar-benar disediakan API |
| Pesanan | Presentasi ringkasan lama, tautan langsung ke halaman detail | Tabel ringkas pelanggan/identitas, jadwal/barber, status, total dan detail; daftar ringkas pada mobile |
| Detail cepat | Harus masuk halaman penuh atau modal besar | Drawer khusus 450 px dengan enam bagian ringkas; halaman penuh tetap untuk tindakan kompleks |
| Konteks daftar | Navigasi berpindah halaman | Parameter `rincianBooking`/`rincianPesanan` menyimpan filter dan halaman; Escape/tutup menghapus hanya parameter detail |
| Informasi lanjutan | Riwayat dan pemulihan tracking selalu panjang | Riwayat dan pemulihan memakai progressive disclosure, semua kemampuan tetap tersedia |
| Permohonan kosong | Kartu kosong tinggi mengambil area utama | Header panel yang sama, empty state ringkas, keputusan ADMIN tetap tersedia |
| Laporan | Lima kartu ad hoc | Empat `StatCard` seragam; pendapatan tetap tampil pada panel grafik |

Kartu tabel tidak dipaksa setinggi KPI. Tidak menambahkan barber bertugas, layanan populer, tren persentase atau jumlah notifikasi yang tidak disediakan API. Jika metrik gagal dimuat, tampil error; tidak menggantinya dengan angka nol palsu.

## Komponen dan design system

- `admin.css`: satu token system terang; menggantikan stylesheet desain gelap yang belum dilacak. Sidebar `#101B30`, workspace `#F7F8FB`, teks `#172338`, aksen `#4F46E5`, radius kartu 12 px. Secondary text `#657187` dipilih untuk kontras normal yang lebih baik daripada referensi `#788398`.
- `AppLayout`: shell yang sama untuk semua route, sidebar berbasis role, navigasi mobile dengan inert/focus trap/Escape, topbar dan skip link.
- `ui.tsx`: `StatCard`, `ContentPanel`, `SectionHeader`, `PageHeader`/`PageTitle`, `StatusBadge`, `EmptyState`/`Empty`, loading/error, kontrol dan modal. Alias menjaga pemanggil existing kompatibel.
- `RincianPesananDrawer`: bukan halaman detail lama yang dimasukkan ke panel. Data pelanggan/jadwal memakai label/value; layanan memakai baris qty × harga dan subtotal; pembayaran ringkas; perkembangan dari timestamp resmi.
- `fokus-dialog.ts`: fokus dialog teratas, trap Tab, pemulihan fokus setelah latar tidak lagi inert; tidak mencuri fokus dari dialog bertingkat yang baru dibuka.
- Tabel, form, badge dan konfirmasi memakai ritme yang sama di seluruh modul. Label field terhubung ke input. Keterangan dan teks tombol diringkas dalam Bahasa Indonesia.

### Data dan keamanan drawer

Booking, pembayaran dan Pesanan terkait dibaca dari endpoint authenticated existing. Item layanan aktual memakai Pesanan terkait ketika sudah terbentuk, bukan diam-diam menampilkan snapshot reservasi lama sebagai layanan aktual. Jika item aktual atau ringkasan pembayaran tidak dapat dimuat, tampil error spesifik; tidak membuat nilai pembayaran diterima sendiri.

Jumlah dibayar, balance dan status finansial booking berasal dari ringkasan backend. Pending tidak diakui sebagai uang diterima. Walk-in lunas mengikuti status PAID beserta bukti pembayaran existing. Barber dan kontak berasal dari DTO operator yang sudah diizinkan. Timeline hanya menampilkan waktu dibuat dan riwayat resmi terakhir; riwayat lengkap tetap ada pada detail.

Drawer menahan scroll latar, menjadikan shell inert, mendukung Escape/Tab/Shift+Tab/tombol tutup/backdrop, memulihkan fokus pemicu dan mempertahankan query filter. Query key sama dengan invalidasi Socket.IO existing, ditambah polling 15 detik dan tombol Perbarui. Tombol pengelolaan membuka workflow existing; drawer tidak menambah endpoint mutasi atau melewati konfirmasi/permission.

## Screenshot dan review visual

Semua screenshot memakai Chrome existing dengan data fixture API browser terisolasi. Nama dan angka pada screenshot adalah data uji; bukan bukti nilai produksi atau settlement provider nyata. Produk tetap membaca API existing, tanpa mode demo baru.

Folder: [screenshots/admin-minimal](screenshots/admin-minimal).

- `before-{1440,1024,390,320}-{modul}.png`: 44 baseline aktual desain gelap sebelum perubahan Admin Minimal.
- `after-{1440,1024,390,320}-{modul}.png`: 44 screenshot modul terbaru.
- Screenshot tambahan: dialog layanan, membership, akun staf; drawer booking/walk-in, pembayaran, detail invoice dan invoice cetak. Frame animasi dinonaktifkan saat capture agar tidak salah membaca opacity transisi sebagai tampilan akhir.
- Tidak ada drawer pada baseline lama. Pembanding struktur drawer adalah baseline detail booking penuh. Baseline khusus modal pembayaran sebelum perubahan tidak sempat direkam; tidak direkayasa sebagai screenshot BEFORE.

| Perbandingan | Sebelum | Sesudah |
| --- | --- | --- |
| Dashboard desktop | [1440](screenshots/admin-minimal/before-1440-dashboard.png) | [1440](screenshots/admin-minimal/after-1440-dashboard.png) |
| Dashboard mobile | [390](screenshots/admin-minimal/before-390-dashboard.png) | [390](screenshots/admin-minimal/after-390-dashboard.png) |
| Pesanan desktop | [1440](screenshots/admin-minimal/before-1440-pesanan.png) | [1440](screenshots/admin-minimal/after-1440-pesanan.png) |
| Detail | [Halaman lama](screenshots/admin-minimal/before-1440-detail-booking.png) | [Drawer desktop](screenshots/admin-minimal/after-1440-drawer-booking.png) / [mobile](screenshots/admin-minimal/after-390-drawer-booking.png) |
| Pelanggan | [Sebelum](screenshots/admin-minimal/before-1440-pelanggan.png) | [Sesudah](screenshots/admin-minimal/after-1440-pelanggan.png) |
| Barber | [Sebelum](screenshots/admin-minimal/before-1440-barber.png) | [Sesudah](screenshots/admin-minimal/after-1440-barber.png) |
| Layanan | [Sebelum](screenshots/admin-minimal/before-1440-layanan.png) | [Sesudah](screenshots/admin-minimal/after-1440-layanan.png) |
| Invoice | [Sebelum](screenshots/admin-minimal/before-1440-invoice.png) | [Sesudah](screenshots/admin-minimal/after-1440-invoice.png) |
| Pembayaran | Tidak tersedia | [Desktop](screenshots/admin-minimal/after-1440-pembayaran.png) / [mobile](screenshots/admin-minimal/after-390-pembayaran.png) |

Review manual melalui gambar browser dilakukan pada dashboard, pesanan, pelanggan, membership, barber, layanan, invoice, pengaturan, laporan, detail booking, drawer serta pembayaran. Temuan yang diperbaiki: lebar filter periode berlebihan; border paginator terlalu gelap; panel kosong terlalu tinggi; label grafik gelap; pemulihan fokus saat latar masih inert; screenshot modal yang tertangkap saat transisi opacity; tinggi modal pembayaran mobile yang memotong tombol paling bawah (body kini menyusut dengan flex dan tetap dapat digulir). Tabel lebar katalog/keuangan tetap bisa digeser pada mobile dengan petunjuk, tanpa overflow halaman.

## Hasil pengujian

| Pemeriksaan | Hasil aktual |
| --- | --- |
| TypeScript `tsc --noEmit -p tsconfig.app.json` | PASS |
| Production build `npm.cmd run build` | PASS; 610,56 kB JS, peringatan chunk >500 kB dan anotasi Zod existing tetap ada |
| Browser Admin Minimal, 27 kasus | PASS pada source final; termasuk fokus, konteks filter, layanan aktual, error pembayaran, kasir, invoice serta tombol simpan utuh |
| Delapan viewport: 320, 375, 390, 768, 1024, 1280, 1440, 1920 | PASS pada source final, seluruh 11 route tanpa overflow halaman dan tanpa pageerror |
| SSR/REST/Socket frontend, 9 kelompok | PASS; renderer tabel diubah agar menguji URL drawer yang baru |
| Modul API/PostgreSQL/browser, 10 kelompok | PASS; CRUD, konflik/validasi, izin ADMIN/STAFF, kasir/invoice dan navigasi route aktual |
| Browser E2E lifecycle, 11 kelompok | PASS; daftar → drawer → kelola booking, DP MOCK → check-in → barber final → IN_SERVICE → ubah layanan → COMPLETED → kasir → PAID/balance 0/invoice |
| Membership/realtime antarklien | PASS melalui Web nyata serta adapter SDK Staff dan CUSTOMER historis; bukan perangkat Android |
| Cleanup fixture modul | PASS, 24 model kosong kembali; database utama tidak dipakai |
| Cleanup fixture lifecycle | PASS, snapshot 22 model identik |
| Refund aktif | PASS; tidak ada menu/halaman/aksi, URL lama redirect; pembatalan berbayar ditolak tanpa membuat refund atau mengirim request provider |
| Provider Midtrans nyata | NOT RUN, sesuai larangan brief; hanya MOCK |
| E2E perangkat Android | NOT RUN; tidak mengklaim perangkat fisik lulus |
| Git diff whitespace dan perlindungan historis | PASS sebelum commit; diperiksa ulang setelah commit |

Kegagalan antara yang diselesaikan: selector tes lama masih mencari tautan langsung booking; pemulihan fokus drawer; perhitungan kontras tes lama salah menganggap OKLCH sebagai RGB. Tes kontras kini mengambil RGB ter-render melalui canvas browser, mempertahankan ambang AA 4,5:1 untuk pasangan teks/tombol/badge representatif. Ini pemeriksaan aksesibilitas dasar, bukan sertifikasi WCAG menyeluruh.

## Git, berkas dan commit lokal

Source inti: `client/src/admin.css`, `components/AppLayout.tsx`, `components/ui.tsx`, `components/RincianPesananDrawer.tsx`, `components/TabelPesananTerpadu.tsx`, `components/DaftarPesananTerpadu.tsx`, `pages/DashboardPage.tsx`, `lib/fokus-dialog.ts`, `main.tsx`.

Modul pendukung: halaman Customers, Membership, Barbers, Services, Invoices, Reports, Settings, Login dan DetailBooking; NewOrderModal, OrderDetailModal, PaymentModal, PembayaranBooking, PemulihanTracking serta dua komponen permohonan ADMIN. Penghapusan tampilan refund dari pekerjaan sebelumnya tetap dipertahankan dalam App, helper frontend dan penghapusan RefundPage.

Tes: `playwright.admin.config.ts`, `tests/admin-minimal.spec.ts`, `tests/fixtures/admin.ts`, serta penyesuaian script integrasi Web/browser. `.gitignore` hanya menambah keluaran Playwright sementara.

Perlindungan yang terverifikasi:

- SHA-256 `server/src/lib/prisma.ts`, Staff `src/layar/LayarTambahPelanggan.tsx` dan `src/layanan/booking.ts` identik dengan baseline historis.
- Index ketiga repository sama dengan snapshot sebelum commit UI. Prisma tetap satu-satunya berkas staged historis Project 3.
- Sebelas berkas WIP di luar UI Project 3, empat Staff dan delapan belas Customer Web identik dengan snapshot awal pekerjaan Admin Minimal.
- `client/src/components/RingkasanBookingDashboard.tsx` dan `docs/audit/F10-AUDIT.md` tidak disertakan ke commit desain agar perubahan historis tidak ikut terambil.
- Commit memakai index sementara dengan allowlist path, lalu menyelaraskan hanya entri index path yang telah di-commit. Tidak memakai reset/restore, staging massal atau mengubah index Prisma.

Commit source lokal: `8e5a6c0a6e4c7b2edc7beccbb6aa447a5faf8bff` ? "Tata ulang admin dengan dashboard ringkas dan drawer pesanan" (38 path frontend/tes/.gitignore). Commit dokumentasi dan 110 screenshot dibuat terpisah dengan judul "Dokumentasikan pengujian dan tampilan admin minimal"; hash tersedia pada commit yang memuat laporan ini. Index Prisma diverifikasi identik sesudah commit source. Tidak push, merge, PR atau deploy.

## Batasan dan pekerjaan tersisa

Tidak ada modul aktif yang sengaja dibiarkan memakai shell gelap lama. Workflow kompleks tetap pada detail/modal yang terstruktur; drawer berfungsi sebagai pembacaan cepat. Sorting baru tidak ditambahkan karena API/UI existing tidak menyediakannya. Tidak membuat panel barber bertugas atau layanan populer tanpa data.

Batasan bukti: baseline modal pembayaran tidak tersedia; prototipe interaktif tidak dapat diakses; uji Android dan provider nyata tidak dijalankan. Peringatan bundle existing belum dioptimalkan karena code splitting bukan kebutuhan perbaikan ini. Penyelesaian perubahan backend/Staff/Customer dari pekerjaan sebelumnya tetap terpisah dari commit UI.

## Menjalankan ulang pemeriksaan frontend

Dari `barberbarbar/client`, memakai dependency existing:

```powershell
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
npm.cmd run build
node scripts/test-integrasi-web.mjs
node node_modules/@playwright/test/cli.js test --config playwright.admin.config.ts
```

Tes browser config ini memakai Vite existing `http://localhost:5173` dengan API diintersep fixture; tidak memanggil provider atau menulis database. Script `test-modul-admin-browser.mjs` dan `test-e2e-browser.mjs` terpisah memakai API/database fixture dan menolak database utama. Koneksi fixture hanya disiapkan melalui runner privat, tanpa menulis credential ke repository.
