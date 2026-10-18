# Tambah Walk-in dari Dashboard

Tanggal verifikasi: 17 Oktober 2026. Branch: `feature/project5-integration`.
Basis implementasi: `1d8d0f4a7db61c1b70d84c16f0514533acac9efb`.
Commit lokal perubahan ini berjudul **Tambahkan pembuatan walk-in aman dari Dashboard**;
hash dapat diperiksa dengan `git log -1 --format=%H -- docs/ui/TAMBAH-WALKIN-DASHBOARD-FINAL.md`.
Tidak push, merge, deploy, instalasi dependency, atau perubahan source Staff/Customer.

## Keputusan D1–D9

| Keputusan | Implementasi dan alasan |
| --- | --- |
| D1 Lokasi | Route `/` tetap merender `DashboardPage.tsx`; hanya menambah tombol indigo dan drawer portal kanan. Tidak membuat halaman/rute kasir baru. |
| D2 Pelanggan lama | Default Pelanggan Lama; katalog `/pelanggan` nyata, pencarian nama/HP dan pemilihan ID existing. Hanya pelanggan AKTIF. |
| D3 Pelanggan baru | Nama trim wajib, HP opsional, tanpa akun customer. HP Indonesia divalidasi/dinormalisasi; duplikat format 08/+62 ditolak untuk diarahkan ke Pelanggan Lama. Tanpa HP disimpan NULL, bukan nomor palsu. Nama yang sama saja tidak dianggap identitas orang yang sama. |
| D4 Katalog | `/layanan` existing, hanya aktif. Checkbox layanan unik qty 1, beberapa layanan dalam satu Pesanan. Jika pilihan tidak tersedia setelah refresh, form memberikan cara menghapus pilihan tersebut. |
| D5 Harga | Perhitungan resmi `pesanan.service.ts`, harga snapshot dan diskon membership existing dipertahankan. Lock/read ulang katalog dan membership; harga unit dan total yang berubah ditolak 409 sebelum commit. |
| D6 Barber | `/barbers` existing, aktif saja; default NULL. Satu barber untuk semua item; status tetap WAITING. Tidak memberi label ketersediaan palsu. Backend memeriksa aktif/sibuk dan kapasitas booking existing. Wajib barber sebelum IN_SERVICE sesuai lifecycle resmi. |
| D7 Transaksi | Ekstrak fungsi resmi pesanan/pelanggan agar legacy dan drawer memakai fungsi sama. Pelanggan baru + item + Pesanan + riwayat WAITING + idempotensi dalam satu transaksi; gagal tidak meninggalkan pelanggan yatim. |
| D8 Pengiriman | Tabel teknis PermintaanWalkIn scoped operator, unique operator/key dan order, SHA-256 fingerprint payload canonical. Advisory lock jadwal existing serialisasi replay. Double click ditahan ref; timeout tidak mengganti key/payload. SessionStorage menyimpan request tertunda untuk reload, dibersihkan saat sukses/penolakan pasti atau tab ditutup. Draft scoped ID operator dipertahankan saat sesi berakhir agar login ulang operator yang sama dapat memulihkan hasil. Jika penyimpanan browser gagal, request tidak dikirim. |
| D9 Sukses/visual | Toast nomor pesanan asli, drawer tutup, invalidate orders/dashboard/customers. Tab/search/halaman Dashboard tidak direset oleh handler sukses dan tidak redirect. Header/footer drawer tetap, body scroll, dirty-close confirm. CSS terisolasi `.wi-*`, penyesuaian header saja; CSS Dashboard/History existing tidak diedit. |

## Audit alur existing dan mapping

`App.tsx` memakai Dashboard aktif pada `/`. Sidebar/layout, empat KPI, tabel, tab,
pagination, perhatian, dan drawer rincian existing tetap dipertahankan.
Halaman Riwayat dan servicenya tidak diedit.

