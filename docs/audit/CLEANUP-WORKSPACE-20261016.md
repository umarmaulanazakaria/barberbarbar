# Cleanup workspace dan dead code

16 Oktober 2026. Folder project asli; tidak ada clone, worktree, push, merge, perubahan database, instalasi atau perubahan dependency.

## Inventaris dan dasar keputusan

Checkpoint awal mencatat 559 file tracked dari empat project dan hash SHA-256, HEAD, branch, staged patch serta hash environment. Analisis import/export/dynamic import/require mencakup 305 file TS/TSX/JS/MJS/CJS/CSS (222 source), ditambah penelusuran route, navigator, script, konfigurasi dan referensi aset. Hitungan ini tidak mencakup pembacaan seluruh dependency atau file generated. Graph statis dan pencarian identifier hanya menghasilkan kandidat; keputusan penghapusan dikonfirmasi terhadap consumer sebenarnya.

| Kategori | Keputusan |
| --- | --- |
| Aktif | Backend, Web Admin, Web Customer, navigasi Mobile, API, webhook, scheduler, tracking, invoice dan konfigurasi dipertahankan |
| Generated | Hapus hanya dua ekspor Metro Android lama dan metadata hasil tes yang dapat dibuat ulang |
| Obsolete | Hapus halaman Booking Pelanggan lama dan deklarasi internal yang tidak lagi memiliki consumer |
| Historis/pengguna | Pertahankan perubahan Git lokal, migration, audit, backup, bukti pembayaran dan aset historis |
| Belum pasti | Pertahankan folder kerja AppData serta utilitas/manual scaffold; tidak menganggap nama folder sebagai bukti sampah |

## Perubahan source

- Hapus `client/src/pages/BookingPage.tsx`: App tidak mengimpor halaman ini; `/bookings` sudah redirect ke Pesanan. Satu consumer terakhir adalah tes render lama, yang diperbarui untuk menguji `TabelPesananTerpadu` dan tujuan detail aktif.
- Hapus konstanta internal `statusBooking` di `client/src/lib/tampilan-booking.ts` setelah consumer halaman lama dihapus. Formatter waktu tetap digunakan dan dipertahankan.
- Hapus tipe `DashboardData` di `client/src/types.ts`: tidak memiliki referensi; dashboard aktif memakai kontrak `DaftarTerpadu`.
- Hapus dua import backend tak terpakai, `kapasitasBookingCukup` dan `statusMenahanBooking`, dari `operasional-booking.service.ts`. Pemeriksaan compiler `noUnusedLocals/noUnusedParameters` mengonfirmasi keduanya.
- Customer Web: hapus dua callback kosong serta flag demo konstan pada App publik. Properti fixture katalog menjadi opsional; fixture dan UI pengujian tetap digunakan oleh suite antarmuka.
- Customer Web: konfigurasi Playwright default mengecualikan entrypoint guest dan tracking live agar fixture preview tidak menjalankan suite yang membutuhkan backend tracking terisolasi. Kedua entrypoint live tetap tersedia.

Tidak menyederhanakan helper atau CSS secara spekulatif. Tidak menghapus endpoint, kontrak lintas aplikasi, kode private-link legacy, fitur pembayaran atau UI yang masih digunakan tes.

## Artefak yang dihapus

| Target | File | Byte | Bukti |
| --- | ---: | ---: | --- |
| `barberbarbar-mobile/dist` | 39 | 6975533 | Seluruh file cocok manifest ekspor Metro Android; ignored, tidak tracked, tanpa junction/symlink |
| `barberbarbar-customer/dist` | 39 | 7081229 | Pemeriksaan manifest yang sama; package/README mendokumentasikan regenerasi melalui Expo export |
| `barberbarbar-customer-web/test-results/.last-run.json` | 1 | 45 | Metadata generated sesudah tes selesai; bukti screenshot dipertahankan |

Total 79 file generated, 14056807 byte, pada dua folder ekspor beserta subfolder generated-nya dan satu file metadata tes. Ditambah satu file source obsolete yang dihapus melalui patch. Folder test-results semula kosong setelah metadata dibersihkan, lalu dibuat ulang suite terakhir; screenshot visual hasil regresi terbaru tetap dipertahankan. Resolusi absolute path dan penolakan reparse point dilakukan sebelum penghapusan rekursif. Empat folder project utama tetap ada. `server/dist`, kedua Web `dist`, dependency, Prisma generated dan cache Expo aktif dipertahankan karena digunakan proses berjalan atau build.

## Folder yang dipertahankan dan memerlukan persetujuan terpisah

- `.audit-integrasi-20261016`: staged/unstaged patch, backup index, snapshot, runner dan checkpoint; bukan cache biasa. Checkpoint cleanup juga disimpan di sini tanpa menambah folder kerja.
- `%LOCALAPPDATA%/BARBERBARBAR/database-backups` dan `workspace-backups`: backup privat, tidak dihapus.
- `guest-booking-web-20261016`: dua helper sesi masih berjalan saat audit; ada bukti Sandbox, referensi fixture dan snapshot. Tidak dihapus atau dihentikan.
- `github-fix-booking-terbaru`: memiliki metadata Git dan source terpisah; tidak dianggap folder kerja kosong hanya karena tidak terdaftar sebagai worktree project utama.
- `staff-booking-order-20261016`: berisi source dan ekspor historis; kepemilikan/retensinya belum cukup pasti untuk dihapus.
- Folder release, portfolio, acceptance dan profil GitHub lainnya: dipertahankan sebagai histori/hasil pengguna.

