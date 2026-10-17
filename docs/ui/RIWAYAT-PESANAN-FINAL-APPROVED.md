# Riwayat Pesanan — implementasi dan bukti penerimaan

Tanggal: 17 Oktober 2026 (WIB). Basis Git: `79f329e`, branch
`feature/project5-integration`. Judul dokumen mengikuti permintaan; hasil yang
masih DEFERRED di bawah tidak dianggap sudah mendapat persetujuan visual final.

## Referensi dan keputusan R1–R10

Lampiran `9b7b403a-1966-464c-abc4-827976169252` hanya berisi `Pasted text.txt`.
Tidak ada screenshot desktop/HP atau Page prototipe yang dapat diakses. Warna,
ukuran dan struktur mengikuti spesifikasi teks serta Dashboard yang disetujui.
Tidak mengklaim pixel-perfect terhadap prototipe yang tidak tersedia.

R1–R10 berikut adalah keputusan implementasi berdasarkan brief, bukan klaim
bahwa keputusan tambahan pernah disetujui di luar percakapan yang tersedia.

| Keputusan | Implementasi |
| --- | --- |
| R1 Navigasi | Operasional hanya Dashboard dan Riwayat Pesanan. `/history` adalah route arsip aktif. Menu Pesanan dihapus; route yang masih menjadi dependensi tetap tersedia. |
| R2 Status | COMPLETED → Selesai. CANCELLED manual, REJECTED dan NO_SHOW → kelompok Dibatalkan; status backend asli tetap ada dan REJECTED/NO_SHOW dijelaskan dalam drawer. CANCELLED dengan transisi TIMEOUT_DP/CONFIRMATION/RESCHEDULE → Kedaluwarsa. Tidak mengubah enum/lifecycle atau mengarsipkan deadline yang belum diproses scheduler. |
| R3 Penutupan | Booking memakai layananSelesaiPada/dibatalkanPada/ditolakPada, fallback ke histori transisi menuju status terminal yang sama. NO_SHOW memakai histori transisinya. Walk-in memakai RiwayatStatusPesanan yang sesuai status terminal. Tidak memakai createdAt/jadwal/updatedAt/waktu pembayaran. Self-event PAYMENT_OVERDUE tidak mengubah penutupan. |
| R4 Tanggal | Default 30 hari kalender termasuk hari ini, opsi Hari Ini/7 Hari/Rentang Khusus. Batas awal inklusif, akhir eksklusif, UTC+7; jam database menentukan hari operasional. |
| R5 Pencarian | Nama, nomor booking/pesanan, telepon termasuk identitas guest; backend parameterized, wildcard literal di-escape. Telepon dinormalisasi digit dan awalan 62→0; tidak dikirim dalam DTO daftar. |
| R6 Pagination | UNION global Booking/Walk-in, exclude Pesanan yang terhubung Booking, filter sebelum count/sort/limit. Urutan penutupan DESC, jenis ASC, ID DESC. Tetap 20/page; total/page clamp dibaca dalam RepeatableRead. |
| R7 Drawer | Drawer khusus arsip ±450px, hanya GET, tidak memakai drawer/modals operasional. Escape/Close/Kembali, fokus, inert, filter/tab/halaman/scroll dipertahankan. URL drawer lama pada `/history` juga ditangani sebagai arsip baca-saja. |
| R8 Finansial | Booking memakai helper ringkasan ledger existing. Walk-in lunas harus memiliki receipt sah. Nilai tagihan/diterima/sisa terpisah dari status pelayanan. Invoice hanya record resmi yang telah tersimpan; tidak finalisasi atau membuat invoice. |
| R9 Visual | Sidebar navy194px, topbar63px, padding24px, indigo, satu panel tanpa KPI/chart; tujuh kolom desktop, kartu pada lebar di bawah1024px setelah review768px menunjukkan tabel terlalu padat. |
| R10 Keselamatan | Endpoint additive baca-saja; tanpa schema/migration, instalasi, transaksi provider, perubahan Customer/Staff atau data utama. Fixture hanya DB terisolasi existing, dibersihkan berdasarkan ID milik suite. Commit lokal terpisah dari index historis; tanpa push. |

