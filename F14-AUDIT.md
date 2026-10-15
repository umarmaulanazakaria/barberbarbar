# Finalisasi, stabilisasi dan kesiapan review

15 Oktober 2026 WIB. **F14 PARSIAL — READY FOR REVIEW bersyarat, belum READY FOR
RELEASE/PRODUCTION.** Perbaikan source dan pengujian lingkungan lokal selesai;
acceptance Android/provider/email dan keputusan requirement masih terbuka.
READY FOR REVIEW berarti paket source/dokumentasi dapat dinilai reviewer,
bukan izin merge, distribusi atau deployment. PR Customer masih membutuhkan
base branch yang ditetapkan pemilik. Tidak merge ke main.

## Baseline aktual dan proteksi

| Repository | HEAD awal finalisasi | Branch | Upstream awal |
|---|---|---|---|
| Project 3 | 5e40b1e620ff7fbae86a18a302d9cb5a9a6b918a | feature/project5-integration | 0/0 |
| Staff | 9f8f2d0d74e4eb9e270c7ae4937b1b8900828497 | feature/project5-integration | 0/0 |
| Customer | b3a7575fc36efa833cdf89dc1f07f958f7490579 | feature/project5-integration | 0/0 |

Prisma lokal sejak awal staged; format lokal Staff booking.ts unstaged.
Keduanya dipertahankan. LayarTambahPelanggan.tsx tidak disentuh. SHA256 dan blob
index diverifikasi lagi, bukan diasumsikan dari F13. Baseline aman disimpan
pada `server/finalization/BASELINE.json`. Master PRD v2.0 tidak ditemukan;
audit menggunakan source, prompt, F13-AUDIT/README-PENGUJIAN dan laporan relevan
F2–F12. Gap produk tidak diisi dengan fitur baru tanpa requirement yang jelas.

Node24.19.0/npm11.17.0, PostgreSQL18, Prisma7.10.0, Edge headless existing.
Versi aktual node_modules terdapat pada HASIL-DEPENDENCY.json, bukan sekadar
range package.json: Web React19.3.0/Router6.30.6/Vite7.3.6/TS5.9.3; Mobile
React19.2.3/RN0.86.3/Expo57.0.29/TS6.0.3; backend Express5.2.1/TS7.0.2/
adapter-pg7.10.0/pg8.23.0; Socket4.8.4, Midtrans1.4.3, React Query5.102.8,
Axios1.20.0, SecureStore57.0.4 dan Customer WebBrowser57.0.3.
Customer package range ~57.0.28 memang telah terpasang57.0.29 pada baseline;
tidak ada instalasi/update F14. Patch dependency F13 dipertahankan.

ADB ada di Android SDK tetapi tidak di PATH shell ini. Pemeriksaan dengan
path absolut menghasilkan nol device dan nol AVD; tanpa Android UI atau Expo
Go yang dapat diverifikasi. Sandbox konfigurasi existing hanya diperiksa
sebagai boolean dan mode false; tidak mencetak nilai key. Tidak membuka tunnel
baru atau menjalankan transaksi/refund provider baru.

## Perbaikan yang direproduksi

| ID / prioritas | Dampak sebelum perbaikan | Perubahan source | Bukti sesudah |
|---|---|---|---|
| BUG-04 / P1 ditutup | Refetch detail menimpa barber draf jadwal ulang, berisiko mengajukan pilihan yang berbeda | Inisialisasi draf Customer hanya sekali perID, dan memuat ulang untuk route baru | Komponen aktual: 11 menggantikan22 sebelum fix; sesudah22/null bertahan dan route2 memuat33 |
| BUG-05 / P2 ditutup | Dialog Web tidak memiliki nama/role, fokus/Tab dan Escape; navigasi keyboard tidak terkendali | role dialog/aria-modal, judul/deskripsi, fokus cancel, trap Tab, Escape ketika tidak loading, restore fokus | Browser role gagal sebelum fix; WEB-DIALOG PASS, Escape tidak memutasi booking |
| BUG-06 / P1 ditutup | Fatal rejection/exception/disconnect mencetak error mentah berpotensi membawa header/body/secret | Entrypoint hanya mencetak kategori tetap; shutdown/exit tetap | Tiga sentinel bocor sebelum fix; sesudah aman, exit1 dan listener tertutup |
| STAB-01 / P2 ditangani | Refetch menonaktifkan tombol di antara actionability check dan pointerdown; tidak ada click/dialog, edit juga dapat hilang | Harness menunggu HTTP dan busy Web, mengulang hanya opener/edit draf UI lokal sampai hasil terlihat | Delapan run akhir berturut-turut PASS; submit mutasi/provider tetap sekali |

