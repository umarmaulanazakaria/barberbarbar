# Audit pengujian end-to-end dan integrasi

Tanggal: 15 Oktober 2026 WIB. **F13 PARSIAL**. Regresi otomatis akhir lulus
25/25 tugas; browser Web nyata lulus 10 checkpoint, ditambah cleanup. Kedua
aplikasi mobile lulus TypeScript, Expo dependency check, Android export dan
integrasi SDK/API. Hasil ini belum memenuhi acceptance perangkat dan provider.
Android fisik/AVD tidak tersedia; pengguna menetapkan device E2E DEFERRED.
Checkout Sandbox dari Customer App, refund historis Rp2.000, pengiriman email,
gap produk dan advisory dependency tetap terbuka. Tidak Production-ready.

## Baseline dan lingkungan

Ketiga repository menggunakan branch `feature/project5-integration` dan awalnya
sinkron dengan upstream (0/0). Baseline:

| Repository | HEAD sebelum audit |
|---|---|
| barberbarbar / Project 3 | 35f99717d61fbf330573245ff55a8e3110d771ac |
| barberbarbar-mobile / Project 4 | ae639155cd24629358b95fae2deb8418efbb11bb |
| barberbarbar-customer / Project 5 | eac87ad2af6dadb0ab5456a7da9510f874bb6b1f |

Audit mengikuti prompt dan source/laporan F2–F12. Master PRD v2.0 lengkap tidak
ditemukan. Persyaratan yang berbeda dari API existing dicatat sebagai gap,
bukan diasumsikan selesai. Windows/PowerShell, Node 24.19.0, npm 11.17.0,
PostgreSQL 18, Prisma 7.10.0, Edge headless 155.0.4283.45. Chrome/Edge sudah
terpasang; inventori CUA kosong dan in-app browser tidak tersedia. Playwright
1.64.1 dipasang dengan persetujuan, tanpa mengunduh browser. ADB tersedia tetapi
daftar perangkat dan AVD kosong. IP Wi-Fi lokal 192.168.1.9 terverifikasi.
ngrok tersedia; tidak membuka tunnel baru karena checkout perangkat ditunda.
Nilai environment rahasia tidak dicetak atau disalin ke laporan/ZIP.

## Matriks dan batas bukti

[Matriks lengkap](server/e2e/MATRIKS-E2E.md) dan
[JSON](server/e2e/MATRIKS-E2E.json) memuat 268 baris: 265 butir skenario/instruksi
prompt bagian 7–17 dan tiga regresi bug. Hasil: **206 PASS, 54 DEFERRED,
8 NOT APPLICABLE, 0 FAIL pada hasil akhir**. N/A adalah instruksi pelaksanaan,
bukan fitur yang dianggap lulus. Jumlah ini bukan jumlah test assertion unik.
PASS hanya berlaku pada jenis bukti yang tercantum; baris API tidak membuktikan
layar Android. Kegagalan awal dan timeout intermittent tetap dicatat di bawah.

| Jenis | Bukti dan batasnya |
|---|---|
| A unit/source | Middleware log dan audit source; tidak membuktikan deployment |
| B integration/adapter | Module SDK/API aktual, React rendering; SecureStore/AppState/native host diadaptasi |
| C HTTP/API E2E | HTTP Express, PostgreSQL dan transaksi nyata dengan fixture dummy |
| D browser UI | Form/tombol Web aktual di Edge headless; provider MOCK |
| E Android UI | DEFERRED; export Hermes bukan instalasi atau gesture perangkat |
| F provider Sandbox E2E | Get Status refund read-only aktual; checkout Customer App DEFERRED |
| G security/concurrency | Request bersamaan, RBAC, signature, rollback, deadline dan ledger |

## Hasil regresi aktual

[HASIL-REGRESI.json](server/e2e/HASIL-REGRESI.json) menyimpan exit, output hash,
bukti aman, durasi dan kesamaan snapshot tiap tugas. Runner serial; suite yang
menyentuh DB tidak dijalankan bersamaan. Setelah perbaikan log dilakukan build
ulang, TypeScript dan regresi auth/reset/public serta log; suite lainnya berasal
dari run penuh final sesudah patch dependency. Ini bukan klaim semua 25 tugas
dijalankan ulang sekaligus setelah perubahan middleware.