Jika record terminal lama tidak memiliki bukti waktu penutupan, server menghitung
`tanpaWaktuPenutupan` dan UI memberi peringatan. Record tersebut tidak dipaksakan
ke rentang tanggal yang tidak diketahui; detailnya tetap dapat dibaca melalui ID.
Ini keterbatasan data, bukan alasan membuat tanggal pengganti. Audit backend utama
saat pengujian menemukan **nol** record demikian pada filter yang diperiksa.

## Route dan audit dependensi Pesanan lama

`index.html` → `main.tsx` → `App.tsx` → `/history` → `HistoryPage.tsx`.
Sebelumnya HistoryPage hanya merender `DaftarPesananTerpadu riwayat`: tanggal
berdasarkan jadwal/sebelum hari ini, tidak membatasi terminal, tidak ada telepon
server search atau urutan global waktu penutupan. Kini wrapper tersebut diganti
dengan halaman arsip aktif, bukan halaman tambahan yang tidak dipakai router.

| Route/komponen existing | Keputusan kompatibilitas |
| --- | --- |
| `/orders`, OrdersPage, DaftarPesananTerpadu, NewOrderModal, OrderDetailModal | Dipertahankan sebagai ruang operasional tersembunyi dari menu. Masih diperlukan untuk kasir Walk-in, modal pembayaran, pencetakan invoice dan hasil pembuatan pesanan. |
| Drawer Dashboard → Detail & tindakan Walk-in | Diperbaiki dari query relatif `/?pesananId=...` menjadi `/orders?pesananId=...`; route dan modal operasional berhasil dibuka. |
| Drawer Dashboard → Kelola booking | `/orders/booking/:id` tetap tersedia dan dites baca-saja. |
| `/bookings`, `/bookings/:id`, `/orders/:id`, `/orders/:id/payment`, `/orders/new` | Alias existing dipertahankan; target route tidak dihapus. Tidak mengubah API operasional. |
| `/history?rincianBooking=...` atau `rincianPesanan`/`pesananId` | Drawer arsip sendiri; AppLayout tidak memasang drawer operasional pada `/history`. Pesanan aktif ditolak endpoint detail arsip dengan404. |
| Detail pelanggan/invoice existing | Query data dan modal existing tetap ada; tidak dihapus hanya untuk menghilangkan menu. |

DashboardPage, DashboardFinal.css dan service `/management/dashboard` tidak diubah.
AppLayout hanya menyesuaikan menu dan kelas shell History, serta memisahkan drawer.
Query arsip berakar `orders` agar mengikuti invalidasi booking/order/payment dan
reconnect existing; modul/protokol Socket.IO tidak diubah. Poll15detik tetap ada.

## API baca-saja

- `GET /management/history`: jenis, periode, mulai, selesai, status, cari,
  halaman, batas20; mengembalikan total/totalHalaman/hariIni/serverTime dan data.
- `GET /management/history/:jenis/:id`: detail terminal, kontak operator-only,
  layanan aktual Pesanan bila Booking terhubung, barber yang menangani,
  ringkasan keuangan, histori tersimpan dan metadata invoice resmi.
- Keduanya memakai autentikasi operator existing pada `/management`, ADMIN/STAFF;
  anonymous/CUSTOMER ditolak. `Cache-Control: no-store`, strict query validation.
- Tidak ada endpoint mutasi baru, field token/hash/provider reference/raw JSON
  riwayat, atau telepon di daftar. Detail sengaja menyertakan telepon untuk operator.
- Dokumen invoice di drawer menampilkan nomor, tanggal, dan total dari invoice
  tersimpan. Tidak menyediakan PDF baru, tombol finalisasi, atau formulir pembayaran.

## Screenshot aktual dan review

