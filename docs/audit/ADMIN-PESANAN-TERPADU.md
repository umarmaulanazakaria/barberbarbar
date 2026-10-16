# Audit Dashboard dan Pesanan Terpadu

16 Oktober 2026 WIB. Branch lokal `feat/admin-pesanan-terpadu`, worktree `barberbarbar-admin-pesanan`, basis `74613f0996637875c883eb950f6c7f49205ed887` dari backend guest yang sudah terverifikasi. Bukan origin/main lama. Worktree guest bersih sebelum pekerjaan; tidak ada penimpaan pekerjaan lain.

## Hasil

Dashboard tidak lagi memasang RingkasanBookingDashboard dan sidebar tidak lagi mempunyai Booking Pelanggan. Pesanan Terbaru adalah satu tabel booking Native, booking Web dan walk-in dengan tanggal operasional hari ini menurut WIB. Kartu status, pembayaran, pendapatan, ringkasan pelanggan/barber/layanan dan Pesanan Baru tetap ada, tanpa redesign global.

Booking memakai mulaiPada. Walk-in memakai checkInTime (timestamp UTC domain Pesanan existing), bukan dibuatPada/diperbaruiPada. Booking yang punya pesananId hanya muncul sebagai booking; cabang walk-in memakai NOT EXISTS untuk mengecualikan seluruh order linked, termasuk ketika tanggal booking dan check-in order berbeda. Booking yang belum punya Pesanan tidak dibuatkan order fiktif. Barber null ditampilkan Belum ditentukan.

Urutan stabil: jadwal DESC, jenis ASC, id DESC. Dashboard mengambil7 entri terbaru hari ini; seluruh hasil tersedia di Pesanan dengan pagination20 per halaman, maksimum API50. Tanggal, status, jenis dan pencarian difilter di database sebelum LIMIT/OFFSET. COUNT dan daftar dibaca dalam satu transaksi RepeatableRead. Halaman kosong tetap mengembalikan total yang benar.

## Endpoint dan kontrak

Satu endpoint presentasi baru: `GET /management/orders`, memakai middleware operator existing. CUSTOMER dan anonim401; ADMIN/STAFF dapat membaca seperti kebijakan daftar operator lama. Tidak menghapus atau mengubah kontrak endpoint Mobile/Customer.

Parameter:

- jenis: SEMUA / BOOKING / WALK_IN.
- periode: HARI_INI (default), SEMUA, RENTANG, RIWAYAT (sebelum awal hari ini).
- mulai / selesai: YYYY-MM-DD valid, inklusif hari WIB; batas akhir query eksklusif awal hari berikutnya.
- status: status domain existing; pembayaran: SEMUA / PAID / UNPAID.
- cari: nomor booking/order/nama pelanggan; halaman dan batas divalidasi.
- ringkasan=true hanya untuk dashboard.

Respons berisi ref booking/order, nama pelanggan/barber, waktu, status, total, invoice dan pagination; tidak mengirim telepon, hash, token atau payload provider. SQL memakai Prisma.sql terparameterisasi. Ringkasan status pembayaran booking memakai service ledger existing; filter lunas memakai hanya kredit sah dikurangi refund sah, tanpa menghitung pending. No-show/cancelled/rejected tidak dimasukkan sebagai tagihan UNPAID yang masih wajib dilunasi.

## Metrik dan uang

Semantik kartu kasir existing dipertahankan. Menunggu/IN_SERVICE/COMPLETED-unpaid menghitung Pesanan existing sekali, tanpa menambah booking hold AWAITING_DP sebagai order. Pembayaran Hari Ini dan Pendapatan Hari Ini memakai receipt final Pembayaran dan total Pesanan terkait, dengan batas WIB [00.00,00.00 berikutnya). Ledger DP/refund tidak ditambahkan lagi sehingga tidak menggandakan receipt booking.

Ini tetap metrik receipt final kasir, bukan laporan arus kas ledger DP harian atau pendapatan bersih setelah refund. Pending bukan receipt final; refund bukan pendapatan baru. Tidak mengubah akuntansi, ledger, webhook, Snap, diskon, DP15menit, konfirmasi otomatis, refund atau invoice. Tidak ada migration/schema/dependency baru.

## Pesanan, detail dan riwayat

Pesanan menyediakan filter jenis, semua tanggal/hari ini/rentang/sebelum hari ini, status domain, lunas/belum lunas, pencarian dan pagination. Booking masa depan tetap dapat ditemukan pada Semua tanggal atau rentang. Filter/page disimpan di URL. Riwayat memakai daftar yang sama dengan default sebelum hari ini; tidak lagi membatasi hanya walk-in lunas atau memakai updatedAt sebagai tanggal.

Booking membuka `/orders/booking/:id`, memakai DetailBookingPage existing untuk confirm/reject Native, check-in, barber, start/complete, perubahan layanan, pelunasan dan invoice. Guest CONFIRMED tidak memiliki aksi confirm ulang. Walk-in membuka OrderDetailModal existing, sambil mempertahankan filter/page/riwayat asal.