| Area | Status | Bukti aktual |
|---|---|---|
| Backend TypeScript noEmit/noUnused dan build | PASS | tsc exit 0 |
| Prisma validate/status | PASS | Schema valid, 18 migration up-to-date; tidak menerapkan migration |
| Auth foundation | PASS | Race register/pengaitan/dua ADMIN, conflict umum, own-profile, blocked, JWT role/fingerprint, limiter; operator tetap valid |
| Reset password | PASS | 11 kelompok; umum/tidak bocor token, expiry/once/race, old password/JWT ditolak, operator tidak berubah |
| API publik | PASS | 4 kelompok; tanpa JWT, aktif saja, whitelist, operator tetap terlindungi |
| Membership | PASS | 12 kelompok; empat status, ADMIN-only, default request 10%, diskon operator existing tetap |
| Booking | PASS | 15 kelompok; WIB/jam/horizon/overlap/capacity/race/snapshot dan kasir legacy |
| Batas reschedule/hari | PASS | 3 boundary dan 7 hari WIB lewat HTTP; HASIL-RESCHEDULE.json |
| Operasional foundation | PASS | 11 kelompok; DP gate dan consent. Pesan historis suite menyebut menunggu F6; DP sah/lifecycle kini diuji suite payment/realtime/browser |
| Ledger/kasir/invoice | PASS | 8 kelompok; source DB, concurrency, pembayaran ulang, invoice rollback/atomicity |
| Midtrans adapter | PASS MOCK | 12 kelompok dipanggil suite realtime; pending/deny/cancel/failure/expire/settlement, signature, mismatch, replay, refund202/failure/retry |
| Scheduler | PASS | 26 kelompok; runtime worker, timeout/no-show/overdue, restart/race, DB clock dan kill-switch |
| Socket.IO | PASS | 23 kelompok; JWT/rooms/isolation/postcommit/rollback, reconnect/refetch/fallback, lifecycle/provider/scheduler |
| Web | PASS | Build dan 9 kelompok integration, ditambah browser nyata di bawah |
| Staff Mobile | PASS terbatas | TS, Expo check, Android export 989 modules, 10 kelompok API/SDK; bukan UI perangkat |
| Customer Mobile | PASS terbatas | TS, Expo check, Android export 1072 modules, 14 kelompok API/SDK, 11 dropdown, detail penolakan |
| Log sensitif middleware | PASS | Dua sentinel sintetis, tidak masuk log; respons 400/500 tetap |
| Integritas/cleanup | PASS | 22 model identik, orphan/duplikasi/hash final nol |
| Android UI dan checkout Customer Sandbox | DEFERRED | Tidak ada perangkat/AVD; panduan terperinci di README |

Kasir walk-in Project 3 dan kontrak layanan Project 4 diuji oleh suite booking,
payment, Web dan Staff; tidak ada perubahan kontrak operator maupun schema.
Warning yang tersisa: ukuran chunk Web sekitar 601 KB dan pg concurrent-query
deprecation dari suite existing; tidak disembunyikan sebagai hasil performa.

## Browser dan integrasi ketiga project

[Harness browser](client/scripts/test-e2e-browser.mjs) memakai form login ADMIN
dan STAFF, bukan menyisipkan token ke localStorage. Backend HTTP/Socket dan
Vite hidup hanya selama suite. SDK aktual Customer/Staff serta React Query
observer menerima sinyal/refetch. Gerbang provider MOCK dalam proses.

[HASIL-BROWSER.json](server/e2e/HASIL-BROWSER.json): login/dashboard; Customer
membership → ADMIN Web approve → ACTIVE; booking multiservice/qty/barber null
→ daftar Web/Staff SDK → confirm → Customer CONFIRMED; DP MOCK sah → check-in
awal → barber final → Pesanan IN_SERVICE; perubahan item/qty; Staff SDK complete
→ kasir Web → PAID/balance 0/satu invoice final; reject wajib alasan; ADMIN
refund202 PROCESSING dan STAFF ditolak; viewport 390px tanpa overflow pada
fixture daftar; logout dan tanpa pageerror. Sepuluh checkpoint dan cleanup PASS.
Ini menutup bukti browser yang sebelumnya DEFERRED, bukan UI Mobile.