Alur kasir existing `POST /orders` memakai `tambahPesanan`; kini fungsi tersebut
memanggil `buatPesananDalamTransaksi` yang juga dipakai drawer. Lifecycle tetap
`PATCH /orders/:id/status`; pembayaran tetap `POST /orders/:id/payment` setelah
COMPLETED. Invoice tetap Pembayaran resmi. Tidak ada DP, ledger, atau transaksi
Midtrans yang dibuat oleh aksi Tambah Walk-in.

| Endpoint | Fungsi |
| --- | --- |
| GET /pelanggan | Pelanggan resmi + membership; pencarian frontend memakai katalog nyata. |
| GET /layanan | Harga/durasi/aktif resmi, tanpa hardcode nominal. |
| GET /barbers | Pilihan barber aktif; tidak menjanjikan tersedia tanpa validasi backend. |
| POST /orders/walk-in | Endpoint additive operator untuk transaksi atomik, ekspektasi harga dan idempotensi. Memakai core kasir existing. |
| GET /orders/walk-in/requests/:kunci | Pemulihan hasil scoped operator; 404 belum menjadi bukti bahwa request sebelumnya gagal. Cache-Control no-store. |
| GET /management/dashboard | Refetch existing setelah sukses, Walk-in tidak dihitung sebagai KPI Booking. |

Auth ADMIN/STAFF existing tetap berlaku pada kedua endpoint baru. Anonymous dan
JWT CUSTOMER ditolak. Tidak membuat mekanisme login/otorisasi baru.
Payload strict: pelanggan LAMA{id} atau BARU{nama,nomorTelepon?}, item unik qty 1,
hargaDiharapkan, totalDiharapkan, barberId nullable, UUID kunciIdempotensi.
Respons minimal berisi identitas/status/total pesanan, tanpa payload pelanggan
atau fingerprint teknis. Permintaan yang sama mengembalikan pesanan sama meskipun
status operasionalnya sudah berubah; toast replay tidak mengklaim masih Menunggu.

## Migration yang disetujui dan perlindungan data

Awalnya `Pelanggan.nomorTelepon` NOT NULL; tidak ada idempotensi create order.
Pengguna menyetujui rencana [WALKIN-MIGRATION-PLAN.md](../../server/WALKIN-MIGRATION-PLAN.md)
secara eksplisit sebelum eksekusi. Satu migration
`20261017120000_pelanggan_opsional_dan_idempotensi_walkin` telah diterapkan pada
fixture dahulu, kemudian utama setelah backup/snapshot valid.

Perubahan: nomorTelepon nullable dengan unique existing tetap; tambah tabel
PermintaanWalkIn dan FK/unique teknis. Tidak ada tabel finansial yang berubah.
Record pelanggan, akun, status keputusan, harga, pesanan dan pembayaran existing
tidak diubah. Snapshot 22 model domain identik sebelum dan sesudah migration;
tabel teknis baru terverifikasi kosong pada utama.

Backup privat: `%LOCALAPPDATA%/BARBERBARBAR/database-backups/e2e-2026-10-17T08-35-04-306Z`.
Ukuran custom-format 148.196 byte. SHA-256:
`19f78ba3ed43d8384abe20f0549dc33472b280f60fdc66055812068dd986abb9`.
Checksum, `pg_restore --list`, pembacaan penuh arsip tanpa restore, dan snapshot
diverifikasi sebelum/sesudah. Tidak ada backup/data privat/credential masuk Git.

Kompatibilitas: DTO operator mengubah **hanya NULL telepon pelanggan menjadi
string kosong**. Ini melindungi pencarian Staff existing yang memanggil
`.nomorTelepon.toLowerCase()`. NULL telepon Barber tetap NULL; tanggal/nilai
finansial tidak berubah. API legacy pembuatan pelanggan tetap mewajibkan HP
sesuai kontrak lamanya. Tidak mengubah source Staff/Customer atau Prisma historis.

## Hasil pengujian

