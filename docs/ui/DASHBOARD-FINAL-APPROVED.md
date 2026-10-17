# Dashboard Final Approved — BARBER BARBAR

17 Oktober 2026 · repository asli `barberbarbar` · branch `feature/project5-integration`.

## Keputusan dan cakupan

Dashboard memakai empat KPI dan dua panel saja: **Aktivitas hari ini** serta **Perlu Perhatian**. Panel pendapatan tambahan, ringkasan katalog dan filter periode lama dihapus dari Dashboard. Halaman Admin lain, Customer Web dan Mobile Staff tidak didesain ulang.

Screenshot prototipe desktop/HP tidak tersedia pada lampiran; direktori lampiran hanya berisi brief teks. Implementasi mengikuti spesifikasi tertulis, bukan mengaku melihat prototipe. Karena itu **perbandingan pixel-perfect dengan referensi: NOT RUN**.

Audit API menemukan agregat receipt lama belum mencakup DP/pelunasan terverifikasi dan daftar operator mengecualikan AWAITING_DP. Pengguna menyetujui secara eksplisit: **"Izinkan endpoint baca khusus Dashboard"**. Ditambahkan hanya `GET /management/dashboard`, di bawah autentikasi operator existing. Endpoint lama dan aturan finansial tidak diubah. Tidak ada migration, database baru, instalasi dependency, perubahan environment atau transaksi provider nyata.

## Mapping data dan definisi KPI

Sumber data: Booking, Pesanan, Pelanggan, TransaksiPembayaranBooking, BuktiProviderBooking, Pembayaran dan RiwayatBooking existing. Seluruh query memakai satu transaksi RepeatableRead, timezone UTC, dan jam database. Hari operasional memakai `Asia/Jakarta`, interval setengah terbuka `[00.00 WIB, 00.00 WIB berikutnya)`.

| KPI / field API | Definisi |
| --- | --- |
| Booking hari ini / `kpi.bookingHariIni` | Jadwal hari ini dan status valid, termasuk CHECKED_IN, IN_SERVICE dan COMPLETED. CANCELLED, REJECTED, NO_SHOW serta status pending yang deadline-nya lewat tidak dihitung. Bukan hitungan seluruh booking aktif. |
| Menunggu check-in / `kpi.menungguCheckIn` | CONFIRMED, jadwal hari ini, checkInPada null, DP sah pada round aktif/carry yang diizinkan, dibayar sebelum deadline. |
| Sedang dilayani / `kpi.sedangDilayani` | Booking IN_SERVICE ditambah walk-in IN_SERVICE, satu entri per pesanan. Pesanan terkait booking tidak dihitung ulang sebagai walk-in. Tidak dibatasi tanggal agar layanan yang masih berlangsung tetap terlihat. |
| Pembayaran diterima hari ini / `kpi.pembayaranHariIni` | Gross kredit DP/PELUNASAN SUCCEEDED dengan bukti sah dan `dibayarPada` hari ini, ditambah receipt walk-in PAID yang sah (`jumlahDiterima - kembalian`). Tidak menghitung total tagihan sebagai penerimaan, pending/failed, refund, atau receipt invoice booking sebagai kredit kedua. |

Verifikasi proyeksi transaksi mengikuti `bacaRingkasanPembayaran` existing: MIDTRANS wajib bukti yang cocok referensi/nominal/IDR; KASIR hanya pelunasan dengan jumlah diterima dan kembalian. DP juga harus cocok round konfirmasi aktif/carry dan waktu pembayaran paling lambat deadline. Status pembayaran baris dibaca kembali melalui helper ringkasan existing, bukan ditetapkan frontend.

Tidak membuat writer bukti pembayaran baru. Nominal hasil agregat dikonversi dari bigint dengan pemeriksaan safe integer. Nilai penuh Rupiah ditampilkan pada kartu; jika endpoint gagal, tampil error dan tidak membuat angka pengganti.

## Aktivitas, pencarian dan pagination

- Tab **Booking** selalu default saat Dashboard dimount/dibuka kembali. Dataset berisi booking aktif mulai hari ini hingga mendatang, jadwal terdekat lebih dahulu. COMPLETED/terminal/expired dan jadwal sebelum hari ini dikeluarkan sebelum pagination.
- Tab **Walk-in** berisi WAITING, IN_SERVICE dan COMPLETED dengan kedatangan hari ini. Urutan WAITING → IN_SERVICE → COMPLETED, lalu waktu kedatangan dan ID. Pesanan yang punya relasi Booking dikecualikan.
- Tepat lima kolom: Pelanggan, Jadwal/Kedatangan, Status Pelayanan, Status Pembayaran, Aksi Detail. ID menjadi teks sekunder. Pada HP, baris menjadi card ringkas dengan dua status berlabel terpisah.
- Maksimal 10 entri per halaman dari database. **Lihat semua** menampilkan pagination di panel, tanpa pindah route. Satu halaman tidak menampilkan navigasi yang membingungkan.
- Tab/search mengembalikan halaman ke 1. Search nama/nomor diproses server, debounce 250 ms, query key terpisah dan AbortSignal mencegah respons lama menggantikan hasil baru. Hasil lama tidak ditampilkan sebagai hasil search baru saat menunggu debounce.
- Server mengoreksi halaman ke halaman terakhir yang masih ada ketika jumlah data berkurang. Frontend menyelaraskan state tanpa menerapkan metadata placeholder dari query sebelumnya.
- Drawer memakai parameter rincian existing; tab, search, halaman, accordion dan posisi scroll tidak direset saat dibuka/ditutup.