Semua screenshot AFTER memakai login manual operator dan backend utama3000 via
Vite5173, tanpa payload mock. Nama yang mengandung `testing`/`Dummy` adalah data
existing pengguna, bukan fixture yang dibuat script ini. Telepon disamarkan pada
screenshot drawer, tetap tampil normal bagi operator berwenang di aplikasi.

- [Desktop Semua1440](screenshots/riwayat-final/after-1440-semua.png),
  [HP Semua390](screenshots/riwayat-final/after-390-semua.png).
- [Booking1440](screenshots/riwayat-final/after-1440-booking.png),
  [Walk-in1440](screenshots/riwayat-final/after-1440-walk-in.png).
- [Booking390](screenshots/riwayat-final/after-390-booking.png),
  [Walk-in390](screenshots/riwayat-final/after-390-walk-in.png).
- [Rentang1440](screenshots/riwayat-final/after-1440-rentang.png),
  [Rentang390](screenshots/riwayat-final/after-390-rentang.png).
- [Drawer1440](screenshots/riwayat-final/after-1440-drawer.png),
  [Drawer390](screenshots/riwayat-final/after-390-drawer.png).
- [Empty](screenshots/riwayat-final/after-390-empty.png),
  [error](screenshots/riwayat-final/after-1440-error.png),
  [loading](screenshots/riwayat-final/after-1440-loading.png).
- [Regresi Dashboard1440](screenshots/riwayat-final/regresi-dashboard-1440.png),
  [Dashboard390](screenshots/riwayat-final/regresi-dashboard-390.png).
- BEFORE pembanding:
  [modul Pesanan lama1440](screenshots/riwayat-final/before-1440-modul-pesanan-lama.png),
  [390](screenshots/riwayat-final/before-390-modul-pesanan-lama.png).
  Ini screenshot route operasional `/orders?periode=RIWAYAT` yang masih tersedia,
  bukan klaim screenshot `/history` dari sebelum edit. Login manual baru selesai
  setelah source History berubah; source BEFORE yang pasti ada pada commit79f329e.

Review browser dilakukan pada1440/390, drawer dan768; tabel768 yang awalnya rapat
diganti kartu dan diambil ulang. Semua320/375/390/768/1024/1280/1440/1920 memiliki
screenshot dan uji overflow. Desktop satu panel lebar, tab di atas filter, tujuh
kolom, badge lembut, pagination bawah. Mobile tidak membawa tabel lebar.
Drawer difoto dari bagian atas setelah scroll akibat pembukaan invoice dipulihkan.
Perbandingan pixel terhadap prototipe: **DEFERRED**, referensi gambar tidak tersedia.

## Pengujian aktual

Data utama default30Hari saat audit: **18 arsip =12 Booking+6 Walk-in**;
15 selesai dan3 kedaluwarsa pada halaman gabungan; tanpa waktu penutupan0.
Pengguna mungkin tetap menguji aplikasi; script tidak mengubah booking/data utama.

| No | Skenario | Hasil/bukti |
| --- | --- | --- |
| 1–3 | Semua, Booking, Walk-in | PASS browser utama dan filter DB terisolasi |
| 4–5 | Hanya terminal, aktif tidak tampil | PASS query fixture dan DTO utama; detail aktif404 |
| 6 | Selesai belum lunas | PASS DB fixture; data selesai utama yang terlihat sudah lunas |
| 7–8 | Urutan closure, pembayaran tidak menggeser urutan | PASS global beberapa halaman fixture, update receipt setelah closure |
| 9–12 | HariIni/7/30/default/rentang | PASS UI utama, batas UTC+7 dan arsip lama fixture |
| 13–14 | Status/gabungan filter | PASS backend fixture dan interaksi UI utama |
| 15–17 | Cari nama/nomor/telepon | PASS utama dan fixture; wildcard/injeksi aman, telepon tidak muncul di tabel |
| 18–19 | Pagination20/global lintas jenis/halaman | PASS API fixture lebih20record, tanpa duplikasi linked; halaman2 utama DEFERRED karena18record |
| 20 | Drawer read-only | PASS utama: tidak ada tombol operasional/request mutasi; legacy query juga memakai drawer arsip |
| 21 | Riwayat status aktual | PASS utama: jumlah entri sesuai respons detail; tanpa timeline sintetis |
| 22 | Invoice resmi | PASS utama dan receipt fixture; nomor dari record, bukan generator/placeholder |
| 23 | Tutup drawer pertahankan konteks | PASS Escape/Kembali, tab/filter/scroll/fokus utama; konteks halaman2 utama DEFERRED |
| 24 | Loading/error/empty | PASS query kosong asli; transport GET digagalkan atau ditunda, tidak memalsukan JSON |
| 25 | Responsive | PASS delapan lebar; screenshot aktual; review visual spesifikasi teks |
| 26 | Route/dependensi | PASS utama Orders, modal Walk-in, Detail Booking; alias tidak dihapus |
| 27 | Dashboard | PASS browser utama; source/stylesheet/service identik; suite backend Dashboard10kelompok PASS |
| 28 | TypeScript/build | PASS frontend dan backend; syntax kedua script PASS |

