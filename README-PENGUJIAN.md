# Panduan pengujian integrasi

15 Oktober 2026. Laporan utama F13-AUDIT.md, matriks per requirement di
server/e2e/MATRIKS-E2E.md dan JSON. Jenis bukti dipisah: unit/source, integration
adapter, HTTP/API, browser sungguhan, Android device, Sandbox provider, security.
Provider MOCK bukan Sandbox nyata dan export Hermes bukan device UI.

## Revalidasi finalisasi

Bukti F13 pada `server/e2e` dipertahankan sebagai riwayat. Untuk pengujian baru,
atur `$env:BB_AUDIT_OUTPUT_DIR='finalization'` pada terminal server sebelum
menjalankan runner/audit. Folder ini menyimpan hasil terbaru, tanpa menimpa F13.
Runner sekarang memuat27 tugas, termasuk draf Customer dan log fatal entrypoint.

```powershell
cd server
$env:BB_AUDIT_OUTPUT_DIR='finalization'
npm.cmd run build
node scripts/jalankan-regresi-e2e.mjs
node scripts/backup-e2e.mjs <folder-backup-awal>
node scripts/verifikasi-integritas-e2e.mjs <folder-backup-awal>
node scripts/audit-dependency-e2e.mjs
node scripts/audit-provider-e2e.mjs
node scripts/buat-matriks-final.mjs
```

Soak browser, dari client: `node scripts/test-stabilitas-browser.mjs 8 stabil`.
Gunakan label baru bila hendak mempertahankan hasil run sebelumnya. Jangan
menjalankan suite DB/browser lain bersamaan. Hasil gagal tetap disimpan;
ulang tes setelah fix tidak menghapus sejarah kegagalan. Helper bukaDialog dan
ubahQty mengulang hanya perubahan UI lokal jika refetch menonaktifkan kontrol
di antara pemeriksaan actionability dan pointerdown. Submit HTTP/pembayaran/
refund tidak diulang. Confirm menunggu respons `/api/...`, dialog tertutup dan
aria-busy selesai. Timeout tidak diperbesar untuk menyamarkan kegagalan.

Regresi baru: `server/scripts/test-log-proses.mjs` meluncurkan tiga child server
scheduler-off dan menginjeksi error sintetis; tidak memodifikasi data/provider.
`barberbarbar-customer/scripts/test-draf-jadwal-ulang.mjs` menguji komponen aktual
dengan hook/native host adapter; bukan navigasi Android. Panduan perangkat
terkonsolidasi di README-PENGUJIAN-ANDROID.md; panduan di bawah adalah konteks
F13 yang masih berguna, bukan hasil device terbaru.

Cadangan finalisasi memakai `server/scripts/buat-cadangan-final.ps1`, dengan
mode -SiapkanManifest sebelum commit lalu mode biasa setelah push. Keduanya
dapat dipanggil melalui PowerShell -NoProfile -ExecutionPolicy Bypass (hanya
proses pemanggilan; tidak mengubah kebijakan sistem). Daftar eksplisit pada
server/finalization/BERKAS-ZIP.json. `node scripts/verifikasi-rilis.mjs` memeriksa
exact-match credential/data snapshot di memori tanpa mencetaknya; gunakan
`--tanpa-tulis` bila hanya memeriksa setelah manifest/commit agar tidak mengubah
artefak yang sudah dibekukan. Pemeriksaan ini memiliki batas yang dicatat pada
HASIL-KEAMANAN.json dan tidak mengklaim semua history repo bebas rahasia.

## Persiapan aman

Gunakan branch feature/project5-integration. Periksa status tiga repo sebelum
menjalankan tes. Jangan stage/reset file historis Prisma, LayarTambahPelanggan,
atau format lokal Mobile src/layanan/booking.ts. Jangan jalankan suite database
secara paralel atau sambil mengubah data lewat UI lain. Jangan reset/truncate DB.

Node24.19.0/npm11.17.0 dipakai pada audit. PostgreSQL lokal18; backend .env existing
harus menunjuk localhost dan Midtrans mode Sandbox false. Jangan menyalin .env
ke laporan/ZIP. Tidak ada migration pada pengujian ini. Pastikan port3000/5173
tidak dipakai server lain ketika menjalankan harness browser.

```
cd server
npm.cmd run build
npx.cmd prisma validate
npx.cmd prisma migrate status
node scripts/backup-e2e.mjs
node scripts/jalankan-regresi-e2e.mjs
node scripts/audit-provider-e2e.mjs
node scripts/audit-dependency-e2e.mjs
node scripts/verifikasi-integritas-e2e.mjs <folder-backup>
node scripts/buat-matriks-e2e.mjs
```

Backup script menyimpan dump custom dan snapshot22 model pada Stage2/backup-database
di luar Git/ZIP. Memverifikasi pg_restore --list dan full decode ke output yang
dibuang, tanpa restore. `node scripts/backup-e2e.mjs <folder-backup>` memeriksa
kembali snapshot dan arsip. Snapshot berisi data sensitif: jangan diunggah.