| Pengujian | Hasil aktual |
| --- | --- |
| TypeScript backend + build | PASS — `npm.cmd run build` pada server. |
| TypeScript frontend + production build | PASS — `npm.cmd run build` pada client. |
| Prisma validate/generate/migrate | PASS — schema valid; satu migration diterapkan pada fixture/utama; awal tanpa pending lain. |
| HTTP + browser fitur | PASS — 10 kelompok `server/scripts/test-walkin-dashboard.mjs`, PostgreSQL fixture nyata. |
| Dashboard | PASS — 10 kelompok `server/scripts/test-dashboard-final.mjs`, KPI/filter/pagination/auth/read-only. |
| Riwayat | PASS — 10 kelompok `server/scripts/test-riwayat-pesanan.mjs`, closure/filter/detail/auth/invoice. |
| Booking/kapasitas/Midtrans/realtime | PASS — 12 kelompok `server/scripts/test-guest-booking.mjs`, gateway provider STUB, bukan pembayaran Sandbox nyata. |
| Integrasi komponen legacy | PASS — 9 kelompok existing `client/scripts/test-integrasi-web.mjs` (SSR/domain/mock REST; bukan bukti DB create). |
| Browser utama | PASS — login manual, backend utama asli, 8 viewport, 33 screenshot AFTER + 1 BEFORE; semua request mutasi API diblokir oleh script audit. |
| Endpoint baru pada proses utama | PASS — GET key acak menghasilkan pesan belum ada konfirmasi + no-store; tidak membuat order. |
| Proteksi WIP | PASS — hash file historis dan cached diff identik dengan baseline; Staff/Customer HEAD, branch dan status tetap. |
| Perbandingan pixel-perfect | DEFERRED — gambar/prototipe referensi tidak tersedia pada attachment; mengikuti spesifikasi teks, tanpa klaim pixel-perfect. |
| Uji perangkat Staff fisik | DEFERRED — tidak dilakukan; kompatibilitas dibuktikan DTO HTTP dan regresi API, bukan perangkat. |

Rincian cakupan 34 butir brief:

| Butir | Bukti |
| --- | --- |
| 1–5 tombol, drawer, route, tutup, default | Browser fixture dan browser utama 8 viewport PASS. |
| 6–8 pencarian nama/HP dan tidak duplikat | Browser memakai HTTP fixture nyata, assert pelanggan tetap satu pada reuse ID PASS. |
| 9–12 baru dengan/tanpa HP, nama kosong, tanpa layanan | HTTP validasi, dua pelanggan NULL sah, guard tombol browser PASS. |
| 13–16 single/multi, total, harga/layanan invalid | HTTP satu Pesanan dengan dua item, diskon resmi, rollback pelanggan; browser harga berubah mempertahankan pilihan PASS. |
| 17–19 barber opsional/valid/tidak tersedia | HTTP NULL/aktif/inaktif/sibuk; lifecycle menolak start tanpa barber PASS. |
| 20–22 WAITING, tanpa pembayaran/DP | Assert status, payment NULL, transaksi booking nol PASS. |
| 23 double submit | Dua POST konkuren menghasilkan 201/200 dengan ID sama, satu order; browser klik sinkron dua kali hanya satu POST sukses PASS. |
| 24 error menjaga form/timeout | Harga berubah tetap dialog+pilihan; respons POST sengaja diputus setelah commit, reload, GET mengembalikan pesanan sama tanpa POST ulang PASS. |
| 25–29 sukses, refetch, daftar, KPI/state | Browser dialog tutup, tab Walk-in/search tetap; HTTP Dashboard memuat order dan KPI Booking nol PASS. Pagination tidak direset oleh source handler; perilaku pagination diuji regresi Dashboard. |
| 30 permissions | Anonymous/CUSTOMER 401; ADMIN/STAFF dapat membuat sesuai izin kasir lama; GET key operator lain 404 PASS. |
| 31–34 regresi dan build | Suite Dashboard/Riwayat/Guest, TypeScript dan build PASS. |

Semua fixture suite dibersihkan hanya berdasarkan ID/prefix milik run tersebut;
model kembali kosong/identik snapshot. Tidak reset DB, tidak membuat customer
dummy di utama, dan tidak memanggil provider nyata.