Tidak mengubah desain yang disetujui, PilihanBerpencarian, navigasi mobile,
model database, autentikasi ADMIN/STAFF, harga/API atau kontrak kasir. Staff
tidak memperoleh perubahan kosmetik tanpa bukti masalah. Cleanup dibatasi
error handling dan test/dokumentasi; tidak menghapus asset/dependency/dead code
berdasarkan dugaan. TypeScript noUnused memeriksa import/parameter backend;
bukan klaim semua dynamic asset/dependency pasti diperlukan atau tak diperlukan.

## Timeout browser: diagnosis dan batas hasil

Baseline diagnostik24 run:21 PASS/3 FAIL dengan cleanup utuh. Tiga kegagalan
mencakup dialog tidak muncul dan tombol simpan layanan tetap disabled. Jejak
pointer sebelum fix (`browser-pointer-5`, dan `browser-sesudah-4/5`) membuktikan
pointerdown/up mengenai tombol yang saat itu disabled dan tidak menghasilkan
click. Pada kasus edit, nilai kembali2 dengan editfalse setelah upaya isi3.
Label lama yang selalu menyebut confirm tidak cukup membedakan lokasi; tahap
dan call-log aman sekarang disimpan. Tidak menyalahkan Midtrans/jaringan tanpa
bukti dan tidak hanya memperbesar timeout.

Menunggu response saja belum cukup: percobaan antara masih6/8 PASS, karena
refetch baru dapat datang sebelum klik berikutnya. Predicate response pertama
juga keliru tanpa prefix proxy /api; itu kesalahan harness yang diperbaiki,
bukan bug endpoint. Lima run sandbox tanpa eskalasi gagal sebelum browser siap;
dicatat sebagai hambatan lingkungan, bukan kegagalan fitur.

Perbaikan final: bukaDialog/ubahQty memeriksa hasil UI dan hanya mengulang
perubahan state lokal, termasuk memilih/menghapus/menambah draf item. Klik
Confirm yang mengirim request tidak dibungkus retry. Confirm menunggu response
HTTP /api, dialog tertutup dan aria-busy false; kemudian assertion SDK/ledger
tetap wajib. Source menambah semantik busy yang berguna bagi aksesibilitas.
Timeout request30 detik tidak dinaikkan; retry UI lokal dibatasi5 detik.

`STABILITAS-stabil.json`: **8/8 PASS**, semua cleanup identik; browser pada
regresi lengkap diuji lagi secara independen. Sebelas checkpoint sekarang
mencakup keyboard dialog selain10 checkpoint F13. Bukti UI Web aktual mencakup
login/dashboard ADMIN/STAFF, approval membership, booking/reject, check-in,
barber final, IN_SERVICE, layanan/qty, complete via Staff SDK, kasir/invoice,
refund202 PROCESSING, RBAC, viewport390px dan logout. Native SDK menggunakan
adapter dan provider MOCK. Sampel8 run bukan jaminan semua latensi/perangkat;
monitor pola refetch/actionability pada QA staging, tanpa lagi menganggapnya
timeout provider atau menambahkan retry ke operasi keuangan.

## Revalidasi matriks dan 54 DEFERRED

[Matriks terbaru](server/finalization/MATRIKS-E2E.md) dan JSON memiliki271 baris:
268 baris F13 dengan riwayat perrow, ditambah tiga regresi produk baru. Hasil
akhir **216 PASS, 46 DEFERRED, 9 NOT APPLICABLE, 0 FAIL** pada status akhir matriks.
Angka ini bukan jumlah assertion unik. Riwayat kegagalan sebelum fix tetap
tersimpan. Matriks F13 asli diberi link revalidasi tanpa mengubah row historis.