**Observasi stabilitas:** run pertama PASS; satu run targeted timeout saat
konfirmasi booking setelah WEB-BOOKING (3 checkpoint sudah PASS), cleanup tetap
identik; retry langsung dan run penuh final PASS. Tidak ada fix source UI yang
membuktikan penyebab timeout. Hanya diagnostik tahap yang ditambahkan.
OPEN-10 tetap terbuka untuk soak/investigasi dialog/race; hasil retry bukan
bukti bahwa intermittent sudah sembuh. Tidak menyimpan trace auth/HAR/PII.

## Scheduler dan realtime

Suite scheduler menguji worker runtime/start-stop, deadline persisted/restart,
DB clock, race payment/deadline, no-show dan overdue; bukan hanya preview helper
dengan scheduler mati. Booking CHECKED_IN tidak diproses sebagai no-show.
Pembatalan sistem dengan DP sah menghasilkan permohonan refund 100% untuk
ADMIN; tidak mengirim refund otomatis; NO_SHOW mengikuti DP hangus.
Consent proposal tidak memiliki deadline source; uji dedicated tanpa timeout
proposal tetap DEFERRED. Suite browser sengaja tidak menyalakan worker global.

Realtime menguji JWT CUSTOMER/operator terpisah, room customer sendiri, STAFF
tanpa keputusan ADMIN, expired token/koneksi aktif, commit versus rollback,
duplicate/out-of-order signals, reconnect dan REST fallback. Mobile AppState
dan SecureStore diadapter; foreground native/latar belakang/OS restart belum
dibuktikan. PostgreSQL NOTIFY tidak menyediakan durable replay; REST tetap
sumber data dan operasional multi-instance/latency perlu validasi lanjut.

## Midtrans dan refund historis

Credential Sandbox terdeteksi hanya sebagai boolean; `MIDTRANS_IS_PRODUCTION`
harus `false`. Tidak ada transaksi/refund/retry provider baru pada audit ini.
Pengujian pembayaran adapter/browser menggunakan MOCK dan tidak dihitung
sebagai checkout Sandbox Customer App. Bukti pembayaran DP/pelunasan F7 dahulu
tetap historis, tidak menggantikan acceptance aplikasi native sekarang.

[Get Status read-only](server/e2e/HASIL-PROVIDER.json) berhasil pada
2026-10-14T18:55:29.873Z (15 Oktober WIB), dengan identity/nominal/currency/
merchant dan signature valid:

- order_id: `BBF7-DP-157-a9a8c1a770be4a92`
- transaction_id: `10cb3319-9196-463d-8484-715d01485c9f`
- transaksi asal Rp5.000, QRIS, HTTP/status_code 200, `settlement`
- target refund Rp2.000, refund_key `F7-REFUND-48`; **0 entri refund cocok**,
  tidak ada bank confirmation.

