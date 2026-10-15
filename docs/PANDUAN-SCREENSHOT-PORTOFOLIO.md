# Panduan screenshot dan rekaman portofolio

Status 15 Oktober 2026: **5 screenshot Web asli terverifikasi; Staff 0; Customer 0; video native belum direkam**. ADB tersedia di Android SDK tetapi daftar perangkat dan AVD kosong. Tidak memasang dependency atau tool baru, tidak mengubah database dan tidak melakukan transaksi/refund pada tahap ini.

## Menjalankan dan menyiapkan layar

Ikuti [panduan demo existing](PANDUAN-JALANKAN-DEMO.md) untuk PostgreSQL/backend3000, proxy webhook3001, Web localhost5173, Expo Staff8081 dan Customer8082. Gunakan launcher existing, hindari proses ganda dan jangan menyalin secret ke variabel publik. Gunakan data dummy yang sudah diotorisasi dan tersedia; jangan menjalankan seed/harness pembuat fixture pada tahap yang melarang perubahan database ini.

Login sebelum capture. Jangan menampilkan pelanggan asli, notifikasi pribadi, tab email, terminal environment atau address bar checkout. DP sah wajib sebelum check-in; pembayaran final harus sesuai backend. Jika layar aman tidak tersedia, tunda capture dan gunakan gambar existing yang sudah layak, jangan merekayasa status.

## Web

Lima JPEG existing di docs/screenshots berasal dari Web asli dengan provider MOCK: dashboard.jpg, booking-management.jpg, detail-booking.jpg, payment-management.jpg dan membership.jpg. Total 430.034 byte, lebar 1280 px, tinggi 800-1260 px; detail booking 820 px dan dashboard 848 px. Tidak dikonversi ulang karena sudah ringan dan konversi lossy menambah kehilangan detail. Tidak memasang converter atau memperbesar JPEG menjadi PNG.

Gunakan gambar itu selama source/UI masih sesuai. Jika nanti perlu capture ulang yang diotorisasi, buka halaman Web dummy, tunggu selesai loading, tutup toast melalui UI dan ambil screenshot browser/sistem. Pertahankan bagian fungsional; full-page boleh untuk detail/invoice panjang. Hindari screenshot ganda dengan nama berbeda. Jangan menimpa gambar existing tanpa review dan alasan jelas.

## Android: screenshot asli, bukan tampilan browser

Pasang/konfigurasikan software hanya dengan izin. Pada komputer ini ADB existing dapat dipanggil dari Windows PowerShell:

~~~powershell
$adb = Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
& $adb devices -l
~~~

Hubungkan HP USB debugging, setujui dialog hanya pada komputer tepercaya, jalankan Expo/build yang cocok SDK57 dan buka layar dummy. Jika beberapa perangkat terhubung, pilih serial secara privat dengan opsi -s; jangan publikasikan serial. Jika tidak ada perangkat, gunakan screenshot sistem di HP lalu pindahkan lewat USB File Transfer ke folder privat komputer.

Simpan capture di luar Stage 2 untuk ditinjau terlebih dahulu. Contoh berikut menghindari redirect binary PowerShell lama yang dapat merusak PNG:

~~~powershell
$masuk = Join-Path $env:LOCALAPPDATA 'BARBERBARBAR/portfolio-capture/incoming'
New-Item -ItemType Directory -Force -Path $masuk | Out-Null
# Pastikan layar yang terlihat hanya data dummy.
& $adb shell screencap -p /sdcard/Download/bb-capture.png
if ($LASTEXITCODE -ne 0) { throw 'Capture gagal' }
& $adb pull /sdcard/Download/bb-capture.png (Join-Path $masuk 'staff-beranda.png')
if ($LASTEXITCODE -ne 0) { throw 'Transfer gagal' }
~~~

Jangan mengirim file bila masih berisi data pribadi. Jangan menjalankan perintah hapus massal di HP/komputer. File lama tetap dipertahankan sampai peninjauan selesai. Perekam layar sistem HP boleh digunakan. Untuk video ADB pada perangkat yang tersedia:

~~~powershell
& $adb shell screenrecord --time-limit 120 /sdcard/Download/bb-demo.mp4
& $adb pull /sdcard/Download/bb-demo.mp4 (Join-Path $masuk 'demo-mentah.mp4')
~~~

Dua perintah video tersebut adalah panduan manual, belum dijalankan dalam tugas ini. Rekaman mentah tetap privat; jangan memasukkannya ke Git sebelum review frame. [Storyboard dan shot list](STORYBOARD-VIDEO-PORTOFOLIO.md).

## Nama file dan folder tujuan

Setelah peninjauan, salin hanya gambar yang benar-benar tersedia ke docs/screenshots pada **repository aplikasinya**, bukan root Stage 2. Gunakan huruf kecil/tanda hubung dan pertahankan PNG screenshot native jika converter existing tidak tersedia. Jangan memasang package image processing tanpa izin. Jangan mengganti ekstensi PNG menjadi WebP tanpa konversi nyata.

| Project | Target file PNG native |
|---|---|
| Staff | beranda.png, daftar-pesanan.png, detail-pesanan.png, booking-customer.png, check-in-barber.png, pembayaran.png |
| Customer | beranda.png, daftar-layanan.png, pilihan-barber.png, pilihan-jadwal.png, detail-booking.png, riwayat.png, invoice.png |

Saat ini file PNG tersebut **belum ada**, sehingga README tidak memuat link gambar ke sana. Catat tanggal/build, ukuran layar tanpa serial, jenis fixture/provider dan sumber capture pada docs/screenshots/README.md aplikasi terkait. Pertahankan rasio native, teks terbaca dan seluruh kontrol penting. Optimasi hanya dengan tool existing; tinjau hasil sebelum mengganti original.

## Keamanan dan pembaruan README

Tinjau tiap gambar ukuran penuh: tidak ada nama/email/telepon asli, password, JWT, token reset, key, URL Snap, raw API, notifikasi pribadi atau nomor transaksi provider sensitif. Nominal dummy diperbolehkan bila diberi label fixture MOCK; tidak mengedit nilai/status agar tampak berhasil. Jika perlu redaksi, beri label redaksi dan jangan menutupi bukti keadaan bisnis. Utamakan capture ulang layar dummy dengan otorisasi.

Pada branch docs/portfolio-visuals, tambahkan gambar yang telah lolos review dan path relatif dari README root. Untuk mobile gunakan tabel HTML dua/tiga kolom dengan elemen img berlebar sekitar 240 dan alt deskriptif; caption menyebut layar/provider. Jangan menambahkan tag img sampai file nyata tersedia. Klik semua gambar, periksa tampilan desktop/mobile, lalu explicit staging, commit Bahasa Indonesia, push dan draft PR tanpa merge otomatis.

## Validasi saat ini

Lima JPEG Web ditinjau visual, checksum cocok dengan bukti capture historis dan tidak ada duplikasi checksum. Galeri memakai gambar utuh; tidak mengubah status/nominal/piksel atau membuat screenshot baru. Diagram SVG adalah dokumentasi source, bukan screenshot. Mobile dan video lengkap tetap PARTIAL menunggu akses perangkat atau kiriman capture asli yang aman.