Tambahan: suite backend arsip **10kelompok PASS**, snapshot tabel fixture sebelum
dan sesudah GET identik; anonymous/CUSTOMER401, ADMIN/STAFF200, input400,
POST404, no-store, DTO daftar tanpa telepon/rahasia. Semua14model kembali kosong
setelah cleanup hanya ID suite, tanpa reset sequence atau migration.

Tes browser generik tambahan memakai fixture khusus tes (bukan bukti visual utama):
**3 PASS**, seluruh modul responsif320/1024 serta Walk-in drawer→kasir/invoice.
Fixture lama ditambah DTO endpoint arsip agar sesuai kontrak baru.
[Hasil live terstruktur](screenshots/riwayat-final/hasil-live.json) mencatat status
per kelompok: **27 PASS, 1 DEFERRED**, tanpa credential/telepon. Audit utama tidak
mengirim POST/PUT/DELETE. Label Detail pada1024px diperbaiki agar tidak terbelah,
kemudian screenshot dan verifikasi browser diulang pada source final.

Peringatan build existing: chunkJS >500kB dan anotasi dependency Zod. Tes fixture
memberi deprecation warning pg terkait concurrent client.query; tidak menyebabkan
kegagalan. Tidak memasang dependency atau mengubah lockfile untuk menghilangkannya.

## File dan Git

Perubahan implementasi:

- `client/src/components/AppLayout.tsx`
- `client/src/components/RincianPesananDrawer.tsx` (tautan dependensi Walk-in)
- `client/src/components/RincianRiwayatDrawer.tsx`
- `client/src/pages/HistoryPage.tsx`, `HistoryFinal.css`
- `client/src/lib/riwayat-pesanan.ts`
- `client/scripts/audit-riwayat-live.mjs`
- `client/tests/fixtures/admin.ts`
- `server/src/routes/manajemen.routes.ts`
- `server/src/controllers/riwayat-pesanan.controller.ts`
- `server/src/services/riwayat-pesanan.service.ts`
- `server/scripts/test-riwayat-pesanan.mjs`
- Laporan ini dan `docs/ui/screenshots/riwayat-final/`.

Commit lokal menggunakan allowlist dan index sementara agar staged Prisma tidak
ikut. Judul: **Tampilkan riwayat pesanan berdasarkan waktu penutupan**.
Hash commit disampaikan pada laporan akhir (tidak membuat self-reference hash).
Diff index historis dan SHA256 WIP dibandingkan dengan snapshot awal, termasuk
Prisma; status/HEAD/WIP Customer serta Staff juga diperiksa. Source Dashboard,
CSS Dashboard dan service Dashboard tetap identik. Tidak push/merge/deploy.

Keterbatasan tersisa: referensi gambar, screenshot historis tepat sebelum edit,
halaman2 pada dataset utama, serta browser STAFF dengan login manual terpisah
belum diverifikasi. Otorisasi STAFF sudah diuji HTTP pada DB fixture. Tidak
memicu perubahan status/payment pada data utama atau transaksi provider baru.