Runner menjalankan suite serial dan membandingkan22 model sesudah setiap suite;
raw assertion dump tidak disimpan karena dapat berisi data existing. Hasil aman
di server/e2e/HASIL-REGRESI.json. Jika snapshot berbeda, runner menghentikan suite
berikutnya; jangan melanjutkan cleanup global. Selidiki hanya fixture UUID suite.
File historis juga diperiksa SHA256 sebelum/sesudah runner.

## Browser Web nyata

Playwright1.64.1 dipasang setelah persetujuan, memakai channel Edge existing
headless, tanpa download browser. Harness menyalakan backend HTTP/Socket3000 dan
Vite5173 sendiri, tanpa scheduler global, lalu menutup seluruh helper di finally.
Jalankan tersendiri hanya setelah suite DB lain selesai:

```
cd client
node scripts/test-e2e-browser.mjs
```

Browser login melalui form dan menekan tombol Web asli; Customer/Staff memakai
module layanan/SDK source aktual yang dibundle dengan adapter SecureStore/
AppState. Yang diuji sebagai browser: dashboard, membership approval, booking
confirm/reject, check-in, final barber, items/qty, kasir, invoice, refund202/
PROCESSING, responsive390px, logout. Tidak ada UI mobile diganti menjadi Web.
Gerbang Midtrans suite ini MOCK dalam proses. Tidak ada provider nyata atau
refund historis dipanggil. Tidak menyimpan HAR, trace auth, screenshot customer
asli atau token. Semua fixture dibersihkan dan snapshot dibandingkan.

## Pengujian fisik Android yang masih harus dijalankan

ADB/AVD kosong pada audit; bagian berikut panduan, bukan hasil PASS.

1. Sambungkan HP Android dengan USB debugging yang sudah disetujui pemilik dan
   Expo Go kompatibel SDK57. Periksa `adb devices -l` hingga status device.
   Jangan kirim serial perangkat, password atau token ke chat/laporan.
2. Pastikan komputer/HP satu Wi-Fi. IP saat audit192.168.1.9. Jalankan backend
   pada port3000, lalu buka `http://192.168.1.9:3000/public/services` di browser HP.
   Respons200/array diperlukan sebelum mencoba app. Jika gagal, periksa LAN/VPN/
   firewall secara manual; jangan menonaktifkan proteksi jaringan otomatis.
3. Verifikasi hanya EXPO_PUBLIC_API_URL pada .env lokal Project4/5 mengarah ke
   IP LAN yang benar; mulai ulang Metro setelah berubah. localhost HP bukan PC.
4. Terminal Project4: `npm.cmd start -- --lan --port 8081`.
   Terminal Project5: `npm.cmd start -- --lan --port 8082`.
   Scan QR pada Expo Go, atau buka exp://192.168.1.9:8081 dan :8082. Gunakan
   reload/switch project untuk satu HP; dua HP lebih baik untuk realtime serentak.
5. Siapkan akun ADMIN/STAFF dummy melalui flow operator existing. Buat customer
   dummy dari app dengan nama awalan QA-E2E dan email domain example.invalid.
   Gunakan password lokal milik penguji; jangan log atau simpan pada repository.
   Semua tindakan berikut harus menunjuk booking/customer dummy, bukan data asli.
6. Project5: uji registrasi201 dan nomor existing202; persetujuan pengaitan di
   Web ADMIN; login email/telepon/password salah; profil; logout; restart;
   pergantian akun A/B tanpa cache lama. Lupa password harus jujur menyatakan
   pengiriman belum tersedia. Jangan memberi PASS email tanpa inbox nyata.
7. Mulai booking sebagai guest, pilih dua layanan dan qty, masuk lalu kembali;
   pastikan pilihan utuh. Pada langkah jadwal tekan Pilih Barber, cari huruf
   campuran/no-result, pilih ID/siapa saja, close/back tanpa perubahan, keyboard,
   daftar panjang, safe area dan orientasi. Maju/mundur harus mempertahankan ID.
8. Buat booking, lihat Web/Staff tanpa refresh, confirm/reject wajib alasan dan
   alasan tampil di detail Customer. Uji membership pending/approve/reject/
   inactive; diskon booking10% dan DP50% dari backend, snapshot lama tidak berubah.
9. Uji DP native dengan langkah Sandbox di bawah. Setelah bukti sah, check-in
   Staff/Web, final barber, IN_SERVICE, perubahan layanan, complete. Customer
   tidak boleh menjalankan tindakan operator. Catat tampilan realtime semua app.
10. Uji specific barber replacement dan consent A/B, reschedule setelah reject
    dengan jeda>=1 jam sebelum jadwal lama, kembali pending/confirm baru. Customer
    UI saat ini hanya jadwal/barber, tidak menyediakan edit service/qty reschedule.
11. Uji cancel tepat/kurang1 jam, refund pending ADMIN, invoice sementara/final,
    bayar kasir/Staff/online sesuai fixture berbeda. Foreground/background,
    putus Wi-Fi/reconnect dan logout harus refetch tanpa kredit/event ganda.