Warning nonfatal yang tetap ada: Vite bundle >500 kB, komentar annotation Zod,
dan deprecation antrean query pg existing. Tidak melakukan upgrade dependency
atau refactor di luar scope untuk warning tersebut.

## Bukti visual aplikasi asli

Direktori: [screenshots/tambah-walkin](screenshots/tambah-walkin/).
Audit: `client/scripts/audit-walkin-live.mjs`, hasil [hasil.json](screenshots/tambah-walkin/hasil.json).
Screenshot AFTER memakai login manual resmi dan backend utama tanpa mock.
HP customer disembunyikan khusus screenshot; data asli UI tidak dimodifikasi.
Desktop 1440×1000 dan mobile 390×844 diinspeksi visual, termasuk overlay,
header/section, segmented, kartu, dropdown, ringkasan serta footer scroll.

- [Dashboard BEFORE 1440](screenshots/tambah-walkin/1440-dashboard-before.png)
- [Dashboard AFTER 1440](screenshots/tambah-walkin/1440-dashboard.png)
- [Drawer pelanggan lama](screenshots/tambah-walkin/1440-drawer-lama.png)
- [Pencarian pelanggan nyata](screenshots/tambah-walkin/1440-pencarian-pelanggan.png)
- [Pelanggan baru](screenshots/tambah-walkin/1440-drawer-baru.png)
- [Multi-layanan dan ringkasan desktop](screenshots/tambah-walkin/1440-ringkasan-footer.png)
- [Dashboard 390](screenshots/tambah-walkin/390-dashboard.png)
- [Drawer 390](screenshots/tambah-walkin/390-drawer-lama.png)
- [Drawer scroll, ringkasan/footer 390](screenshots/tambah-walkin/390-ringkasan-footer.png)

Ukuran lain 320,375,768,1024,1280,1920 juga tersimpan; tanpa overflow horizontal,
lebar drawer min(465px,viewport), footer di dalam viewport saat body scroll.
Screenshot drawer memakai ukuran viewport; halaman Dashboard dapat memanjang.

## File milik implementasi

- Client: `src/pages/DashboardPage.tsx`; komponen `TambahWalkInDrawer.tsx/.css`;
  `src/lib/walkin-dashboard.ts`; `scripts/audit-walkin-live.mjs`.
- Server: `prisma/schema.prisma`, satu migration di atas; `src/app.ts`;
  `src/routes/pesanan.routes.ts`; controller/schema/service `walkin-dashboard`;
  `src/services/pelanggan.service.ts`, `src/services/pesanan.service.ts`;
  `src/middleware/telepon-pelanggan.middleware.ts`; `scripts/test-walkin-dashboard.mjs`.
- Dokumentasi: laporan ini, `server/WALKIN-MIGRATION-PLAN.md`, 34 PNG dan hasil.json.

Commit menggunakan index sementara dengan allowlist file di atas, agar staged
`server/src/lib/prisma.ts` tidak ikut commit. Index normal disinkronkan hanya
untuk file fitur; cached diff historis diverifikasi identik. WIP lain tetap di
working tree, sehingga Git akhir tidak diklaim clean. Tidak ada push/merge.

## Batasan operasional

Pemulihan otomatis memakai tab/sessionStorage browser yang sama; jangan membuat
pesanan pengganti saat status request belum pasti. Sesi login yang berakhir perlu
login ulang dengan operator yang sama. Draft tertunda (nama/HP jika pelanggan baru) tetap
ada di sessionStorage tab itu sampai hasil pasti atau tab ditutup; tidak berisi JWT/credential. Daftar pelanggan
memakai endpoint katalog existing, belum search berhalaman khusus.
Tidak menguji pembayaran provider Sandbox nyata karena aksi ini Walk-in tanpa
DP dan brief melarang transaksi provider untuk fixture. Alur finansial lama
dipakai kembali, bukan diganti. Tidak ada kegagalan fitur kritis tersisa dalam
pengujian yang dijalankan; perbandingan prototipe persis dan perangkat fisik
tetap berstatus DEFERRED sebagaimana batasan di atas.
