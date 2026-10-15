# Audit pembayaran, webhook dan bahasa antarmuka

15 Oktober 2026. Lingkup: Project 3 Web/backend, Project 4 Staff, Project 5
Customer; dilanjutkan dengan perbaikan startup webhook. Branch ketiganya
`feature/project5-integration`. Implementasi dan regresi lokal **PASS**;
pengiriman ulang webhook Midtrans nyata dan acceptance perangkat **DEFERRED**.
Laporan ini tidak menyatakan keseluruhan pengujian provider/native selesai.

## Baseline dan perlindungan

| Repository | HEAD sebelum pekerjaan |
|---|---|
| barberbarbar | e57fe497b911d0afc089ac38883522a00f4af80d |
| barberbarbar-mobile | 2af6c93deccf81208dac65a049877bcfa3ffc2f5 |
| barberbarbar-customer | a2be072701fcf5f1d73b1a8c5f944e82a882129c |

Tidak ada dependency baru, perubahan environment, migration atau reset database.
Tiga file historis tetap utuh: `server/src/lib/prisma.ts` (termasuk staged blob
`6594970f6d44cfae4ac899cd83f14f6991dce0a0`), Staff
`src/layar/LayarTambahPelanggan.tsx` dan `src/layanan/booking.ts`.
Hash pembanding tercatat di [INTEGRITAS.json](payment-ui/INTEGRITAS.json).
File-file tersebut dikecualikan dari commit.

Backup source privat sebelum perubahan berisi 15.522 file / 384.535.643 byte,
diverifikasi SHA-256. Backup database awal diverifikasi melalui checksum,
`pg_restore --list`, dekompresi tanpa restore dan snapshot 22 model. Backup dan
environment berada di luar Stage 2/Git. Launcher PowerShell yang ditemukan
kemudian juga disalin ke TEMP sebelum disunting.

## Penyebab webhook dan kondisi operasional

Pada pemeriksaan awal, backend lokal dapat merespons POST JSON kosong dengan
400 `Notifikasi tidak valid`, tetapi domain publik mengembalikan 404
`ERR_NGROK_3200`: tunnel tidak tersedia. Ini merupakan gangguan transport yang
terbukti pada saat audit. Tanpa log historis pukul 09.48 WIB, penyebab tepat
kegagalan Pending/Settlement pada waktu tersebut tidak dapat dipastikan.
Route backend bukan route yang hilang pada pengujian sekarang.

Launcher PowerShell yang ditemukan masih mengarahkan ngrok langsung ke 3000
dan hanya memeriksa port tanpa identitas backend. Watch Node mengikuti graph
dependency, termasuk node_modules. Keduanya diperbaiki. Kejadian LISTEN_ERROR
sebelumnya konsisten dengan dua backend memakai port sama; tidak ada bukti
bahwa itu satu-satunya penyebab kegagalan webhook historis.

Arsitektur yang dipertahankan:

```text
Midtrans Sandbox -> HTTPS ngrok -> loopback proxy 3001
                 -> backend 3000 -> POST /midtrans/notifications
```

Proxy hanya menerima POST JSON pada path tepat tersebut. Route operator,
customer dan katalog tidak diteruskan. Body maksimal 64 KiB, timeout ke backend
25 detik; kegagalan backend menghasilkan 503. Payload/signature/credential tidak
dicetak. Respons 400 pada payload kosong membuktikan route tersedia, bukan
membuktikan settlement provider nyata.

Backend, proxy dan domain publik berhasil memberikan 400 yang diharapkan.
API agent ngrok mengonfirmasi tujuan `http://localhost:3001`. Domain publik
aktif tetap sama dengan yang diberikan pengguna. Dashboard Midtrans tidak
dibuka/disunting; tidak perlu mengganti URL **jika** pengaturan Sandbox masih
`https://DOMAIN-NGROK-AKTIF/midtrans/notifications`. Bila domain berubah,
Notification URL harus diperbarui. URL checkout/frontend bukan Notification URL.
Source pembuatan Snap tidak memasang override Notification URL.

## Transaksi Rp12.500: pemeriksaan resmi read-only

Order `BBF7-PELUNASAN-1238-7b2b27d081ca473d`, transaction ID
`cf448189-50a3-478d-b943-23406c2173c2`.

