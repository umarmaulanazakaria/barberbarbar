# Detail & Tindakan — hasil implementasi

17 Oktober 2026, branch `feature/project5-integration`, basis `ecfcf5a31ac15c7859d5270a793cafef22286d51`.
Source dikerjakan langsung pada Project 3 asli; tidak membuat worktree atau mengubah source Staff/Customer.

## Implementasi

- `RincianPesananDrawer` aktif tetap dipasang AppLayout, dibuka query Dashboard
  `rincianBooking` / `rincianPesanan`. Tombol/footer tidak lagi menuju `/orders`
  atau modal lama. Route legacy tetap tersedia untuk kompatibilitas internal.
- Komponen `TindakanPesanan` berisi aksi inline, konfirmasi penerimaan uang,
  loading/error, rekonsiliasi QRIS dan audit pembayaran. CSS hanya `.dt-*`;
  DashboardPage/DashboardFinal, History dan Tambah Walk-in tidak diubah.
- DP menampilkan nominal, deadline WIB, status provider; link Snap hanya jika
  benar-benar tersimpan READY/PENDING, host resmi, round dan deadline masih sah.
  Tidak membuat link atau menganggap DP terbayar dari callback browser.
- Check-in tetap endpoint existing dan tidak memulai pelayanan. Saat CHECKED_IN,
  barber reservasi/disetujui menjadi default. ADMIN dapat mengganti barber saat
  Mulai Layanan; aktif, kapasitas dan busy diperiksa dalam transaksi existing.
  Perubahan dicatat sebagai ADMIN_ASSIGN_BARBER dengan aktor dan ID sebelum/sesudah.
  Endpoint Staff lama tetap memakai aturan persetujuan barber lama.
- Walk-in WAITING memilih barber lalu start+assignment atomik melalui endpoint
  existing. Complete Booking/Walk-in tetap memakai lifecycle resmi. Setelah
  check-in/start/complete/tunai/transfer drawer tetap terbuka.
- Setelah COMPLETED, hanya seluruh balance yang dihitung backend dapat dilunasi.
  Booking mengurangi DP/kredit sah dari ledger existing; Walk-in memakai kasir
  dan kuitansi existing. Tunai memerlukan konfirmasi fisik, bisa menerima uang
  lebih dan menghitung kembalian. Transfer wajib konfirmasi dana diterima serta
  referensi. Operator, waktu, nominal, referensi dan relasi kuitansi disimpan.
  CARD tidak ditawarkan dan ditolak endpoint baru; API historis tidak dihapus.
- QRIS dinamis Core API dibuat backend untuk balance DB. Intent disimpan sebelum
  jaringan; satu Pending per Pesanan, idempotensi UUID dan fingerprint. Membuka
  kembali drawer mengambil intent sama, tidak membuat charge baru.
- QR asli tampil inline dari host Sandbox resmi. Jika actions tidak tersedia,
  endpoint gambar terdokumentasi berdasarkan transaction ID harus merespons PNG
  resmi terlebih dahulu. Tidak membuat QR palsu. Expiry ditampilkan jika provider
  menyediakannya; tidak menandai expired hanya dari jam frontend.
- Signature SHA-512 diverifikasi, lalu Get Status memeriksa merchant/order/ID/
  nominal/currency/payment type. Respons charge hanya menyiapkan QR, tidak memberi
  kredit. Webhook melewati cache Pending; replay tetap satu kuitansi/ledger.
- QRIS Pending memblokir kasir dan edit item legacy untuk order sama. Snap Booking
  tidak boleh mengambil alih intent QRIS operator. Network tidak pasti tetap
  reserved sampai rekonsiliasi; gagal/expired yang sah dapat dicoba dengan intent baru.
- Notifikasi PostgreSQL sesudah commit memakai `order.changed` existing dan
  invalidasi React Query. Poll GET 5 detik + Get Status 15 detik saat drawer QRIS
  terbuka menjadi fallback. Menutup drawer tidak membatalkan pembayaran backend.
  Auto-close hanya ketika QRIS yang diamati SUCCEEDED dan saldo backend PAID;
  membuka invoice yang sudah lunas tidak otomatis menutup drawer.

## Endpoint dan data existing

