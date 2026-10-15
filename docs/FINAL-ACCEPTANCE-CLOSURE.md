# Final acceptance dan penyelesaian blocker

15 Oktober 2026. **NOT READY untuk release/Production.** Perbaikan mandiri dan
pengujian teknis selesai, tetapi delivery inbox, acceptance native yang rinci,
refund historis dan keputusan dependency masih terbuka. Source siap ditinjau;
laporan ini tidak mengubah hasil mock menjadi bukti Android/provider nyata.

## Baseline dan lingkup

HEAD aktual sebelum perubahan cocok dengan permintaan: Project 3
`504ffb8c6fc22be985e6b3ba33826a4a38635171`, Staff
`283aedacbee6d69d02090f6fedc336f721ad4c78`, Customer
`1fce760a6a2a6afaba061ad1f3a0a2817f53aae5`. Ketiganya pada
`feature/project5-integration`. Tidak menambah backend/dependency, mengubah
environment lokal, menjalankan migration atau transaksi finansial baru.

File historis Prisma beserta staged blob
`6594970f6d44cfae4ac899cd83f14f6991dce0a0`, Staff
`src/layar/LayarTambahPelanggan.tsx` dan `src/layanan/booking.ts` dipertahankan.
Root Stage 2 tetap tiga repository. Backup/snapshot/log privat di luar root.

## Ringkasan hasil

| Area | Hasil aktual |
|---|---|
| Baseline 27 suite + dua suite baru | PASS 29/29 setelah perbaikan browser; riwayat gagal dipertahankan |
| TypeScript/backend build/Web build | PASS |
| Expo dependency check dan Android Hermes Staff/Customer | PASS; bukan tes UI native |
| Auth/RBAC, membership, booking, lifecycle, kasir, payment/refund, invoice, scheduler, realtime | PASS integrasi fixture terisolasi |
| Token reset/expiry/single-use/concurrent/rollback/JWT revoke | PASS HTTP/database |
| Pengiriman email/template/error | PASS transport MOCK; inbox nyata DEFERRED |
| Perubahan identitas/password terautentikasi | PASS verifikasi password, konflik, rollback, pencabutan sesi |
| Reschedule layanan/qty/barber/waktu | PASS SDK ke backend dan adapter komponen aktual |
| Android Staff/Customer | USER-REPORTED berhasil secara umum; skenario individual belum dibuktikan kepada Codex |
| Webhook Pending/Settlement nyata | PASS menurut laporan pengguna pukul 13.20 WIB; tidak mengirim ulang |
| Checkout langsung dari Android | DEFERRED; bukti webhook tidak membuktikan pembukaan/kembali dari Android |
| Refund historis Rp2.000 | DEFERRED; tidak ada bukti final provider, tidak mengirim retry/refund |
| Security advisory | OPEN; nol Critical, temuan High/Moderate masih ada |
| Prisma | PASS validate; 18 migration up-to-date; tidak menerapkan migration |
| Database existing | PASS snapshot 22 model before/after identik dan enam pemeriksaan integritas nol |

Bukti mesin: [REGRESI.json](final-acceptance/REGRESI.json),
[BROWSER.json](final-acceptance/BROWSER.json),
[BROWSER-REPRO.json](final-acceptance/BROWSER-REPRO.json),
[INTEGRITAS.json](final-acceptance/INTEGRITAS.json),
[DEPENDENCY-AUDIT.json](final-acceptance/DEPENDENCY-AUDIT.json),
[GRAPH-DEPENDENCY.json](final-acceptance/GRAPH-DEPENDENCY.json), dan
[REFUND-HISTORIS.json](final-acceptance/REFUND-HISTORIS.json).

## Perbaikan source

### Reset password dan email

Endpoint reset existing tetap memakai randomBytes 32 byte, SHA-256 di database,
expiry 30 menit, bcrypt cost 12, lock akun dan klaim token atomik. Password lama,
token bekas/palsu/expired, request concurrent dan JWT lama diuji kembali.
Autentikasi ADMIN/STAFF tidak berubah.

Forgot-password kini memiliki kontrak transport internal, template HTML/teks
Indonesia, konfigurasi sender/link, dan flag global `pengirimanTersedia` yang
sama untuk email terdaftar/tidak. Token tidak dikembalikan atau dicetak. Default
transport **null/nonaktif**; tidak menerbitkan token yang tidak dapat dikirim.
Inventaris hanya nama/presensi environment menemukan belum ada konfigurasi email.
Tidak ada package email existing di backend.