| Pemeriksaan | Hasil |
|---|---|
| GET Status Sandbox resmi | settlement; GoPay; IDR 12500.00 |
| Merchant/order/transaction/nominal | cocok dengan transaksi lokal |
| Ledger pelunasan | SUCCEEDED, nominal 12.500, satu kredit |
| Total booking / dibayar | 25.000 / 25.000 |
| Saldo / DP | 0 / terverifikasi |
| Invoice | satu invoice final |
| Bukti pelunasan | satu bukti provider |
| Mutasi/retry/refund untuk order tersebut | tidak dilakukan |

Bukti disanitasi ada di [TRANSAKSI-TARGET.json](payment-ui/TRANSAKSI-TARGET.json).
Tidak diperlukan rekonsiliasi yang menulis database untuk order tersebut.

## Verifikasi dan pemulihan pembayaran

Service existing tetap menjadi otoritas. Webhook memeriksa signature SHA-512,
order lokal, merchant, nominal, lalu mengambil status resmi Midtrans. Schema
status mensyaratkan IDR; identitas transaction ID dicocokkan. Lock transaksi
keuangan existing, bukti provider dan finalisasi invoice tetap digunakan.
Notifikasi duplikat yang sah mendapat 200; kegagalan sebelum commit tetap error.
Pending sesudah settlement tidak menurunkan kredit SUCCEEDED.

Perubahan:

- Perubahan status ledger mencatat `PAYMENT_STATUS_VERIFIED` dalam transaksi
  atomik yang sama. Metadata hanya ID lokal, tujuan, nominal dan status;
  replay tidak menambah catatan perubahan yang sama.
- Endpoint sync Customer memeriksa kepemilikan **sebelum** memakai penggabungan
  request. Get Status yang bersamaan digabung; cooldown lima detik dihitung
  sejak selesai, termasuk kegagalan. Cache dibatasi 10.000 entry dan dibersihkan
  saat akses berikutnya. Cache hanya lokal proses; bukan rate limit lintas instance.
- Pemulihan Customer tidak membuat Snap, mengirim refund, membuat permohonan
  refund atau merekonsiliasi refund. Workflow refund ADMIN/internal existing
  tetap membaca status terbaru tanpa cooldown Customer.
- Timeout/network provider menghasilkan 503; status tidak ditemukan tetap 404.
  Kegagalan tidak ditampilkan sebagai sukses dan tidak mengubah ledger.
- Customer kembali dari checkout melakukan sync backend lalu REST refetch.
  Refetch tetap dijalankan bila sync gagal. AppState active dan tombol pemeriksaan
  status juga tersedia; callback browser tidak dianggap sebagai bukti lunas.

Tidak ditambahkan scheduler/timer kedua atau polling latar tanpa batas.
Scheduler DP existing tetap dipertahankan. Pemulihan pelunasan dipicu aktivitas
Customer/request eksplisit, sehingga tidak menjanjikan rekonsiliasi otomatis
ketika aplikasi dan laptop sama-sama offline. Konfigurasi gateway existing
tetap menolak Production; hanya Sandbox pada lingkungan ini.

## Satu launcher development

Dari folder `barberbarbar`:

```powershell
# Backend + proxy, tanpa mewajibkan tunnel atau menjalankan Expo/Web:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\jalankan-barberbarbar.ps1 -HanyaBackend

# Pengujian pembayaran: tambahkan ngrok ke port 3001:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\jalankan-barberbarbar.ps1 -HanyaBackend -Ngrok

# Read-only: cek identitas, backend, proxy, dan forwarding tunnel jika aktif:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\jalankan-barberbarbar.ps1 -HanyaBackend -Periksa
```

Tanpa `-HanyaBackend`, launcher juga menjalankan Web/Expo Staff/Customer bila
portnya belum dipakai. `-TanpaNgrok` tetap diterima sebagai opsi kompatibilitas;
ngrok sekarang opt-in. Tidak ada pemasangan paket otomatis.

Launcher menggunakan mutex workspace, memeriksa PID/executable/entrypoint
absolut, tidak membunuh proses existing, dan menolak port dengan identitas lain
atau entrypoint relatif yang tidak bisa dikaitkan pasti dengan workspace.
Backend dijalankan sebagai `node <path-absolut>/dist/server.js`.
Build hanya dilakukan ketika backend belum berjalan; backend existing tidak
di-restart diam-diam. Untuk memuat source baru, hentikan hanya proses backend
yang identitasnya telah diverifikasi lalu jalankan launcher kembali.
Proses berjalan tersembunyi, log privat di LOCALAPPDATA/BARBERBARBAR/development.