| Endpoint | Penggunaan |
| --- | --- |
| GET /bookings/:id, /bookings/:id/payments, /orders/:id | Detail, item, ledger/balance/invoice resmi existing. |
| POST /bookings/:id/check-in, /complete | Lifecycle Booking existing. |
| PATCH /orders/:id/status | Lifecycle Walk-in existing, assignment saat start. |
| POST /management/actions/BOOKING/:id/start | Tambahan untuk kebijakan assignment ADMIN, fungsi start existing. |
| GET /management/actions/BOOKING/:id/context | Deadline/link/status DP berdasarkan DB. |
| POST /management/actions/BOOKING/:id/sync-dp | Pemeriksaan DP melalui layanan Midtrans existing. |
| GET/POST /management/payments/:pesananId | Daftar audit/intent dan pencatatan tunai/transfer/QRIS penuh. |
| POST /management/payments/:pesananId/:transaksiId/sync | Get Status, identitas transaksi harus terkait Pesanan tersebut. |
| POST /midtrans/notifications | BBOPS-* masuk handler QRIS baru; order lain tetap ke handler Booking existing. |

Semua endpoint management memakai JWT operator existing; anonymous/CUSTOMER
ditolak. Body strict, tidak menerima nominal QRIS atau status pembayaran dari
frontend. `tagihanDiharapkan` hanya guard perubahan harga; nominal kredit selalu
hasil perhitungan DB. Server Key tidak masuk DTO, source frontend atau screenshot.

## Migration, backup dan keselamatan

Pengguna menyetujui migration additive dan backup secara eksplisit. Migration
`20261017140000_pembayaran_operasional` menambah satu tabel PembayaranOperasional,
FK, unique key/provider/receipt, CHECK nominal/metode, dan partial unique Pending
per Pesanan. Tidak mengubah tabel/record finansial existing atau mengarang Booking
untuk Walk-in. Tabel baru menjadi reservasi/audit; kredit Booking tetap satu pada
TransaksiPembayaranBooking, kuitansi Walk-in tetap Pembayaran.

Migration diuji pada fixture dahulu. Backup utama privat di
`%LOCALAPPDATA%/BARBERBARBAR/database-backups/e2e-2026-10-17T11-27-42-446Z`:
152.512 byte, SHA-256 `0843b8ab363abfb05e9c5c138111e563e2780a37df90472c2806b0cb763e37e8`.
Checksum, pg_restore list/pembacaan penuh tanpa restore, serta snapshot 22 model
domain diverifikasi sebelum/sesudah penerapan. Seluruh record existing identik;
tabel baru kosong saat penerapan utama. Tidak reset, drop, restore massal atau Production.
Lihat [rencana migration](../../server/DETAIL-TINDAKAN-MIGRATION-PLAN.md).

## Pengujian aktual

| Pengujian | Hasil |
| --- | --- |
| TypeScript/build backend dan frontend | PASS. Build menggunakan dependency existing. |
| test-detail-tindakan.mjs | PASS, 12 kelompok HTTP/PostgreSQL/browser dengan provider stub. |
| Lifecycle | PASS, DP wajib bukti, check-in terpisah, start/assignment/complete, start paralel tepat satu sukses. |
| Tunai/transfer | PASS, konfirmasi dan referensi wajib, full balance, kembalian, audit, dua request satu kuitansi. |
| QRIS Pending/sukses/gagal/expired/retry | PASS pada gateway stub; signature/nominal salah tidak mengkredit, pending menahan kasir/item, replay satu kredit. |
| Drawer Pending ditutup/dibuka | PASS, tetap satu intent; hasil verified auto-close; aksi non-QRIS tetap di Dashboard. |
| Booking pelunasan QRIS | PASS fixture/provider stub, DP 5.000 + pelunasan 5.000 = total 10.000, balance nol dan invoice tunggal. |
| Walk-in existing | PASS, 8 kelompok HTTP test-walkin-dashboard.mjs. |
| Guest/Native/Socket/ledger existing | PASS, 12 kelompok test-guest-booking.mjs, provider stub. |
| Dashboard dan Riwayat | PASS, masing-masing 10 kelompok existing. |
| Viewport Chrome | PASS, 320/390/768/1440/1920, tanpa overflow horizontal/pageerror. |
| QRIS provider Sandbox nyata | PASS, tepat satu transaksi Rp5.000, simulator resmi, Get Status settlement, PAID, invoice, replay HTTP dua kali dan auto-close. |
| Delivery notifikasi internet Sandbox ke fixture | DEFERRED. Fixture tidak dipublikasikan lewat ngrok. Handler diuji dengan notifikasi stub dan replay HTTP lokal bertanda tangan atas payload Get Status nyata. Jangan menyamakannya dengan bukti delivery dari provider lewat internet. |
| Perangkat HP fisik / pixel-perfect prototipe | DEFERRED. Viewport Chrome diuji; gambar referensi/prototipe tidak tersedia dalam attachment. |