Pekerjaan pengiriman dipisahkan dari respons HTTP agar latensi provider tidak
mengungkap akun. Batas global 20 pekerjaan bersamaan, dedup alamat 60 detik,
1.000 sidik alamat, timeout 15 detik/AbortSignal, tanpa retry otomatis. Kegagalan
mencabut hanya token pengiriman terkait, tidak mengubah akun. Log memakai kode
tetap tanpa payload/error provider. Tes menginjeksi transport mock; **tidak ada
klaim pengiriman inbox**. Pekerjaan masih di memori dan dapat hilang saat restart;
delivery andal/durable perlu diputuskan bersama provider sebelum rilis.

Customer menerima tautan dengan format ketat
`barberbarbar-customer://reset-password#token=...`, membuka formulir tanpa
menjalankan reset otomatis, segera membersihkan token dari params navigasi,
dan tidak menyimpannya ke storage/log. Parser tidak bergantung pada hostname
custom scheme milik URL Node: implementasi URL React Native yang terpasang
berbeda. Tes memverifikasi parser tetap berjalan bila API URL custom tidak ada,
menolak domain/scheme/query/duplikat/karakter tambahan, dan membersihkan field
setelah berhasil.

Scheme memerlukan native/development build baru, bukan janji kompatibilitas
Expo Go. Untuk email publik, domain HTTPS merchant dan Android App Links
terverifikasi lebih tepat daripada custom scheme yang dapat diklaim aplikasi
lain. Belum ada domain/build/provider yang diotorisasi untuk delivery nyata.
Lihat [Expo linking](https://docs.expo.dev/linking/into-your-app/) dan
[panduan konfigurasi reset](../server/scripts/RESET-PASSWORD-CUSTOMER.md).

### Identitas sensitif dan jadwal ulang

PATCH `/auth/customer/me` tetap kompatibel untuk nama/alamat. Email, telepon,
atau passwordBaru memerlukan passwordSaatIni dan dibatasi 20 percobaan per IP
per 15 menit. Mutasi memakai lock akun yang sama dengan reset, transaksi
Serializable, normalisasi email, pemeriksaan email reserved pada permohonan
pending, unique conflict umum, dan rollback jika perubahan pelanggan gagal.
ID akun/pelanggan tidak berubah. Rehash mencabut JWT lama dengan mekanisme
sidik kredensial existing, serta membatalkan token reset lama tanpa migration.
Customer membersihkan sesi dan meminta login kembali setelah perubahan sensitif.

Reschedule Customer kini menyediakan edit layanan/jumlah, mengirim `items` ke
endpoint existing, menghitung durasi baru untuk validasi jadwal, mempertahankan
draf saat refetch, dan memakai searchable dropdown termasuk barber bebas=null.
Layanan nonaktif harus dihapus/diganti. Backend tetap menentukan harga, diskon
snapshot, kecukupan DP, slot, refund dan konfirmasi ulang. Estimasi diskon kini
dibulatkan ke bawah sesuai perhitungan server, termasuk nominal ganjil.
Tidak membuat aturan DP/refund baru atau mengubah kasir Project 3.

### Race editor Web yang ditemukan saat regresi

Run penuh pertama 28/29: tes Hapus layanan timeout. Reproduksi terarah menahan
GET detail latar dan membuktikan kontrol edit nonaktif (`kontrolAktif=false`).
Source sebelumnya menonaktifkan edit lokal saat booking.isFetching. Sekarang
pilihan/qty/tambah/hapus/batal edit hanya terkunci selama mutation pending;
Simpan/tindakan server tetap mengikuti busy dan seluruh validasi backend.
Tes menahan GET lagi dan berhasil mengedit sebelum GET dilepas.

Percobaan reproduksi awal berhenti sebelum cleanup dan meninggalkan fixture
pada **database uji**, bukan database aplikasi. Fixture dibersihkan berdasarkan
ID dan tag kepemilikan yang diverifikasi. Intersepsi route kini ditunggu dengan
unrouteAll(wait) sebelum browser ditutup. Run berikutnya berhasil termasuk
cleanup snapshot 22 model; build/integrasi/browser diulang dan lulus. Tidak
menyelesaikan masalah dengan hanya memperpanjang timeout atau mengulang mutasi.

## Acceptance Android dan checkout

ADB memakai path absolut Android SDK; `devices -l` kosong dan `emulator
-list-avds` kosong. Tidak memasang emulator/software. Laporan pengguna bahwa
mobile sudah berhasil diakui sebagai **laporan umum**, bukan dihapus/dinyatakan
gagal. Tidak ditemukan bukti terperinci per skenario pada dokumen audit yang
diperiksa. Tabel berikut membedakan bukti otomatis dan native yang belum rinci.

| Kelompok | Otomatis aktual | Bukti native yang masih perlu dirinci |
|---|---|---|
| Staff login/navigasi/beranda/daftar pesanan/riwayat/logout/session | SDK/API/session/Hermes PASS | tanggal/build/perangkat dan skenario yang sudah diuji pengguna |
| Staff booking masuk/confirm/reject/check-in/barber/IN_SERVICE/kasir/realtime | HTTP + SDK lintas app + browser Web PASS | tindakan dari layar Staff Android, bukan browser/adapter |
| Customer login/register/beranda/booking/membership/riwayat/akun/session | HTTP/SDK/Hermes PASS | skenario yang sudah dijalankan pengguna pada Android |
| Dropdown/keyboard/scroll/Back/modal | logika dropdown/adapter PASS | perilaku keyboard/Back/scroll/modal native |
| Reschedule layanan/qty dan identitas/password baru | SDK/adapter/backend PASS | alur UI baru pada perangkat |
| Reset link | parser/form/transport mock PASS | registrasi scheme/build dan membuka tautan pada Android |
| DP + pelunasan Android | mock SDK sampai PAID/invoice, REST refetch, AppState, replay PASS | membuka checkout Android, kembali ke app dan melihat balance/invoice setelah settlement |

Checklist bukti yang belum rinci (gunakan hasil sebelumnya bila tersedia,
**jangan mengulang seluruh tes**):

1. Cantumkan build/commit, model Android, tanggal dan kelompok skenario yang
   sudah lulus; jangan mencantumkan serial, password, token atau data customer.
2. Lengkapi hanya perilaku native yang belum terbukti: cold start/SecureStore,
   logout, keyboard/dropdown/scroll/Back/modal, serta realtime lintas perangkat.
3. Verifikasi UI baru: edit item jadwal ulang, konfirmasi ulang, perubahan akun
   dengan password dan login ulang, serta tautan reset pada build yang mendukung.
4. Untuk checkout, gunakan bukti/fixture sah yang ada. Catat ID dummy, DP,
   settlement, status setelah kembali, pelunasan sesudah COMPLETED, balance nol,
   satu kredit dan satu invoice. Jangan membayar ulang transaksi Rp12.500.
   Jika benar-benar perlu fixture/transaksi Sandbox baru, minta otorisasi dahulu.

Webhook nyata Pending/Settlement pukul 13.20 WIB adalah bukti pengguna.
Tidak mengulang diagnosis ngrok/redelivery. Transaksi Rp12.500 tetap dilindungi;
snapshot existing before/after identik. Tidak membuat pembayaran/refund untuknya.
Laptop/tunnel tetap tidak menjamin uptime Production.

## Refund historis Rp2.000

GET Status resmi Sandbox pada `2026-10-15T06:57:38.429Z`: order
`BBF7-DP-157-a9a8c1a770be4a92`, transaction ID
`10cb3319-9196-463d-8484-715d01485c9f`, charge IDR 5.000, metode QRIS,
merchant cocok, **settlement**, nol entri refunds dan nol `F7-REFUND-48`.
Database sekarang tidak memiliki transaksi/request/booking asal terkait.
Sebelas manifest/snapshot privat historis diperiksa read-only, tanpa menemukan
referensi tersebut. Riwayat approval/retry individual tidak dapat direkonstruksi
dari bukti yang tersedia; laporan historis mencatat approval dan respons 202 /
PROCESSING, bukan bukti dana kembali.

Dengan bukti ini A (refund final terlewat) belum terbukti; B/C/D (pending/gagal/
belum pernah diajukan) tidak bisa dibedakan secara sah. E (metode tidak didukung)
juga tidak dapat dipastikan dari QRIS saja. F memerlukan tindakan merchant:
minta status permohonan spesifik beserta referensi, nominal dan alasan respons
202/capability dari dashboard/support Midtrans. Dokumentasi resmi mencakup
QRIS, tetapi capability merchant/jenis transaksi tetap perlu diperiksa.
[Refund API](https://docs.midtrans.com/reference/refund-transaction).

Tidak mengirim refund/retry, merekonstruksi ledger atau menambah debit refund.
Jika kelak ada bukti final, rencana pemulihan relasi historis dan otorisasi ADMIN
harus diverifikasi sebelum rekonsiliasi idempotent. Jangan membuat refund
pengganti atau key baru semata-mata untuk menutup laporan.

## Security advisory aktual

`npm audit`, `npm audit --omit=dev`, graph terpasang dan lockfile diperiksa.
Keduanya menghasilkan jumlah sama pada tiap workspace:

| Workspace | Critical | High | Moderate |
|---|---:|---:|---:|
| Backend | 0 | 4 | 0 |
| Web | 0 | 0 | 2 |
| Staff | 0 | 15 | 7 |
| Customer | 0 | 16 | 7 |

Angka adalah paket rentan/propagasi dependency, bukan jumlah exploit unik:
51 entri paket dari empat workspace berasal dari delapan advisory unik.
Paket langsung/transitive, versi node, flag dev lockfile, affected range dan
saran npm tersimpan di JSON. Kategori tooling di bawah adalah analisis jalur
pemakaian, **bukan** alasan menghapus temuan omit-dev atau menyebut audit bersih.

| Advisory / paket terpasang | Jalur dan pemakaian | Perbaikan tersedia / risiko dan tindakan |
|---|---|---|
| [ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), High; deepmerge-ts 7.1.5 | prisma 7.10.0 → @prisma/config 7.10.0 → deepmerge-ts; Prisma CLI/config; tetap muncul omit-dev | Fixed 8.0.0, registry 8.0.2. Parent mem-pin tepat 7.1.5: override major perlu izin dan tes config/generate/build. Source API tidak meneruskan graph JS cyclic ke deepmerge; JSON biasa tidak membentuk cycle. Paparan langsung HTTP belum terbukti. |
| [3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), High; mysql2 3.15.3 | prisma → mysql2, pin tepat 3.15.3; aplikasi memakai PostgreSQL/adapter-pg | Fixed auth downgrade 3.22.0; registry 3.24.6. Evaluasi override terarah dengan izin, tanpa downgrade Prisma. Jangan mengaktifkan koneksi MySQL tak tepercaya. |
| [rgwj-5xj2-c3m3](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3), Moderate; mysql2 | Jalur sama; risiko decompression bomb bila client compression dan server berbahaya | Advisory resmi yang dibaca belum mencatat patched version; range audit <=3.23.0. Registry 3.24.6 di luar range tetapi tetap perlu uji/audit ulang. Tidak mengklaim semua risiko tertutup hanya dari nomor versi. |
| [wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), Moderate; react-router 6.30.6 | react-router-dom 6.30.6 → react-router; langsung runtime Web | Fixed >=7.18.0, target 7.18.4. Upgrade major perlu izin + regresi route/RBAC. Rute/login yang diperiksa menggunakan path internal, bukan URL redirect dari pengguna. |
| [337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg), Moderate; react-router | Jalur sama, SSR deserialize; aplikasi CSR createRoot/BrowserRouter | Target sama. Tidak ditemukan SSR hydration pada source yang diperiksa; bukan jaminan aman untuk penambahan SSR kelak. |
| [vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), High; braces 3.0.3 | Expo → @expo/metro → metro-file-map → micromatch → braces; build/dev tooling di kedua mobile | Tidak ada patched release pada advisory/registry yang diperiksa. Batasi Metro ke jaringan tepercaya, jangan expose tooling lewat ngrok, jangan menerima pola glob tak tepercaya; tunggu upstream atau patch terverifikasi yang diotorisasi. |
| [86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), High; node-forge 1.4.0 | Expo → @expo/cli → certificates/node-forge; tooling sertifikat/signing | Belum ada patched release. Hindari kunci/sertifikat/metadata signing tak tepercaya; perlu upstream/patch terverifikasi sebelum menutup risiko signing. Tidak dipakai untuk bcrypt/JWT customer dari source yang diperiksa. |
| [w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), Moderate; uuid 7.0.3 | Expo → config-plugins → xcode 3.0.1 → uuid ^7.0.3; tooling project native | Fixed >=11.1.1; mengganti major di luar range xcode perlu izin/tes generator native. Jangan memakai npm downgrade Expo sebagai jalan pintas. |

Tidak menjalankan install/update/audit fix/force. Saran otomatis downgrade
Prisma ke 6.19.3, Expo ke 44 atau RN ke 0.72 ditolak sebagai rencana, tidak
dieksekusi. Tidak ada patch kompatibel dalam range pin lama untuk menghapus
semua temuan. Mitigasi source yang dikerjakan meliputi autentikasi ulang profil,
rate limit, transaksi atomik, pencabutan sesi/token, URL allowlist dan log aman.
Security advisory tetap **OPEN**, bukan nol risiko.

## PRD dan integritas

Master PRD v2.0 lengkap tidak ditemukan pada inventaris workspace. Aturan tegas
dalam permintaan terbaru dipakai sebagai otoritas: email/phone login terpisah
dari operator, reset 30 menit/single-use, password untuk identitas sensitif,
reschedule items/qty dengan konfirmasi ulang, seluruh uang authoritative server.
Gap identitas/password dan edit item reschedule sudah ditangani. Aturan tambahan
verifikasi kepemilikan email/telepon, kebijakan dependency/hosting dan persyaratan
produk yang tidak tercantum tidak dikarang; kesesuaian PRD penuh belum ditutup.

Backup database sebelum pekerjaan:
`e2e-2026-10-15T06-51-45-841Z`, 129.403 byte, SHA-256
`fffbef87b1464ffe3838d3674ebd901dcdb92214f840e7874bdd5a437a4feb42`.
Arsip dibaca/dekompresi tanpa restore; snapshot 22 model diverifikasi. Semua
fixture memakai database kosong terpisah yang dibuat dari schema arsip,
tanpa menyalin data asli. Audit akhir database aplikasi identik dengan snapshot;
orphan booking/ledger/invoice/refund, invoice duplikat dan hash permohonan final
masing-masing nol. File historis beserta Prisma index tetap sama.
Setelah semua tes selesai, seluruh tabel database fixture diverifikasi kosong
dan hanya database uji milik tugas tersebut dihapus tanpa force.
Build teruji juga dimuat pada satu backend lokal setelah identitas proses dan
nol pembayaran pending diperiksa. GET readiness dan forgot-password untuk
alamat dummy tidak terdaftar membuktikan transport nyata tetap nonaktif.
Proxy/ngrok tidak diubah atau diuji ulang melalui notifikasi provider.

## Git dan file

Daftar lengkap perubahan pada [BERKAS.json](final-acceptance/BERKAS.json).
Utamanya service/schema/controller customer, service/template email baru,
test akun/reset/regresi, editor booking Web dan tes browser; Customer App,
config scheme, API/profil/reset/reschedule dan tes adapter. README/panduan
diperbarui. Tidak ada perubahan source Staff atau package/lockfile.
File sample environment aman diperbolehkan oleh pemindai rilis; environment
nyata tetap dilarang. Hash commit/push aktual dicatat setelah pemeriksaan akhir.
Pemindaian perubahan terhadap credential proses dan data pribadi pada snapshot
menemukan nol kecocokan; file environment asli yang dilacak Git nol. Ini bukan
jaminan menyeluruh seluruh riwayat/dependency. Lihat
[KEAMANAN.json](final-acceptance/KEAMANAN.json).

## Satu daftar tindakan/keputusan yang masih membutuhkan pemilik

1. **Email** — pilih SMTP yang dimiliki atau provider HTTP. SMTP usulan:
   `npm.cmd install nodemailer@10.1.1` di server, types sudah disertakan; perlu
   persetujuan satu dependency. Alternatif HTTP dapat memakai fetch tanpa paket
   tetapi tetap perlu pilihan akun/provider. Setelah dipilih, konfigurasi secret
   manual di .env, sender/domain serta alamat inbox uji yang Anda kontrol.
   Template, kontrak/mock, token dan UI sudah siap; delivery nyata belum aktif.
2. **Dependency** — setujui evaluasi terpisah Web `react-router-dom@7.18.4`,
   scoped override backend `prisma → mysql2@3.24.6`,
   `@prisma/config → deepmerge-ts@8.0.2`, dan mobile
   `xcode → uuid@11.1.1`. Pin/range parent dilampaui, dua transitive major:
   kompatibilitas belum dijanjikan. Tidak upgrade major Expo/RN/React/Prisma.
   Braces/node-forge belum memiliki release aman: pilih menunggu upstream/
   patch terverifikasi atau menerima risiko sementara untuk review lokal saja.
   Setiap perubahan wajib audit/build/regresi ulang, tanpa force.
3. **Refund** — berikan hanya hasil status merchant/support untuk order/refund
   key historis (tanpa key/token/data pribadi): apakah pending, gagal, final,
   atau perlu aktivasi/tindakan merchant. Jangan memberi otorisasi retry umum
   sebelum status jelas; tidak ada retry yang dijalankan pada pekerjaan ini.
4. **Android/checkout** — rinci hasil sebelumnya atau sambungkan perangkat/build
   yang sesuai untuk celah checklist di atas. Tidak perlu mengulang hasil yang
   sudah memiliki bukti; tidak meminta pembayaran baru tanpa kebutuhan/izin.
5. **PRD/release** — sediakan lokasi Master PRD v2.0 untuk pemeriksaan lengkap,
   tentukan persyaratan verifikasi identitas tambahan bila ada, serta strategi
   runtime/hosting stabil sebelum Production. Ini bukan izin otomatis membuat
   layanan berbayar/deploy/merge.