Backend lama diverifikasi sebagai Node `dist/server.js` dengan respons API yang
sesuai, lalu diganti sekali untuk memuat build perbaikan. Launcher dipanggil
ulang dua kali: PID backend tetap tunggal, proxy tetap sama, forwarding tetap
3001. Perintah `npm.cmd run dev` saat port digunakan kini gagal sebelum compiler
watch dimulai. Bila dipakai sendiri pada port kosong, watch dibatasi ke `dist`,
sehingga perubahan node_modules tidak menjadi pemicu restart.

Komputer, jaringan, backend, proxy dan tunnel harus hidup agar webhook lokal
dapat diterima. Konfigurasi laptop ini tidak memberikan uptime Production.

## Bahasa antarmuka tiga aplikasi

Label tampilan dilokalkan tanpa mengubah enum/API, navigasi, desain atau
pemilihan barber (bebas=null; spesifik=ID). Error umum difilter agar respons
HTML/JSON, stack, token atau istilah teknis tidak menjadi pesan pengguna.
Pemberitahuan **“Pembayaran percobaan — tidak ada uang sungguhan yang ditarik.”**
hanya ditampilkan di area pembayaran saat flag `pembayaranPercobaan` backend
bernilai true. Field DTO bersifat tambahan/opsional untuk kompatibilitas.

| Area | Contoh perubahan |
|---|---|
| Web navigasi/dashboard/master data | Orders → Pesanan, Services → Layanan; tombol/modal/loading/label aksesibilitas Indonesia |
| Web booking/pembayaran/refund | status tampilan ramah; rincian riwayat manusiawi menggantikan JSON; status refund diproses tetap belum dianggap berhasil |
| Staff beranda/pesanan/booking/kasir | Order/Service/Payment → Pesanan/Layanan/Pembayaran; label status dan pesan koneksi ramah |
| Customer autentikasi/booking/detail | bantuan teknis simulasi dihapus; Bayar Uang Muka/Lunasi Tagihan; status ramah dan refetch setelah checkout |
| Ketiganya | label status terpusat identik, error aman, transparansi pembayaran percobaan dari backend |

Daftar lengkap literal source yang berubah per file tersedia di
[LITERAL-UI-BERUBAH.json](payment-ui/LITERAL-UI-BERUBAH.json). Daftar ini mencakup
literal internal TSX juga; bukan klaim semua string tersebut dirender dan bukan
pengganti acceptance visual perangkat. Daftar file lengkap ada di
[DAFTAR-BERKAS.json](payment-ui/DAFTAR-BERKAS.json).

## Hasil pengujian

| Pengujian | Status / batas bukti |
|---|---|
| Regresi existing 27 suite | PASS 27/27; termasuk akun, reset, publik, membership, booking, lifecycle, payment, scheduler, realtime, kasir/kontrak Web/Staff/Customer |
| TypeScript backend/Web/Staff/Customer | PASS |
| Build backend dan Web | PASS |
| Export Android Staff/Customer dan Expo check | PASS; bundling Hermes, bukan tes perangkat |
| Browser E2E Web | PASS pada port acak/database uji |
| Midtrans integration | PASS 17 kelompok MOCK melalui suite realtime; signature salah, settlement, duplikat/concurrent, pending terlambat, nominal/merchant/currency/ID, Get Status, rollback dan konsistensi invoice |
| Recovery terminal tanpa refund | PASS fixture dibatalkan, kredit resmi dipulihkan tanpa perubahan status booking/Snap/refund/invoice baru |
| Cooldown/inflight Get Status | PASS; concurrent, timeout, cache expiry, transaksi berbeda |
| Proxy | PASS path/metode/content type dan backend mati →503 |
| Startup | PASS parser/identitas absolut; relatif/lokasi lain/suffix palsu ditolak; port terpakai tidak menjalankan watch kedua |
| Readiness backend/proxy/ngrok | PASS; POST kosong 400, forwarding 3001, pemanggilan ulang tanpa backend duplikat |
| Audit bahasa antarmuka | PASS 63 file TSX, kamus tiga aplikasi, error aman dan render komponen pembayaran Web |
| Detail Customer | PASS adapter komponen aktual: alasan penolakan, flag percobaan, REST refetch setelah checkout sukses/timeout |
| Prisma | PASS validate; 18 migration applied/up-to-date; tidak menjalankan migration |
| Get Status Sandbox transaksi Rp12.500 | PASS nyata/read-only |
| Webhook settlement provider nyata yang dikirim ulang pada sesi ini | DEFERRED; tidak ada redelivery provider baru atau pembayaran baru |
| Acceptance native/perangkat dan visual seluruh layar | DEFERRED; perangkat belum tersedia |