## Perlu Perhatian

Cakupan semua tanggal dan kedua jenis kunjungan. Kategori berjumlah nol tidak dikirim/ditampilkan. Urutan deterministik:

| Urgensi | Dasar data | Urutan entri |
| --- | --- | --- |
| 1. Perlu pemeriksaan | Kredit melebihi tagihan, bukti transaksi tidak cocok, pembayaran pada pembatalan/penolakan yang masih perlu peninjauan, atau receipt walk-in PAID tidak cocok. Kebijakan DP hangus existing tidak diubah. | Jadwal tertua, jenis, ID |
| 2. Check-in terlambat | CONFIRMED dengan DP sah, belum check-in, jadwal telah lewat. Hilang ketika status/check-in resmi berubah. Tidak mengubah status menjadi NO_SHOW sendiri. | Jadwal tertua, jenis, ID |
| 3. Tagihan belum lunas | Layanan COMPLETED dengan sisa kewajiban booking positif, atau walk-in COMPLETED/UNPAID. | Deadline pelunasan bila tersedia, selain itu jadwal/kedatangan tertua; jenis dan ID |
| 4. Menunggu DP | AWAITING_DP/CONFIRMED yang masih valid, DP belum sah, deadline resmi masih di depan. | Deadline paling dekat, jenis dan ID |

Satu pesanan dapat berada di beberapa kategori yang sah, misalnya kelebihan kredit sekaligus terlambat check-in. Kategori yang sama memakai satu identitas jenis+ID, bukan nama pelanggan. Dua booking pelanggan yang sama tetap dua entri.

Satu accordion terbuka pada satu waktu. Setiap request perhatian mengambil maksimal lima entri per kategori/halaman. **Lihat lainnya** menambahkan lima berikutnya melalui infinite query, bukan merender semua riwayat sekaligus. Hasil render dideduplikasi berdasarkan jenis+ID. Refetch mempertahankan accordion dan batch yang sudah dimuat, kecuali kategori tersebut benar-benar tidak ada lagi.

API menerima `jenis`, `halaman`, `cari`, `kategoriPerhatian`, `halamanPerhatian` dengan validasi strict. Payload mengandung KPI, aktivitas berhalaman, kategori/count/halaman/data, serverTime dan hariIni. Tidak mengirim token, hash, referensi provider, nomor telepon atau detail internal transaksi.

## Realtime dan drawer

Query berada di bawah prefix `dashboard` sehingga invalidasi Socket.IO operator existing tetap berlaku. Polling 15 detik dan tombol Perbarui mengambil ulang REST. Jam/day rollover mengikuti serverTime serta hook hari WIB existing. Frontend tidak mengubah status atau mengakui pembayaran berdasarkan event saja.

Drawer existing 450 px dipakai kembali, tanpa menyalin halaman operasional penuh. Data pelanggan/jadwal, layanan aktual, pembayaran dan riwayat tetap dari endpoint existing. Escape/tombol tutup, inert latar, trap/fokus kembali dan scroll tetap berjalan. Tindakan kompleks tetap membuka halaman/modal operasional dengan permission, validasi dan konfirmasi yang sama. Refund aktif tidak dikembalikan.

## Visual dan screenshot

Folder [screenshots/dashboard-final](screenshots/dashboard-final) berisi 34 gambar: delapan BEFORE aktual sebelum implementasi, delapan AFTER, delapan accordion, delapan Walk-in dan dua drawer. Browser memakai client asli dengan fixture API terisolasi untuk reproduksibilitas visual; bukan data dummy yang ditanam pada aplikasi/database utama. Pengujian API/PostgreSQL dan E2E terpisah menggunakan fixture database existing yang dijaga dan dibersihkan.