[DEFERRED-54.json](server/finalization/DEFERRED-54.json) mencatat seluruh54butir
awal, kategori kebutuhan dan hasil akhirnya. A=lingkungan kini; B=device;
C=Midtrans; D=email; E=bisnis/ADMIN; F=dependency/sistem; G=input eksternal.
Satu butir boleh memiliki beberapa prasyarat. Penutupan lokal:

- Consent pending: setelah2 jam dengan DP sah dan sebelum jadwal, proposal tetap
  PENDING dan booking CONFIRMED. Ini bukan penghapusan deadline DP/no-show normal.
- HTTP reschedule items/qty: total60000→90000 dengan DP50000 cukup diterima;
  kenaikan yang membutuhkan DP lebih besar ditolak409 dan booking/items utuh.
  UI edit layanan/qty reschedule tetap belum tersedia, tidak diklaim lulus UI.
- Lima butir audit dependency menjadi PASS karena versi/rantai/full/omit-dev/
  klasifikasi dan risiko breaking diperiksa. Advisory belum dianggap diperbaiki.
- Instruksi menandai device DEFERRED menjadi N/A, bukan fitur yang lulus.
- Koreksi bukti: exploitability aktual dependency sebelumnya dipetakan ke
  suite realtime; kini DEFERRED karena suite itu tidak membuktikan eksploitasi.

Matriks membedakan unit/source, integration adapter, HTTP/API, browser,
Android, provider Sandbox dan security/concurrency. Build/export/adapter tidak
menutup Android; MOCK tidak menutup provider E2E. Klasifikasi dan catatan ini
mencegah angka PASS dibaca sebagai acceptance Production.

## Regresi, security, scheduler dan realtime

**Hasil agregat final 27/27 PASS, exit0 setiap tugas, snapshot22 identik setelah
setiap suite.** Run komprehensif baru27/27 dilanjutkan empat tugas Customer
setelah penyesuaian edge case draf awal, bukan menyalin hasil25/25 F13. Build
backend dan Web juga lulus. Penyesuaian ini mempertahankan tanggal yang sudah
diisi sebelum data pertama tiba dan mereset draf ketika route berubah. Satu
error narrowing TypeScript pada callback antara terdeteksi lalu diperbaiki
dengan capture const detail; empat tugas tersebut diuji ulang dan riwayat
status FAIL antara tetap ada di HASIL-REGRESI.json.

Runner final mencakup27 tugas dibanding25F13: dua tambahan ialah customer-draft
dan process-log. Bukti exit/status per tugas ada di
[HASIL-REGRESI.json](server/finalization/HASIL-REGRESI.json). Backend build,
Prisma validate dan status18migration juga dijalankan; tidak generate/apply
migration baru. Seluruh suite DB/browser serial; model22 dibandingkan setelah
setiap tugas, file historis dicek sebelum/sesudah runner. Dua tes baru juga
masuk npm test Customer/runner sesuai cakupannya.

| Area | Bukti / batas |
|---|---|
| Auth/RBAC/IDOR/rate limit | Register/link/duaADMIN race, unique conflict umum, blocked, JWT Customer/operator, profile sendiri dan limiter |
| Password/reset | bcrypt, SHA256 token30 menit/once/race, reset mencabut JWT lama tanpa mengubah hash operator |
| Booking/member/kasir | Snapshot10%, WIB/horizon/overlap/capacity/race, kasir walk-in dan kontrak Staff |
| Payment/refund/invoice | Nominal DB, signature/mismatch/replay/out-of-order, transaksi rollback, refund202 tidak debit; provider MOCK |
| Scheduler | 27 kelompok termasuk consent; worker startup/restart/dual-runner, timeout/no-show/overdue dan DB clock |
| Socket | 23 kelompok plus browser lintas SDK: room isolation, expired token, postcommit/rollback, reconnect/REST fallback |
| Web | TypeScript/build, 9 kelompok integration, browser11 checkpoint dan8 run stabil |
| Staff | TypeScript, Expo check, Hermes export, 10 kelompok SDK; UI Android DEFERRED |
| Customer | TypeScript, Expo check, Hermes export, 14 kelompok SDK, 11dropdown, detail dan draf; UI Android DEFERRED |
| Log | Middleware sentinel dan tiga fatal/shutdown entrypoint; tidak mencetak error mentah |