[REGRESI.json](payment-ui/REGRESI.json) menyimpan hasil aktual dan riwayat retry.
Percobaan awal build Web gagal karena konfigurasi target TypeScript; assertion
UI lama juga tidak cocok dengan label Indonesia baru. Konfigurasi Vite kini
memakai loadEnv dan tes diperbarui tanpa menambah dependency; pengulangan lulus.
Port tes dipisahkan dari backend/tunnel aktif. Tidak ada raw log sensitif dalam bukti publik.

Fixture dijalankan serial pada database lokal terpisah yang dibuat kosong dari
schema backup, tanpa menyalin data customer asli. Setiap suite membandingkan
22 model sebelum/sesudah dan membersihkan fixture. Tidak ada test dijalankan
dengan fixture pada database aplikasi existing dalam pekerjaan ini.
Setelah seluruh regresi selesai, semua tabel database fixture diverifikasi
kosong dan hanya database uji milik tugas tersebut dibersihkan tanpa force.

Snapshot pagi awalnya identik dengan database existing (159 record). Pada
pemeriksaan akhir ditemukan perubahan aktivitas aplikasi: booking/pesanan/
pembayaran tambahan dan keputusan membership existing berubah. Pemeriksaan
terhadap snapshot pagi sengaja **FAIL**, tidak disembunyikan dan tidak di-rollback.
Asal perubahan tersebut tidak diklaim telah dibuktikan. Seluruh tes tugas ini
memakai DATABASE_URL uji terpisah. Record tambahan dipertahankan.

Backup terbaru `e2e-2026-10-15T05-56-20-620Z` dibuat di direktori privat luar
workspace, 128.389 byte, checksum
`6bf48f535e258db66d8483c5b4cf36a29fb6442ce4b2c12f670c7a7aee90b40a`.
Arsip dapat dibaca/dekompresi tanpa restore; snapshot 22 model sebelum/sesudah
backup identik. Audit akhir terhadap baseline terbaru **PASS**, keenam cek
orphan/duplikasi invoice/hash permohonan final nol. Transaksi target tetap utuh.

## Git dan keterbatasan

Perubahan hanya pada file relevan yang tercantum di daftar bukti. Tidak ada
`.env`, dump, snapshot data pribadi, token Snap, key atau signature asli yang
ditambahkan. Root Stage 2 tetap tiga repository. Tidak ada force push/merge main.
Commit source berikut sudah di-push ke `origin/feature/project5-integration`;
fetch/push dan upstream diverifikasi **0 ahead / 0 behind** pada ketiganya:

| Repository | Commit source | File |
|---|---|---|
| Project 3 | c2dee649822bb1d86b2e7e12a0faa92736108d44 | 56 |
| Project 4 | 283aedacbee6d69d02090f6fedc336f721ad4c78 | 16 |
| Project 5 | 1fce760a6a2a6afaba061ad1f3a0a2817f53aae5 | 8 |

Dokumentasi penutupan diperbarui sesudah commit source tersebut. Pemeriksaan
post-commit mengonfirmasi Project 3 hanya menyisakan perubahan Prisma historis
yang staged; Project 4 hanya perubahan historis `src/layanan/booking.ts` yang
unstaged; Project 5 bersih. `LayarTambahPelanggan.tsx` tidak berubah. Tidak ada
perubahan buatan tugas ini yang sengaja dibiarkan di working tree.

Pemindaian sebelum commit sempat menemukan dua placeholder email yang cocok
dengan akun operator lokal. Keduanya diganti contoh generik di pengaturan Web
dan login Staff, tanpa mengubah akun. Literal lama pada bukti publik disamarkan.
Pengujian Web/Staff terkait diulang setelah perubahan tersebut.
Pemindaian akhir [KEAMANAN.json](payment-ui/KEAMANAN.json) PASS: nol kecocokan
credential/data pribadi yang diperiksa, nol environment asli yang dilacak Git.
Ini pemindaian terbatas pada perubahan, bukan jaminan seluruh riwayat Git.

Keberhasilan route publik dan Get Status tidak membuktikan pengiriman ulang
settlement dari Midtrans pada sesi ini. Untuk menerima event berikutnya,
Notification URL dashboard harus tetap menunjuk domain tunnel aktif dan semua
proses lokal harus berjalan. Tidak ada permintaan membayar ulang order target.

Rujukan provider: [Get Transaction Status](https://docs.midtrans.com/reference/get-transaction-status)
dan [HTTPS notifications/webhooks](https://docs.midtrans.com/docs/https-notification-webhooks).