Daftar ini adalah kandidat tinjauan retensi, bukan persetujuan penghapusan. Penghapusan berikutnya memerlukan rencana spesifik, verifikasi isi/status/proses/backup dan persetujuan pengguna. Tidak ada penghapusan di AppData dalam cleanup ini.

## Dependency dan source yang sengaja dipertahankan

Tidak ada package dihapus atau di-upgrade; seluruh package/lockfile identik dengan checkpoint. Dependency tipe, Tailwind/plugin Vite, Prisma generated/runtime dan `react-native-screens` diperlukan oleh compiler, build atau integrasi native meskipun graph import runtime tidak selalu menampilkannya.

`MembershipPelanggan.tsx` dipertahankan sebagai scaffold historis siap integrasi sesuai audit terdahulu. `cekDatabase.ts` adalah utilitas manual. `RingkasanBookingDashboard.tsx` dilindungi sebagai perubahan pengguna; `daftarBooking` tetap dibutuhkan komponen itu. Preview/demo Customer berada di fixture/mode test dan masih dipakai 14 tes; file historisnya tidak dihapus. Seluruh aset Staff/Native mempunyai referensi; ikon historis pada worktree Web juga dipertahankan.

## Hasil pengujian

| Pemeriksaan | Hasil aktual |
| --- | --- |
| Build/TypeScript backend dan Web Admin | PASS; warning bundle/Zod existing tetap ada |
| Compiler ketat unused backend, Admin, Web Customer dan Staff | PASS pada source cleanup; lihat catatan perubahan bersamaan Customer di bawah |
| Prisma validate | PASS; tidak menjalankan migration |
| Render/integrasi Web Admin | PASS 9 kelompok; diganti ke tabel Pesanan aktif |
| Tracking backend | PASS 13 kelompok |
| Booking guest/kompatibilitas Native | PASS 12 kelompok |
| Operasional booking | PASS 11 kelompok |
| Ledger, kasir dan invoice | PASS 8 kelompok |
| Midtrans/refund | PASS 17 kelompok provider mock |
| Realtime | PASS 23 kelompok |
| Pesanan terpadu hari ini/mendatang/pagination | PASS 9 kelompok |
| Browser Admin | PASS 9 kelompok pada Vite 5188 + fixture PostgreSQL 3188, termasuk redirect, realtime dan pergantian hari WIB |
| Browser Web Customer | PASS 14 tes fixture preview dan satu skenario tracking/DP/pelunasan/invoice pada 5186 + fixture 3185; skenario tracking diulang setelah koreksi baris F dan tetap PASS |
| Mobile Staff: TypeScript dan integrasi | PASS; 10 kelompok integrasi adapter, bukan perangkat Android |
| Native Customer: integrasi | PASS 14 kelompok; detail dan draf reschedule adapter juga PASS |
| Native Customer: TypeScript | FAIL existing sebelum cleanup: `DetailBooking.tsx:157,159` mengakses `Booking.alasanPenolakan`; baris267 mengakses `Ringkasan.pembayaranPercobaan`; kedua properti belum ada pada tipe |
| Native Customer: dropdown | FAIL existing: 10 kelompok perilaku lulus, lalu assertion `test-pilihan-barber.mjs:241` mengharapkan dua literal `<PilihanBerpencarian ` satu baris; source existing menggunakan JSX beberapa baris |
| Expo install --check kedua Mobile | PASS terhadap metadata offline terpasang; CLI memperingatkan validasi offline tidak menjamin metadata terbaru |
| Android fisik, checkout provider nyata baru, Production | NOT RUN |

Beberapa tes render awal tertahan sandbox esbuild (`Access is denied`); pengulangan dengan izin filesystem yang sesuai menghasilkan hasil di atas. Semua pengujian mutasi memakai database fixture existing terpisah dan gateway mock. Cleanup fixture lolos; snapshot read-only 25 tabel database utama identik sebelum/sesudah. Tidak ada transaksi Midtrans nyata baru atau penghapusan data pengguna.

## Perubahan bersamaan dan perlindungan Git

Saat audit berjalan, enam file Customer Web berubah di luar edit cleanup: konfigurasi tracking, BookingTamu, LacakBooking, dan tiga file tes. Perubahan tersebut dipertahankan di luar commit cleanup. Pemeriksaan ulang menemukan identifier `F` tanpa definisi pada BookingTamu baris71, menyebabkan TS2304. Setelah persetujuan eksplisit pengguna, hanya baris `F;` dihapus; pemformatan lainnya dipertahankan. TypeScript/build Customer terbaru serta pengulangan browser tracking kembali PASS. Koreksi ini menghilangkan karakter yang baru masuk di working tree dan tidak menambahkan diff fitur terhadap HEAD; pemformatan bersamaan tidak ikut commit.

Hash seluruh source Mobile, semua file historis awal dan environment empat project tetap cocok checkpoint. Patch staged Prisma tetap identik. Tidak ada perubahan route registration, migration/schema, helper keuangan, package/lock, Git config atau branch. Commit menggunakan daftar file eksplisit dan `commit --only`; file pengguna/historis tetap di luar commit. Keseluruhan validasi tidak dinyatakan seluruhnya PASS karena kegagalan Native Customer yang sudah ada.