Native SecureStore, keyboard/safe area/tab/back/scroll/OS restart dan foreground
fisik belum diverifikasi. Controller AppState/SDK telah diuji; jangan
menyamakan keduanya. REST/DB tetap otoritas, Socket hanya sinyal. NOTIFY bukan
durable replay; latency/multi-instance deployment masih perlu acceptance.
Warning existing yang tetap dicatat: chunk Web sekitar602KB, anotasi PURE Zod,
dan pg concurrent-query deprecation dari suite. Tidak melakukan upgrade major
atau refactor performa tanpa bukti kebutuhan.

## Dependency terkini dan tindakan

Audit npm full/omit-dev baru tersedia pada
[HASIL-DEPENDENCY.json](server/finalization/HASIL-DEPENDENCY.json). Keduanya
berturut-turut: backend4/4 (4 high), Web2/2 (2 moderate), Staff22/22
(15 high/7 moderate), Customer23/23 (16 high/7 moderate); seluruhnya0 critical.
Jumlah sama dengan akhir F13 berdasarkan pengambilan baru, bukan asumsi.

| Package/rantai | Severity advisory | Dampak dan reachability | Tindakan | Status / alasan ditunda |
|---|---|---|---|---|
| deepmerge-ts via Prisma | High | Stack exhaustion graph rekursif; app tidak menerima graph JS arbitrary langsung | Tinjau jalur Prisma/adapter dan versi aman kompatibel | OPEN; saran downgrade Prisma6 bukan patch aman otomatis |
| mysql2 via Prisma | High | Risiko pada jalur MySQL/dependency bundle; app memakai PostgreSQL | Triage rantai runtime/tooling, jangan anggap terbukti unreachable | OPEN; perubahan Prisma major/override perlu persetujuan |
| React Router6 | Moderate | Redirect/SSR advisory; app CSR BrowserRouter, tanpa SSR hydrate deserialize | Review internal URL/CSR dan rencana versi yang kompatibel | OPEN; Router7 breaking, tidak diinstal |
| braces via Expo/Metro | High | Pemrosesan pola build/tooling; belum membuktikan exploit native | Batasi input build tak tepercaya, rencanakan patch terkoordinasi | OPEN; tidak downgrade Expo44 dari saran npm |
| node-forge via Expo toolchain | High | Jalur sertifikat/crypto tooling, bukan bukti dipakai checkout app | Review reachability dev/build dan patch SDK yang disetujui | OPEN; tidak memasang dependency baru |
| uuid transitive | Moderate | Advisory input/RNG pada rantai tertentu; dampak bergantung callsite | Triage versi/callsite toolchain | OPEN; tidak mengganti major secara otomatis |
| brace-expansion5.0.12 / fast-uri3.1.8 / source-map-js1.2.2 | Patch F13 dipertahankan | Versi terpasang diverifikasi, bukan klaim semua dependency aman | Tanpa install/update F14 | RETAINED; regresi ulang |

Omit-dev adalah klasifikasi npm; Expo/Metro dapat tercantum dalam dependencies
produksi walaupun jalurnya build. High advisory bukan otomatis exploit P0 yang
terbukti, tetapi tetap risiko release yang harus dinilai. Eksploitasi aktual
belum direproduksi; tidak menyembunyikan temuan atau mengikuti audit fix --force.
Tabel ini meringkas akar; range, URL advisory dan paket terdampak ada di JSON.

Env asli diabaikan Git pada semua app dan tidak tercatat sebagai tracked.
Scanner verifikasi-rilis melakukan exact-match credential proses serta email/
telepon/nama>=8karakter snapshot di memori; hanya hitungan yang disimpan.
Batasnya bukan audit seluruh history/semua pola secret. Seed demo existing
memiliki credential tetap: tidak dijalankan dan tidak dipakai untuk bootstrap
Production; provisioning aman tetap release blocker, tanpa mengubah akun lama.

## Midtrans, refund dan email