Compatibility route `/bookings` mengarah ke filter Pesanan booking semua tanggal; `/bookings/:id` ke detail baru; `/orders/:id` dan `/orders/:id/payment` tetap membawa ID ke modal, bukan membuang ID seperti redirect sebelumnya. Menu refund/invoice/pelanggan dan lainnya dipertahankan sesuai role existing.

## Realtime dan pergantian hari

Query baru memakai akar `dashboard` dan `orders`, sehingga mekanisme Socket.IO existing tetap invalidate/refetch REST. Payload event tidak ditulis sebagai status domain. Refetch15detik menjadi fallback. Hook hari WIB menyelaraskan clock dari serverTime, memeriksa perubahan hari setiap detik dan saat focus; hari menjadi query key sehingga setelah tengah malam hasil lama diganti. Batas query menggunakan clock PostgreSQL, tidak bergantung timezone komputer/browser.

## Pengujian aktual

| Kelompok | Hasil |
| --- | --- |
| TypeScript dan build backend | PASS |
| Prisma validate | PASS |
| TypeScript dan build Web Admin | PASS |
| HTTP/Prisma pesanan terpadu | 8 kelompok PASS |
| Chrome browser → HTTP → PostgreSQL → Socket.IO | 8 kelompok PASS |
| Guest/Native login, barber, konfirmasi, DP, riwayat, IDOR, race, realtime | 12 kelompok PASS, provider MOCK |
| Booking/kasir Project3/4 existing | 15 kelompok PASS |
| Midtrans/refund/idempotency existing | 17 kelompok PASS, provider MOCK |
| Cleanup fixture | PASS,23 model identik dengan snapshot awal |
| Smoke runtime lokal | PASS: katalog200, management/Customer tanpa JWT401, guest tanpa token404; Admin5189/Customer5175 HTTP200 |

API mencakup35 entri hari ini,4 halaman, total pada halaman kosong, booking besok/kemarin, linked order dengan tanggal berbeda, paid/unpaid, invoice, guard JWT, query tanggal invalid/injection dan DTO tanpa secret. Fixture negatif awal ditolak constraint; data uji diperbaiki, constraint tidak dilonggarkan.

Browser mencakup hilangnya section/sidebar, tabel paid hari ini, filter/pagination, detail/invoice, Native masa depan dikonfirmasi, tab lain mendapat refetch kurang dari5detik lewat Socket, guest CONFIRMED check-in→barber→start→complete tanpa confirm, Riwayat dan modal menjaga context, rentang/reload dan viewport375/768/1440. Kasus pergantian hari memakai clock/REST fixture terisolasi; kasus lainnya memakai API/PostgreSQL/Socket aktual. Tidak mengklaim menunggu tengah malam sungguhan.

Booking00.00/00.30/23.59 tidak dipaksakan ke DB karena schema existing mewajibkan jam09–23. Batas00.00/00.30/23.59 diuji melalui walk-in dan fungsi WIB; booking memakai jam valid termasuk22.30→23.00. Pembayaran fixture hanya data awal di database test; browser tidak memanggil endpoint pembayaran/provider. Tidak ada transaksi Midtrans nyata baru, refund provider, atau perubahan transaksi pengguna untuk tes Dashboard.

Build memberi warning ukuran bundle existing dan annotation Zod; tetap exit0. Tidak dilakukan refactor bundle/dependency yang tidak terkait. Device Mobile Staff/Native tidak diuji ulang; API compatibility dan source terlindungi, bukan klaim device PASS.

## File fitur

Frontend: App.tsx, AppLayout.tsx, DashboardPage.tsx, OrdersPage.tsx, HistoryPage.tsx, DetailBookingPage.tsx (tautan kembali), types-booking.ts (status AWAITING_DP existing), lib/pesanan-terpadu.ts, components/DaftarPesananTerpadu.tsx, components/TabelPesananTerpadu.tsx, scripts/test-pesanan-terpadu-browser.mjs.

Backend: app.ts (mount terautentikasi), routes/manajemen.routes.ts, controllers/pesanan-terpadu.controller.ts, services/pesanan-terpadu.service.ts, scripts/test-pesanan-terpadu.mjs. Script serve/info/shutdown hanya milik harness fixture3188 dengan namespace test dan guard database kosong; tidak dipasang pada aplikasi produk.

## Runtime lokal dan Git

Backend kompatibel dijalankan dari worktree fitur pada3000 menggunakan konfigurasi existing lewat proses privat, tanpa menyalin/menyunting .env. Web Admin fitur: http://127.0.0.1:5189 . Customer Web5175 tetap berjalan. Port5188/3188 adalah harness tes dan sudah ditutup setelah cleanup. Frontend Admin original tidak dihentikan/ditimpa.

Semua source/staging historis original dijaga: server/src/lib/prisma.ts dan perubahan lama Dashboard/F10, Staff LayarTambahPelanggan.tsx/booking.ts, seluruh Native Customer dan Customer Web. Worktree guest dan origin/main tidak diubah. Tidak ada push, PR, merge, reset atau pembersihan backup. Commit hanya file fitur eksplisit, lokal.