Suite fixture membersihkan hanya ID milik suite, tanpa reset. Fixture Sandbox
dibersihkan sesudah SUCCEEDED; tidak menghapus transaksi/histori pada provider.
Tidak memakai customer asli, tidak membuat transaksi provider pada DB utama.
Warning nonfatal existing: bundle Vite >500 kB, annotation Zod dan deprecation
antrean query pg; tidak melakukan upgrade dependency atau refactor terkait.

## Bukti Sandbox

Pengguna menyetujui secara terpisah satu QRIS Rp5.000 dan simulator resmi setelah
automatic approval review meminta izin transaksi provider eksplisit. Tidak ada
charge yang dibuat sebelum persetujuan tersebut.

- Order provider: `BBOPS-22f8cedd-ef84-407c-b9b0-a6475012cbc4`.
- Transaction ID: `a541934c-5819-4e0e-9365-14c7661cc92d`.
- Get Status: `settlement`, `payment_type=qris`, Rp5.000.
- Satu invoice: `INV-236703547-258`; satu kredit setelah dua replay.
- [Bukti terstruktur](DETAIL-TINDAKAN-SANDBOX.json) tidak memuat key/signature/token.
- Dokumen provider: [QRIS Core API](https://docs.midtrans.com/reference/qris),
  [pengujian Sandbox](https://docs.midtrans.com/docs/testing-payment-on-sandbox).

## Screenshot

Semua screenshot berasal dari Vite/source aktif dengan API fixture PostgreSQL
nyata, bukan mock halaman. Screenshot QRIS menggunakan gambar provider Sandbox
nyata yang telah selesai dibayar, bukan generator/placeholder.

- [Desktop tunai](screenshots/detail-tindakan/1440-tunai.png)
- [Desktop transfer](screenshots/detail-tindakan/1440-transfer.png)
- [Mobile tunai](screenshots/detail-tindakan/390-tunai.png)
- [Mobile transfer](screenshots/detail-tindakan/390-transfer.png)
- [Desktop QRIS Sandbox](screenshots/detail-tindakan/1440-qris-sandbox-pending.png)
- [Mobile QRIS Sandbox](screenshots/detail-tindakan/390-qris-sandbox-pending.png)

## File perubahan dan Git

- Client: `RincianPesananDrawer.tsx`, komponen baru `TindakanPesanan.tsx/.css`.
- Backend: `app.ts`, route `tindakan-dashboard.routes.ts` dan
  `pembayaran-operasional.routes.ts`, service `pembayaran-operasional.service.ts`,
  helper `qris-midtrans.ts` dan `reservasi-pembayaran.ts`.
- Core existing: `pesanan.service.ts`, `pembayaran-booking.service.ts`,
  `item-pesanan.service.ts` untuk memakai core yang sama dan guard Pending;
  perubahan terbatas pada `operasional-booking.service.ts` dan
  `midtrans-booking.service.ts` tanpa memasukkan WIP historis ke commit fitur.
- Schema, satu migration, rencana migration, dua script tes, laporan dan screenshot.

Commit lokal memakai index sementara/allowlist. Untuk dua file yang sudah WIP,
hanya hunk fitur baru ditransplantasikan ke blob HEAD; perubahan lama tetap
unstaged. Staged `server/src/lib/prisma.ts` tidak diubah atau diikutkan.
Commit berjudul **Tambahkan tindakan dan pembayaran pesanan langsung di drawer**;
hash dilaporkan pada jawaban akhir. Tidak push/merge/deploy. Git akhir tetap
memiliki WIP historis, bukan clean.

## Batasan yang dipertahankan secara aman

Timeout charge tetap reserved (UNCERTAIN) sampai provider dapat direkonsiliasi;
404 sesaat tidak dianggap bukti bahwa charge lama pasti tidak ada. Jangan membuat
pesanan/pembayaran pengganti saat hasil belum pasti. Jika provider melaporkan
settlement yang berkonflik dengan kredit lain, bukti ditahan untuk pemeriksaan
Admin, tidak diberi kredit ganda atau refund otomatis. Fitur ini tetap Sandbox,
tidak mengaktifkan Production. Uji internet webhook dan perangkat fisik masih
DEFERRED sebagaimana tabel; hasil provider nyata pada sesi ini adalah QRIS
Walk-in, sedangkan QRIS Booking terbukti lewat integrasi provider stub.