Get Status Sandbox read-only terbaru: 2026-10-15T00:49:27.119Z. Order
BBF7-DP-157-a9a8c1a770be4a92, transaction10cb3319-9196-463d-8484-715d01485c9f,
transaksi asal QRISRp5000 tetap settlement, identity/nominal/currency/merchant/
signature cocok. Target refundRp2000/F7-REFUND-48 memiliki0entri refund cocok,
tanpa bank confirmation. Row transaksi/refund lama tidak ada secara lokal;
PROCESSING hanya status historis. Tidak merekonstruksi data atau menambah
refund ledger. **Final refund DEFERRED, membutuhkan tindakan merchant** untuk
dashboard/provider/acquirer. Tidak cukup bukti untuk menyimpulkan unsupported,
gagal, menunggu callback atau aman retry. Tidak mengirim refund/retry baru.

Customer checkout DP dan pelunasan dari native WebBrowser masih DEFERRED karena
tidak ada device/AVD. Sandbox key existing tidak menggantikan prasyarat ini;
bukti F7 historis/MOCK bukan checkout app baru. Langkah nyata, Notification URL
aktif, verifikasi webhook, ledger sekali dan invoice disediakan pada panduan
Android. Tidak mengaktifkan Production atau menggunakan uang sungguhan.

Audit recovery menemukan belum ada SMTP/provider/template delivery. Token,
expiry, single-use dan limiter lulus; UI Customer sudah menyatakan email belum
tersedia dan respons umum tidak mengklaim email terkirim. **Email recovery
tetap blocker release.** Opsi berikutnya ialah SMTP transactional atau API email
provider yang disetujui pemilik. Perlu sender/domain, credential lokal, template
URL/deep link allowlist, retry/delivery status dan inbox nyata. Tidak mengarang
konfigurasi, memasang package atau memalsukan keberhasilan pengiriman.

Change-password dengan current password, perubahan email/telepon terverifikasi
dan edit item reschedule pada UI masih gap requirement. Perlu PRD/keputusan
bisnis, termasuk unique conflict, verification dan session revoke; bukan
membuka field PATCH me existing yang hanya nama/alamat tanpa desain keamanan.

## Database, backup dan cleanup aktual

Backup baru sebelum fixture finalisasi:
`backup-database/e2e-2026-10-15T00-47-37-807Z/database.dump`,125896 byte.
pg_restore --list dan full decode ke output dibuang lulus; tidak restore trial.
Backup/snapshot sensitif tetap di luar Git/ZIP. Backup807dipakai sebagai
baseline; backup809yang juga terbentuk pada pemeriksaan awal tetap dipertahankan.

Hasil akhir diverifikasi pada HASIL-INTEGRITAS.json: **22 model/137 record**
dibandingkan dengan snapshot baru, mencakup pelanggan/akun/operator, barber/
layanan/member, Pesanan/items/pembayaran/status serta seluruh tabel booking/
ledger/evidence/invoice/refund. Booking domain existing saat baseline nol;
invariant booking/ledger juga diuji dengan fixture dan race, bukan disimpulkan
hanya dari pemeriksaan orphan yang kosong. Setelah cleanup, rows identik;
orphan booking/ledger/invoice/refund, invoice duplikat dan hash permohonan
final nol. Sequence dapat maju karena fixture dan tidak direset. Tidak ada
reset/truncate/migration atau penghapusan data existing.

File historis terjaga byte-identik: Prisma SHA256
d524d6701a23a32c66c42711102af799cad1d2425b13f47d85d81d987bc1672a dan index
6594970f6d44cfae4ac899cd83f14f6991dce0a0; LayarTambahPelanggan SHA256
522ad8a3a03bd429b240519f2898bd4a45b88434eb941ab7904b3ae341cda941; format lokal
Staff booking.ts SHA256 d6b8c45c859e05d32077819bc54631767a7d5a8c0f449af290f649b9784e12ea.
Ketiganya tidak ikut commit/ZIP. Perbedaan Prisma terhadap HEAD hanya whitespace;
tidak melakukan restage/reset untuk merapikannya.

## Git, PR, file dan ZIP

Source yang berubah: server.ts (log fatal), ConfirmDialog.tsx,
DetailBookingPage.tsx/PembayaranBooking.tsx (aria-busy), Customer Booking.tsx
(draf). Test/scripts diubah/ditambah untuk regresi draf/log, consent/reschedule,
stabilitas browser, output terpisah, versi dependency, matriks, verifikasi rilis
dan ZIP. Staff hanya dokumen F14-AUDIT/PULL-REQUEST; tidak commit kosong.
Dokumen final dan daftar lengkap file pada `server/finalization/BERKAS-ZIP.json`.