12. Catat ID skenario, timestamp, status yang terlihat, expected/actual dan jenis
    bukti. Jangan merekam layar yang memuat pelanggan asli, password, auth header
    atau URL/token Snap. Bersihkan hanya fixture yang telah terverifikasi setelah
    semua pembayaran/refund final; pertahankan referensi provider selama pending.

## Midtrans Sandbox dari Customer App

Harus Android nyata tersedia; Get Status valid saja tidak membuktikan checkout.
Gunakan Sandbox, bukan Production/uang sungguhan. Backend menyimpan key; app
tidak membutuhkan key Midtrans. Jangan kirim key/authtoken pada chat.

1. Jalankan satu backend khusus test dan satu tunnel HTTPS menuju port backend
   tersebut menggunakan ngrok existing. Autentikasi ngrok dilakukan lokal oleh
   pemilik. Simpan Notification URL Sandbox `https://<tunnel-aktif>/midtrans/notifications`
   di dashboard. URL historis tidak dianggap aktif. Jangan menyalakan dua worker
   terhadap deadline yang sama tanpa kontrol fixture.
2. Gunakan booking dummy CONFIRMED dengan nominal kecil dari layanan dummy.
   Customer menekan Bayar DP, WebBrowser membuka host app.sandbox.midtrans.com.
   Lakukan simulasi metode yang sesuai dokumentasi Sandbox. Tutup/kembali app.
3. Sebelum sync manual, verifikasi webhook resmi mencapai backend, signature,
   merchant/order/transaction/nominal/currency cocok, ledger/evidence sah satu
   kali dan status tampil pada tiga app. Callback app tidak boleh menetapkan PAID.
4. Setelah check-in/start/complete, tekan pelunasan Customer. Nominal harus sisa
   database. Bayar Sandbox, verifikasi webhook, balance0, satu invoice final.
5. Replay hanya payload resmi yang sah pada fixture sendiri; hasil tidak boleh
   menambah kredit. Jangan menyimpan payload/signature/token dalam Git/ZIP.
6. Refund baru hanya fixture yang disetujui ADMIN; pertahankan record saat
   PROCESSING sampai bukti bank-confirmed. Jangan menghapus fixture pending demi
   cleanup hijau. Jangan menjalankan script sandbox historis yang dapat mengirim
   refund/retry tanpa meninjau perintahnya.

Refund lama F7-REFUND-48 tidak diulang. Get Status terbaru tetap settlement tanpa
entri refund; row lokal lama hilang. Pemilik perlu mencari order
BBF7-DP-157-a9a8c1a770be4a92 pada dashboard Sandbox dan meminta konfirmasi Midtrans
untuk refund_key/nominalRp2.000. Jangan mengasumsikan QRIS unsupported hanya dari
payment_type atau response202; butuh acquirer/capability/status merchant yang sah.
Referensi [Get Status resmi](https://docs.midtrans.com/reference/get-transaction-status).

## Scheduler dan reproduksi bug

Suite test-scheduler-booking menguji scanner runtime, startup/restart catch-up,
dua runner yang dikontrol fixture,30 menit/1 jam/15 menit, race/idempotency, refund
request timeout, CHECKED_IN exclusion dan OVERDUE. Bukan helper preview F12
scheduler-off. Tidak mengubah jam OS. Test batas reschedule menggunakan clock
transaksi test-only dalam proses, bukan request/environment produksi.

BUG-01 sebelum fix: reschedule sisa3599999ms/past menerima200; setelah guard
database clock menerima409, tepat3600000ms menerima200. BUG-02: alasan penolakan
API tidak tampil; test-detail-customer awal assertion gagal, sesudah DTO/render
baru PASS adapter. Gestur/native UI masih memerlukan langkah perangkat di atas.

BUG-03 sebelum fix: `console.error(error)` membawa sentinel pada JSON body dan
error SDK ke log. Jalankan build lalu `node scripts/test-log-aman-e2e.mjs` untuk
memeriksa dua kasus ini. Sesudah fix hanya kategori tetap dan kode Prisma yang
diizinkan masuk log; respons 400/500 tetap sama. Tes tidak mencetak sentinel,
password, token, maupun header asli.

## Cadangan hasil audit

Daftar file eksplisit ada pada `server/e2e/BERKAS-ZIP.json`. Dari root Project 3:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File server/scripts/buat-cadangan-e2e.ps1 -SiapkanManifest
# Commit dan push hanya path audit/fitur sendiri pada ketiga repository.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File server/scripts/buat-cadangan-e2e.ps1
```

Mode pertama membuat manifest sumber untuk di-commit. Mode kedua mensyaratkan
semua file daftar sesuai HEAD, membuat ZIP dengan CreateNew, membaca kembali
seluruh entry dan memeriksa hash terhadap sumber, lalu menulis checksum ZIP dan
manifest luar berisi commit ketiga repo. ZIP bukan backup seluruh repository.
Jangan mengubah sumber setelah persiapan manifest tanpa menyiapkannya ulang.