| Viewport | Sebelum | Sesudah | Hasil |
| --- | --- | --- | --- |
| 320 | [BEFORE](screenshots/dashboard-final/before-320.png) | [AFTER](screenshots/dashboard-final/after-320.png) | PASS |
| 375 | [BEFORE](screenshots/dashboard-final/before-375.png) | [AFTER](screenshots/dashboard-final/after-375.png) | PASS |
| 390 | [BEFORE](screenshots/dashboard-final/before-390.png) | [AFTER](screenshots/dashboard-final/after-390.png) | PASS |
| 768 | [BEFORE](screenshots/dashboard-final/before-768.png) | [AFTER](screenshots/dashboard-final/after-768.png) | PASS |
| 1024 | [BEFORE](screenshots/dashboard-final/before-1024.png) | [AFTER](screenshots/dashboard-final/after-1024.png) | PASS |
| 1280 | [BEFORE](screenshots/dashboard-final/before-1280.png) | [AFTER](screenshots/dashboard-final/after-1280.png) | PASS |
| 1440 | [BEFORE](screenshots/dashboard-final/before-1440.png) | [AFTER](screenshots/dashboard-final/after-1440.png) | PASS |
| 1920 | [BEFORE](screenshots/dashboard-final/before-1920.png) | [AFTER](screenshots/dashboard-final/after-1920.png) | PASS |

[Accordion desktop](screenshots/dashboard-final/after-1440-accordion.png) · [Accordion HP](screenshots/dashboard-final/after-390-accordion.png) · [Walk-in desktop](screenshots/dashboard-final/after-1440-walkin.png) · [Drawer desktop](screenshots/dashboard-final/after-1440-drawer.png) · [Drawer HP](screenshots/dashboard-final/after-390-drawer.png).

### Checklist terhadap spesifikasi tertulis

| Bagian | Hasil review |
| --- | --- |
| Sidebar/topbar | PASS: deep navy dan shell existing dipertahankan, 216 px/64 px; tidak mengubah halaman lain untuk mengejar perkiraan 194 px/63 px tanpa screenshot referensi. |
| Workspace/card | PASS: terang/putih, border halus, indigo, radius12, gap14–15. Secondary text memakai warna existing yang lebih kontras. Tidak ada dark card utama. |
| KPI | PASS: empat kartu seragam, tinggi diukur browser dengan toleransi <=1px; grid auto-rows 1fr menjaga dua baris HP sama tinggi tanpa fixed height yang memotong konten. |
| Dua panel | PASS: kiri lebih lebar di desktop, tidak ada panel tambahan di bawah. Pada <=1199 px disusun vertikal agar kolom Detail tetap terbaca. |
| Tabel/tab | PASS: lima kolom, label pendek, status operasional/finansial berbeda; tab default Booking. |
| Accordion/pagination | PASS: inline satu kategori, lima entri bertahap; pagination10 tetap di panel. |
| Drawer | PASS: pola 450 px existing, fokus/scroll/filter terjaga. |
| HP | PASS: navigasi drawer existing, KPI dua kolom, aktivitas adaptif, tidak ada overflow halaman. |
| Pixel-perfect terhadap prototipe | NOT RUN: gambar referensi tidak tersedia; tidak ada klaim pixel-perfect. |

Perbaikan berdasarkan review gambar: tinggi KPI antarbaris mobile, label status yang terlalu panjang, header tabel yang semula terlalu kecil/rata tengah, dan kolom Detail yang terpecah pada laptop1024. Capture accordion/drawer menggulir ke awal hanya di script screenshot untuk mencegah artefak sticky header; aplikasi tidak ditambah perilaku scroll-ke-atas tersebut.

## Hasil pengujian

| Suite | Hasil |
| --- | --- |
| TypeScript backend | PASS, `tsc --noEmit` |
| Build backend | PASS, `npm.cmd run build` |
| TypeScript frontend / build | PASS, build menjalankan `tsc -b`; JS615,86 kB, CSS69,12 kB. Peringatan chunk>500kB dan anotasi Zod existing masih ada. |
| API/PostgreSQL Dashboard | PASS, 10 kelompok: KPI, bukti transaksi, dedup receipt, valid/expired/selesai, walk-in, pagination/search, kategori/urgensi, penyelesaian masalah, midnight WIB, round reschedule, auth/no-store/DTO. |
| Read-only | PASS, hash snapshot seluruh row fixture sebelum/sesudah HTTP endpoint identik. Bukti provider tidak sah ditolak constraint existing; constraint tidak dilemahkan. |
| Browser Dashboard | PASS, 15 kasus; delapan viewport dan interaksi. Tambahan assertion scroll/search setelah drawer, respons pencarian lama terlambat, accordion tetap terbuka saat refresh dan batch5+5+2 diuji ulang terarah. |
| Browser modul Admin existing | PASS, 27 cakupan: 26 lulus full run; satu tes kontras diulang dan lulus setelah selector tombol lama yang sudah tidak ada diganti ke tombol tab aktif. Bukan menurunkan ambang AA. |
| SSR/REST/Socket frontend existing | PASS, 9 kelompok. |
| Browser E2E/API/PostgreSQL | PASS, 11 kelompok: login ADMIN/STAFF, membership, booking baru masuk Dashboard tanpa reload setelah halaman siap, drawer, DP MOCK, check-in/barber final/IN_SERVICE, edit layanan, COMPLETED, pelunasan kasir dan invoice PAID/balance0. |
| Cleanup fixture Dashboard | PASS, hanya ID milik suite dibersihkan, model kembali kosong. Tidak reset sequence atau database. |
| Cleanup fixture E2E | PASS, snapshot22 model identik. |
| Provider Midtrans nyata | NOT RUN, sesuai brief. Tidak ada request provider nyata. |
| Perangkat Android / uji beban besar | NOT RUN; di luar perubahan satu halaman. |