Semua commit Bahasa Indonesia, tanpa nomor/nama fase atau prefix; path staging
eksplisit. Commit P3 --only mengecualikan Prisma yang sudah staged. Hash final,
hasil push dan upstream ditulis pada manifest luar ZIP/laporan penyerahan,
bukan menaruh hash commit yang memuat dokumen ini ke dalam dirinya sendiri.
Tidak force push, amend history, merge main atau deployment Production.

Fetch dan simulasi merge-tree awal: P3 main0behind/feature29ahead, Staff
0behind/4ahead; keduanya tanpa konflik. Customer hanya remote feature, tidak
ada origin/main; tidak bisa mensimulasikan PR ke main yang belum ada. Simulasi
tidak mengubah branch/index/working tree dan perlu diulang bila main berubah.
Teks PR disiapkan di PULL-REQUEST.md tiap repo; tidak membuat main secara
otomatis. Existing18migration pada feature harus ditinjau di target dengan
backup dan persetujuan terpisah; tidak diterapkan ulang pada audit ini.

ZIP `BARBERBARBAR-F14-FINALIZATION.zip` adalah delta finalisasi terhadap
baseline F13 di atas, bukan tiga repository lengkap. Terapkan hanya pada
baseline yang sesuai sambil mempertahankan perubahan lokal; jangan menimpa
file historis. Manifest mencatat setiap path/hash; checksum ZIP dan manifest
luar memuat HEAD final ketiga repo. Seluruh entry dibaca ulang dan dibandingkan
dengan source final. Tidak mengekstrak kembali ke working tree. Env, credential,
PII, JWT/Snap token, dump/snapshot, node_modules/.git dan file dilindungi tidak
disertakan. Riwayat diagnostik menunjukkan kegagalan awal secara jujur.

## Release blocker dan keputusan yang diperlukan

| ID / prioritas | Dampak | Penutupan / pemilik |
|---|---|---|
| R-01 P1 | Native UX/session/backend integration belum diterima pada perangkat | Pemilik menyediakan HP/AVD; checklist Staff/Customer dijalankan dan bukti aman |
| R-02 P1 | Pembayaran dari Customer native belum terbukti end-to-end | Sandbox DP/pelunasan/WebBrowser/webhook/refetch/ledger dengan device dan tunnel aktif |
| R-03 P1 | Dana refund historis belum terbukti kembali | Merchant memperoleh bukti final provider/acquirer, baru putuskan retry ADMIN bila diperlukan |
| R-04 P1 | Customer sungguhan belum bisa menerima recovery link | Pilih provider, set sender/credential lokal dengan izin, implementasi/uji delivery nyata |
| R-05 P1 | Acceptance profil/password/item reschedule belum jelas | Sediakan Master PRD dan keputusan bisnis/keamanan; jangan menambah fitur dari dugaan |
| R-06 P1 | Advisory runtime/build belum dituntaskan | Review reachability, setujui rencana dependency/major terpisah, lalu generate/build/regresi |
| R-07 P1 Production | Seed demo tidak layak provisioning akun rilis | Siapkan bootstrap aman tanpa default credential; audit target/account sebelum rilis |
| R-08 P2 | NOTIFY bukan durable replay, deployment/restore belum diuji | Acceptance staging/multi-instance/HTTPS/monitoring dan restore rehearsal terpisah |
| R-09 P1 PR Customer | Tidak ada base main untuk PR | Pemilik menetapkan main/history target; tidak dibuat atau di-merge otomatis |

Tidak ditemukan pelanggaran ledger/otorisasi P0 yang tetap gagal pada regresi
lokal; ini tidak menutup risiko yang belum diuji. Riwayat browser telah
ditangani dengan bukti pointer dan8 run stabil, tetap perlu monitoring staging.
Dokumen operasional: README-FINAL, RELEASE-CHECKLIST, PANDUAN-DEMO dan
README-PENGUJIAN-ANDROID. Urutan kelak jika disetujui: backend/schema staging →
Web → Staff → Customer, lalu acceptance/release gate dan persetujuan merge/
Production eksplisit. **F14 tetap PARSIAL, siap review bersyarat, belum rilis.**
