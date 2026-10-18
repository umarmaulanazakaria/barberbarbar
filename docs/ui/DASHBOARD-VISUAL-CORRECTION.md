# Koreksi Dashboard dan verifikasi backend utama

Tanggal: 17 Oktober 2026. Basis: `a17ce9eb5efd7f9f3d828d834a1c482ecf9c6611`.
Branch: `feature/project5-integration`. Commit lokal saja, tanpa push.

## Akar masalah dan bukti

Audit dilakukan sebelum perubahan source:

1. HEAD masih `a17ce9e`; perubahan historis staged/unstaged tetap ada.
2. Rantai aktif: `index.html` → `src/main.tsx` → `App.tsx` → route `/`
   → `pages/DashboardPage.tsx`, di dalam `AppLayout`.
3. Hanya ada satu komponen halaman Dashboard yang diimpor router.
   `RingkasanBookingDashboard.tsx` adalah komponen lama yang tidak diimpor;
   WIP pengguna pada file itu dipertahankan, tidak dihapus.
4. Listener `::1:5173` dimiliki Node PID 668. Command line menunjuk Vite
   pada `barberbarbar/client/node_modules`, memakai `--configLoader runner`.
   Config memakai proxy `/api` ke `127.0.0.1:3000` dan tidak memakai build statis.
5. HTTP `GET /src/pages/DashboardPage.tsx` dari server aktif memuat Dashboard baru,
   tab Booking/Walk-in, dan tidak memuat `Pesanan menunggu`.
   `sourcesContent` dalam source map identik dengan file lokal setelah normalisasi
   CRLF/LF. Root efektif dibuktikan dengan source yang disajikan; bukan klaim
   pembacaan working directory internal Windows dari proses.
6. Tidak ditemukan registrasi service worker di source Admin.
7. Pengguna login manual pada Chrome verifikasi. Dashboard baru tampil dengan
   respons backend utama, tanpa mock data. Pengguna kemudian mengonfirmasi bahwa
   tab lama juga menampilkan Dashboard baru setelah `Ctrl+Shift+R`.

Kesimpulan: tampilan lama bertahan pada sesi tab yang belum memperbarui modul.
Bukan karena router menunjuk Dashboard lain atau Vite menyajikan file Dashboard
lama pada saat audit. Bukti tidak membedakan cache browser dari koneksi HMR yang
terputus. Tidak ada restart proses, penghapusan cache massal, atau perubahan
konfigurasi yang diperlukan. Laporan lama yang memakai fixture belum membuktikan
kondisi tab pengguna maupun data backend utama.

Selisih source yang memang terbukti: deskripsi dan kapitalisasi KPI belum persis
sesuai brief, sidebar 216px, topbar 64px, padding horizontal desktop 28px.

## Perubahan terbatas

- `client/src/pages/DashboardPage.tsx`: deskripsi dan empat label KPI persis brief.
- `client/src/components/AppLayout.tsx`: kelas `admin-dashboard` hanya pada route `/`.
- `client/src/pages/DashboardFinal.css`: token warna, sidebar 194px, topbar 63px,
  padding 24px pada Dashboard; mobile tetap 16px horizontal. Shell halaman lain
  mempertahankan ukuran existing.
- `client/scripts/audit-dashboard-live.mjs`: audit browser baca-saja dengan sesi
  hasil login manual di luar repository. Tidak membuat akun, fixture, atau JWT.

Endpoint `/management/dashboard`, aturan bisnis, Midtrans, invoice, ledger,
autentikasi, izin, realtime, schema, migration, Customer Web, dan Staff tidak diubah.

## Bukti visual aktual

- [Desktop 1440px](screenshots/dashboard-live/aktual-1440.png)
- [HP 390px](screenshots/dashboard-live/aktual-390.png)
- [Tab Walk-in aktual](screenshots/dashboard-live/aktual-1440-walkin.png)
- [Hasil audit terstruktur](screenshots/dashboard-live/hasil.json)