Tidak ada kegagalan kritis yang dibiarkan pada implementasi Dashboard. Kegagalan antara berasal dari fixture awal yang belum mengikuti constraint deadline/UTC/proof existing, tinggi KPI mobile, selector kontras lama, dan interaksi tes pada baris fixture yang sedang diganti saat refetch; semuanya dikoreksi dan tes terkait diulang.

## File berubah

Frontend produksi:

- `client/src/pages/DashboardPage.tsx`: struktur dan interaksi Dashboard final.
- `client/src/pages/DashboardFinal.css`: styling khusus Dashboard; stylesheet/layout global tidak diubah.
- `client/src/lib/dashboard-final.ts`: tipe DTO dan GET authenticated dengan AbortSignal.

Endpoint baca yang disetujui:

- `server/src/services/dashboard-final.service.ts`.
- `server/src/controllers/dashboard-final.controller.ts`.
- `server/src/routes/manajemen.routes.ts`: menambah GET dashboard, GET orders lama tetap.

Pengujian:

- `server/scripts/test-dashboard-final.mjs`.
- `client/playwright.dashboard.config.ts`.
- `client/tests/dashboard-final.spec.ts`, `client/tests/fixtures/dashboard.ts`.
- `client/tests/admin-minimal.spec.ts`, `client/tests/fixtures/admin.ts`: adaptasi fixture/selector Dashboard; cakupan modul lain dipertahankan.
- `client/scripts/test-e2e-browser.mjs`: sumber booking realtime diarahkan ke Dashboard final sebelum membuka drawer.

Dokumentasi: laporan ini serta 34 PNG di `docs/ui/screenshots/dashboard-final/`.

## Git dan perlindungan historis

HEAD awal `5bb3b22e3bc29ca81d776cf6943e9b198ddf9a09`. Status staged/unstaged/untracked dan SHA-256 berkas WIP disimpan privat sebelum implementasi. Dashboard dan route manajemen bersih sebelum patch, sehingga perubahan fitur dapat dipisahkan.

Verifikasi baseline: 13 berkas WIP Project3 termasuk Prisma staged, lima berkas Staff termasuk dua file historis, dan 18 berkas Customer tetap identik. Index ketiga repository tetap sama. `RingkasanBookingDashboard.tsx`, `F10-AUDIT.md`, pekerjaan refund backend sebelumnya, source Staff dan Customer tidak disertakan ke commit Dashboard.

Satu commit lokal khusus Dashboard menggunakan allowlist dan index sementara agar staged Prisma tidak ikut commit. Index asli diselaraskan hanya untuk path yang di-commit, lalu diff staged historis diperiksa kembali. Judul commit: **"Terapkan dashboard dengan KPI terverifikasi dan aktivitas berhalaman"**. Hash final adalah hash commit yang memuat laporan ini dan dilaporkan di jawaban akhir. Tidak push, merge, PR, deploy atau rewrite history.

## Menjalankan ulang

Dari `barberbarbar/client` dengan Vite existing localhost5173:

```powershell
npm.cmd run build
node scripts/test-integrasi-web.mjs
node node_modules/@playwright/test/cli.js test --config playwright.dashboard.config.ts
node node_modules/@playwright/test/cli.js test --config playwright.admin.config.ts
```

Dari server: `npm.cmd run build`. Script `test-dashboard-final.mjs` hanya menerima DATABASE_URL fixture bernama `bb_guest_20261016_<8hex>`; runner privat menyiapkan koneksinya tanpa menyimpan credential di repository. Jangan menjalankannya terhadap database utama.

## Keterbatasan

Referensi screenshot prototipe belum tersedia, sehingga kesamaan visual hanya dapat diverifikasi terhadap spesifikasi dan BEFORE/AFTER aplikasi. Uji beban besar belum dijalankan; endpoint melakukan agregasi read-only dan membaca ringkasan pembayaran authoritative untuk entri yang ditampilkan. Tidak ada kebutuhan migration atau perubahan aturan finansial yang tersisa untuk fitur ini. Pekerjaan lama di working tree tetap terpisah dan belum dinyatakan selesai oleh laporan Dashboard ini.