Transaksi/refund sumber tidak ada di DB lokal karena fixture sesi lama sudah
dibersihkan. Status PROCESSING adalah catatan historis, bukan status row lokal
saat ini. Tidak merekonstruksi row atau menambah refund ledger. **Status final
refund DEFERRED**, bukan berhasil/gagal. Settlement transaksi asal tidak cukup
untuk menyimpulkan refund final, pending callback, unsupported, atau aman retry.
Merchant perlu memeriksa dashboard Sandbox dan meminta bukti provider/acquirer
berdasarkan ID di atas. Jangan Retry Refund selama status ambigu. Referensi
resmi: [Midtrans Get Status](https://docs.midtrans.com/reference/get-transaction-status).

## Auth, email dan gap produk

Reset token hash SHA256, 30 menit, satu kali, transaksi/race dan pencabutan JWT
lama lulus. Endpoint forgot-password hanya fondasi dengan respons umum;
**belum dapat digunakan customer sungguhan untuk menerima tautan** karena belum
ada pengiriman email/WhatsApp. Simulasi token tetap developer-only/dummy.
Keputusan teknis berikutnya: pilih provider transactional email, approved
dependency/config lokal, sender/domain, template link allowlist, TTL, retry dan
observability tanpa token, lalu uji inbox serta alur deep link. Tidak mengarang
credential/SMTP atau memasang provider tanpa persetujuan.

PATCH profil existing membatasi nama/alamat. API change-password menggunakan
current password dan perubahan email/telepon dengan verifikasi belum tersedia.
Reset-token tidak disamakan dengan fitur ini. Perlu PRD/keputusan keamanan
(unique normalization, verification, account-link conflict dan revoke sesi).
UI reschedule Customer hanya jadwal/barber; backend menerima item tetapi UI
edit layanan/qty belum ada. Dedicated reschedule total naik belum dibuktikan;
total turun/refund difference provider MOCK diuji. Gap ini tidak ditutup
dengan refactor fitur baru yang tidak memiliki PRD lengkap.

## Perbaikan kecil yang terbukti

| ID | Sebelum | Perubahan | Sesudah |
|---|---|---|---|
| BUG-01 | Reschedule dengan sisa 3599999 ms atau sudah lewat menerima 200 | Guard <1 jam dari jadwal lama memakai clock DB dalam transaksi; izin UI selaras | 409/200/409 untuk <1 jam/tepat 1 jam/lewat; 7 hari WIB PASS |
| BUG-02 | DTO/UI detail Customer tidak menampilkan alasan reject yang ada di backend | Tambah field alasanPenolakan dan alert detail | Tes komponen aktual gagal sebelum fix, PASS sesudah dengan host adapter |
| BUG-03 | console.error(error) mencetak body JSON/SDK error yang berpotensi membawa credential | Kategori tetap dan kode Prisma whitelist, tanpa message/stack/body/config mentah | Dua sentinel gagal sebelum fix, PASS sesudah; status/respons tidak berubah |

Perubahan test Midtrans menambah assertion deny/cancel/failure tanpa kredit
ledger; group count tetap kompatibel dengan harness existing. Tidak mengubah
autentikasi ADMIN/STAFF, alur kasir, schema atau endpoint operator.

## Dependency dan keamanan

Persetujuan user: Playwright dev Web, Expo Staff 57.0.28 → 57.0.29, backend
`npm.cmd update brace-expansion fast-uri`, Web `npm.cmd update source-map-js`.
Versi hasil: brace-expansion 5.0.12, fast-uri 3.1.8 (tetap major 3),
source-map-js 1.2.2. Tanpa force, override, upgrade major atau browser download.

[Audit npm lengkap dan omit-dev](server/e2e/HASIL-DEPENDENCY.json):

| Target | Critical | High | Moderate | Total lengkap / omit-dev |
|---|---:|---:|---:|---:|
| Backend | 0 | 4 | 0 | 4 / 4 |
| Web | 0 | 0 | 2 | 2 / 2 |
| Staff | 0 | 15 | 7 | 22 / 22 |
| Customer | 0 | 16 | 7 | 23 / 23 |

Angka adalah snapshot metadata advisory sekarang, bukan bukti semua temuan
terjangkau runtime. Sebelum patch kompatibel audit sesi ini backend 6 (5 high,
1 moderate), Web 3 (1 high,2 moderate). Perbandingan laporan F12 lama tidak
boleh dianggap seluruhnya hasil patch karena metadata/rantai advisory berubah.

Backend deepmerge-ts/mysql2 berasal dari Prisma; app menggunakan PostgreSQL,
tidak membuktikan eksploitasi langsung. Web React Router6 moderate memiliki
konteks redirect/SSR; app CSR BrowserRouter, tidak menjalankan SSR hydrate
deserialize, tetapi ini bukan jaminan bebas risiko. Expo/Metro tooling
braces/node-forge/uuid berada dalam dependencies produksi menurut npm; omit-dev
tidak membuktikan semuanya masuk jalur native. Reachability runtime/build perlu
triage. Saran npm yang downgrade Prisma6/Expo44 atau pindah Router7 ditunda
sebagai perubahan breaking, bukan dipasang otomatis. High advisory tetap
risiko penting yang membuat audit tidak layak disebut bersih/Production-ready.

RBAC/IDOR/JWT/limiter, konflik unik/race, payload injection, pembayaran source DB,
signature/mismatch/replay/out-of-order/rollback, dan isolasi room dibuktikan
suite. Perbaikan middleware menutup sumber log mentah yang direproduksi, bukan
klaim audit menyeluruh setiap library atau seluruh lingkungan deployment.

## Database, backup dan perlindungan Git

Backup baru sebelum mutasi fixture:
`Stage 2/backup-database/e2e-2026-10-14T18-53-02-126Z/database.dump`
(125893 byte). Arsip custom lulus pg_restore --list dan full decode ke output
yang dibuang. Tidak dilakukan restore trial. Snapshot sensitif disimpan di
folder yang sama di luar Git/ZIP. Setelah seluruh tes backup diverifikasi lagi.

[HASIL-INTEGRITAS.json](server/e2e/HASIL-INTEGRITAS.json): 22 model domain
sebelum/sesudah identik; snapshot SHA256
`0596ef7408cc05fc119ad7a1f798c51a36e245600e0c96094f61faecb8a460a8`.
Orphan booking/customer, ledger/booking, invoice/booking, refund/source,
invoice duplikat dan hash pada permohonan final semuanya nol. Cleanup hanya
fixture UUID suite. Sequences dapat maju karena fixture; tidak direset dan
tidak mengklaim seluruh byte database identik. Tidak ada migration/reset.

File historis Prisma tetap staged dengan blob index
`6594970f6d44cfae4ac899cd83f14f6991dce0a0`, SHA256 working file
`d524d6701a23a32c66c42711102af799cad1d2425b13f47d85d81d987bc1672a`.
LayarTambahPelanggan Staff tetap SHA256
`522ad8a3a03bd429b240519f2898bd4a45b88434eb941ab7904b3ae341cda941`.
Format lokal Staff `src/layanan/booking.ts` tetap SHA256
`d6b8c45c859e05d32077819bc54631767a7d5a8c0f449af290f649b9784e12ea`.
Ketiganya tidak masuk commit atau ZIP hasil audit.

## File, commit, push dan cadangan

Perubahan source: backend operasional-booking.service.ts dan error.middleware.ts;
Customer aturan.ts, tipe.ts dan DetailBooking.tsx. Dependency/lock Web/backend
dan Staff berubah hanya sesuai persetujuan. Penambahan test/script: browser
lintas SDK, boundary reschedule, log, detail Customer, runner serial, backup,
provider/dependency/integrity audit, generator matriks dan ZIP. Package test
Customer memasukkan regresi detail. Dokumentasi utama ini, README-PENGUJIAN,
TEMUAN-LANJUTAN, JSON bukti/matriks serta referensi silang Staff/Customer.
Daftar path lengkap tersedia pada `server/e2e/BERKAS-ZIP.json`.

Commit menggunakan judul Bahasa Indonesia tanpa nomor fase; stage eksplisit.
P3 wajib commit --only path sendiri agar perubahan Prisma yang sudah staged
tidak ikut. P4 mengecualikan format lokal booking.ts. Push hanya ke
origin/feature/project5-integration; tidak force, tidak merge main. Hash final
dan hasil upstream dilaporkan setelah commit agar dokumen tidak memiliki
referensi hash dirinya sendiri yang mustahil tetap konsisten.

ZIP `Stage 2/BARBERBARBAR-F13-E2E.zip` adalah cadangan file audit/perubahan ini
dengan struktur tiga repo. Manifest sumber ada di dalamnya; manifest luar
mencatat hash setiap entry, hash ZIP dan HEAD ketiga repo setelah push. Script
membaca ulang seluruh entry dan membandingkan SHA256 dengan source final.
Tidak menyertakan env, credential/JWT/Snap token, PII, dump/snapshot, node_modules,
.git atau tiga file lokal yang dilindungi. ZIP tidak menggantikan perubahan
working tree/commit dan tidak diklaim backup seluruh source repository.

## Blocker, acceptance dan pekerjaan berikutnya

Rincian tindakan: [TEMUAN-LANJUTAN.md](TEMUAN-LANJUTAN.md).
Panduan perangkat dan provider: [README-PENGUJIAN.md](README-PENGUJIAN.md).

Untuk menutup acceptance: sediakan HP Android/Expo Go sesuai SDK dan jalankan
UI kedua app serta native storage/restart/keyboard/navigation; checkout DP dan
pelunasan Sandbox dari Customer App dengan webhook terverifikasi; dapatkan
bukti refund final provider tanpa retry ambigu; pilih provider email dan uji
delivery; sediakan PRD/keputusan perubahan identitas/password/reschedule item;
triage advisory breaking dan timeout browser intermittent. Tidak meminta
instalasi tambahan atau perubahan credential/database secara diam-diam.

**Acceptance tetap F13 PARSIAL.** Nol FAIL pada regresi akhir tidak menghapus
54 DEFERRED, gap produk, high advisory, atau timeout intermittent. Persiapan
F14 dapat memakai laporan ini, tetapi rilis/Production belum direkomendasikan.