Ketiga screenshot diperiksa secara visual. Desktop menampilkan empat KPI seragam,
dua panel sejajar, lima kolom, status pelayanan/pembayaran terpisah, dan sidebar
navy. HP memakai dua kolom KPI, daftar kartu, panel bertumpuk, menu tertutup,
tanpa overflow horizontal. Screenshot HP menunggu transisi sidebar selesai.
Tidak ada panel Pendapatan, Ringkasan barbershop, atau KPI lama.

Tidak ada gambar prototipe pada lampiran, hanya teks. Penilaian menggunakan
spesifikasi warna/ukuran/struktur; tidak mengklaim pixel-perfect.

Data aktual saat audit: KPI **4 / 2 / 0 / Rp 0**, empat booking aktif pada daftar,
nol Walk-in hari ini, nol kategori masalah aktif. Nama seperti `testing` berasal
dari data existing backend pengguna; script tidak membuatnya.

## Pengujian

| Pemeriksaan | Hasil |
| --- | --- |
| Login manual resmi; request backend utama tanpa mock data | PASS |
| Respons proxy 5173 dan endpoint langsung backend 3000 identik | PASS |
| Empat judul KPI, nilai sesuai respons backend; KPI terakhir rupiah | PASS |
| Empat kartu + dua panel; panel/KPI lama tidak ada | PASS |
| Sidebar 194px, topbar 63px, padding desktop 24px | PASS |
| Desktop 1440 dan HP 390; kartu seragam; tanpa overflow | PASS |
| Booking default; Walk-in menampilkan kondisi kosong backend sebenarnya | PASS |
| Lima kolom; pelayanan/pembayaran terpisah; maksimal 10 baris | PASS (4 baris aktual) |
| Pencarian server, hasil kosong, pemulihan daftar | PASS |
| Drawer, tiga nilai finansial, Escape, tab/pencarian/scroll dipertahankan | PASS |
| Loading, error jaringan tanpa angka palsu, pemulihan | PASS |
| Refresh backend dan tidak ada galat runtime halaman | PASS |
| Lihat semua, halaman kedua, pemulihan posisi halaman kedua | DEFERRED: hanya 4 booking aktif |
| Accordion, satu kategori terbuka, badge jenis, tambahan 5 entri | DEFERRED: tidak ada masalah aktif |
| Event perubahan status aktual | Tidak dipicu; tidak memutasi data pengguna |
| TypeScript client (`tsc -b --pretty false`) | PASS |
| Build client (`npm.cmd run build`) | PASS |
| Syntax script (`node --check`) | PASS |
| `git diff --check` | PASS; peringatan normalisasi CRLF bukan syntax error |

Audit browser menghasilkan 12 kelompok PASS dan 2 DEFERRED. Gangguan jaringan
diuji dengan menggagalkan transport GET, loading dengan menunda GET 750ms;
tidak ada respons JSON palsu. `setOffline` tidak dipakai karena React Query
menjeda query ketika browser offline. Penantian script juga memperhitungkan
pemulihan cache React Query dan animasi resize, bukan menganggapnya bug aplikasi.

Build masih memberi peringatan bundle >500kB dan anotasi dependency Zod.
Tidak ada instalasi dependency. Backend tidak diubah dan tidak dites ulang dengan
transaksi provider. Sesi autentikasi privat tidak disimpan dalam source/screenshot.

## Perlindungan Git dan batas penerimaan

Commit memakai index sementara dan allowlist file tugas. Diff staged historis
`server/src/lib/prisma.ts` dipertahankan persis; hash seluruh WIP awal dibandingkan
lagi dan identik. Status/index/WIP Staff dan Customer juga identik dengan snapshot
awal. Tidak ada reset, restore, clean, add massal, push, merge, atau deploy.

Koreksi visual dan pemuatan tab pengguna telah terverifikasi. Penerimaan seluruh
interaksi dengan data backend utama masih parsial untuk dua kelompok DEFERRED.
Tidak membuat data palsu atau mengubah booking pengguna agar pengujian terlihat
lulus. Laporan ini menggantikan klaim verifikasi visual berbasis fixture pada
laporan sebelumnya untuk aspek halaman aktual, bukan menghapus bukti tes lama.
