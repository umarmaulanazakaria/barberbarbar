# Menjalankan demo lokal

Untuk tugas kuliah/portofolio, tanpa hosting Production. Jalankan perintah dari folder yang disebutkan. Dependency memakai lockfile (`npm.cmd ci` pada `server`, `client`, Customer Web, dan Mobile Staff) hanya bila belum tersedia. Tidak perlu memasang provider email atau software baru untuk membaca hasil tes.

## Persiapan database dan akun dummy

1. Jalankan PostgreSQL lokal melalui pengelola service yang digunakan komputer. Periksa koneksi tanpa menampilkan `DATABASE_URL`. Backend memakai Prisma/PostgreSQL, bukan database dalam mobile.
2. Jangan seed database aplikasi existing. Untuk presentasi interaktif, gunakan database **baru terpisah** bernama `bb_demo_presentasi` atau `bb_demo_<identitas>`, host loopback. Siapkan schema dari `pg_restore --schema-only --no-owner --no-privileges --dbname bb_demo_presentasi <dump-privat-terverifikasi>`. Ini hanya menyalin schema, bukan data. Untuk instalasi baru tanpa dump, tinjau migration dengan pemilik sebelum menerapkannya pada database kosong; jangan reset database.
3. Atur `DATABASE_URL` database demo hanya pada environment proses terminal privat. Jangan mencetak nilainya, mengubah koneksi existing secara diam-diam atau memasukkan URL ke Git. Set `MIDTRANS_IS_PRODUCTION=false`. Sebelum menjalankan server demo pada 3000, hentikan hanya backend workspace yang sudah diverifikasi dan tidak sedang dipakai transaksi; jangan menimpa listener existing.
4. Gunakan **seed existing** (`server/src/seed.ts`), bukan seed baru. Seed kini menolak tanpa izin eksplisit, host lokal, nama `bb_demo_*` dan dua password privat 12–72 byte. Tidak mencetak password atau memperbarui akun operator existing. Jalankan dari `server`, pada terminal yang tidak direkam:

```powershell
$env:IZINKAN_SEED_DEMO='true'
$sandiAdmin = Read-Host 'Password ADMIN demo privat (12–72 byte)' -AsSecureString
$sandiStaff = Read-Host 'Password STAFF demo privat (12–72 byte)' -AsSecureString
$env:DEMO_ADMIN_PASSWORD = [Net.NetworkCredential]::new('', $sandiAdmin).Password
$env:DEMO_STAFF_PASSWORD = [Net.NetworkCredential]::new('', $sandiStaff).Password
try { npm.cmd run seed } finally {
  Remove-Item Env:DEMO_ADMIN_PASSWORD, Env:DEMO_STAFF_PASSWORD, Env:IZINKAN_SEED_DEMO -ErrorAction SilentlyContinue
  $sandiAdmin.Dispose(); $sandiStaff.Dispose()
}
```

Seed membuat operator dummy (`admin@demo.example.invalid`, `staff@demo.example.invalid`), barber/layanan contoh, pelanggan/membership contoh dan pesanan walk-in dummy. Password dipilih sendiri, tidak disertakan repository. Menjalankan ulang tidak mengganti password/operator atau menggandakan nomor pesanan contoh; seed tetap mengatur ulang atribut katalog/pelanggan contoh, sehingga hanya untuk database demo khusus. Ini **bukan bukti pembayaran Midtrans**.

5. Buka Customer Web (5175), pilih layanan/jumlah, jadwal WIB, nama dan nomor HP. Tidak perlu akun atau memilih barber. Backend menghitung DP 50% dan deadline 15 menit. Setelah DP terverifikasi, simpan kode tracking rahasia. Membership dan akun Native historis tidak menjadi prasyarat workflow Web.
6. Catat nama database, fixture milik demo dan waktu pembuatannya secara privat. Bersihkan hanya fixture yang kepemilikannya terverifikasi dan relasinya ditinjau. Jika database khusus akan dibuang, verifikasi nama/koneksi/ownership, buat backup bila dibutuhkan dan pastikan tidak ada data lain; jangan menjalankan perintah hapus generik pada database aplikasi. Harness otomatis existing sudah membersihkan fixture berdasarkan ID dan membandingkan 22 model.

## Environment dan koneksi LAN

`server/.env.example` adalah template. Isi credential Sandbox/JWT/PostgreSQL secara manual hanya pada server. `.env` asli diabaikan Git. Jangan menyalin Server Key ke frontend, screenshot atau `EXPO_PUBLIC_*`. Tetap `MIDTRANS_IS_PRODUCTION=false`; email transport default nonaktif.

Pada `.env` Mobile Staff, isi **hanya URL publik backend**:

```dotenv
EXPO_PUBLIC_API_URL=http://<IP-LAN-LAPTOP>:3000
```

Gunakan IPv4 adapter LAN aktif saat ini, bukan IP historis; `localhost` pada HP menunjuk HP. Laptop/HP harus satu jaringan tepercaya, tanpa client isolation. Batasi firewall backend untuk LAN privat; jangan mematikan firewall global. Restart Metro setelah mengganti environment. `SOCKET_ALLOWED_ORIGINS` server harus mencakup origin Web lokal yang dipakai; Socket.IO tidak menggantikan JWT.

## Satu launcher, tanpa backend ganda

Dari `barberbarbar`, sesudah dependency/environment tersedia:

```powershell
# Inspeksi backend/proxy existing; tidak membuat proses.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\jalankan-barberbarbar.ps1 -HanyaBackend -Periksa
# Jalankan semua aplikasi bila belum aktif; tidak perlu ngrok untuk katalog/booking.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\jalankan-barberbarbar.ps1
# Hanya ketika pembayaran Sandbox baru memang diotorisasi:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\jalankan-barberbarbar.ps1 -Ngrok
```

| Komponen | Port dan verifikasi |
|---|---|
| Backend | 3000; GET `/` mengembalikan pesan API, GET `/public/services` katalog aktif |
| Proxy webhook | loopback 3001; hanya POST JSON `/midtrans/notifications` |
| Web Vite | 5173, strictPort; `/api` dan `/socket.io` menuju backend 3000 |
| Expo Staff | 8081 |
| Customer Web | 5175; proxy `/api` menuju backend 3000 |
| Ngrok opsional | HTTPS → **3001**, bukan 3000/5173/5175/8081 |

Launcher memeriksa entrypoint absolut/PID backend dan proxy, memakai mutex dan tidak menghentikan proses existing. Port frontend yang terisi dilewati; itu **bukan bukti** proses tersebut milik project, jadi periksa identitas dan responsnya. Backend existing tidak otomatis dibuild/restart. Bila source runtime berubah, build dari `server` lalu restart terkontrol setelah transaksi aman. `-Periksa` gagal jika backend/proxy belum aktif: jalankan launcher normal dahulu.

Launcher menyimpan log privat di `%LOCALAPPDATA%/BARBERBARBAR/development`. Untuk melihat QR, buka log `staff.out.log` secara lokal atau jalankan Expo di terminal terlihat **hanya jika portnya kosong**:

```powershell
# Dari barberbarbar-mobile
npm.cmd start -- --lan --port 8081
# Customer Web aktif (bila belum dijalankan launcher):
# Dari barberbarbar-customer-web, terminal lain
npm.cmd run dev
```

Pindai QR dengan Expo Go yang kompatibel SDK 57. Jika tidak kompatibel, perlu development build/toolchain yang disetujui terpisah. Customer Native dipensiunkan dan tidak dijalankan oleh launcher. Source, akun/member, API dan deep link historis dipertahankan sebagai arsip. Tidak perlu memperlihatkan QR/alamat privat dalam screenshot portofolio. Buka Web launcher pada `http://localhost:5173`. Listener Vite existing saat audit hanya `::1`; URL IPv4 `127.0.0.1:5173` tidak tersedia pada proses itu. Jika menjalankan manual dengan `--host 127.0.0.1`, gunakan URL IPv4 tersebut. Keduanya tetap lokal; jangan menjalankan Vite kedua hanya karena memakai hostname berbeda.

## Kesiapan Android dan pembayaran

Periksa `adb devices -l` (pada komputer ini SDK berada di `%LOCALAPPDATA%/Android/Sdk/platform-tools`) dan uji GET `/public/services` melalui browser HP ke IP LAN. Jangan memublikasikan serial perangkat. ADB kosong bukan bukti aplikasi gagal; acceptance yang dilaporkan pengguna tetap USER-REPORTED. Detail native mengikuti [panduan Android](README-PENGUJIAN-ANDROID.md).

Pembayaran baru memerlukan otorisasi pengguna, fixture sah dan akun Sandbox. Ikuti [panduan resmi simulator Midtrans](https://docs.midtrans.com/docs/testing-payment-on-sandbox). Notification URL dashboard Sandbox: `https://<DOMAIN-NGROK-AKTIF>/midtrans/notifications`. Jika domain berubah, perbarui dashboard terlebih dahulu; jangan memakai URL checkout. Proxy menolak route lain, dan signature/status provider tetap wajib diverifikasi. Payload kosong menghasilkan 400 sebagai readiness, bukan settlement.

Customer: checkout DP dari detail booking, tunggu DP sah → Staff check-in/barber/IN_SERVICE/COMPLETED → Customer checkout sisa dari database → backend PAID/balance nol/invoice. Callback popup Snap bukan bukti lunas. Bila tunnel mati, pulihkan backend/proxy/tunnel dan gunakan pemeriksaan status pembayaran existing; jangan membayar ulang, memalsukan webhook atau mengubah ledger manual. Tidak mengulang transaksi lunas historis atau refund `F7-REFUND-48`.

Tanpa transaksi baru, gunakan harness browser dengan provider MOCK pada database uji kosong terpisah: dari `client`, `node scripts/test-e2e-browser.mjs`. Harness memakai port loopback acak, tidak perlu menghentikan backend 3000/Vite 5173, tidak menahan UI untuk presentasi manual, dan membersihkan fixture sendiri. Aktifkan `BB_CAPTURE_SCREENSHOTS=1` hanya pada database kosong `bb_demo_*` untuk memperbarui lima gambar aktual. Jangan menjalankan tes database paralel.

## Menghentikan demo

Terminal manual: Ctrl+C pada proses yang dijalankan sendiri. Untuk proses tersembunyi launcher, identifikasi listener dengan `Get-NetTCPConnection`, lalu cocokkan PID/executable/command line melalui `Get-CimInstance Win32_Process` dengan path absolut workspace. Hentikan hanya PID yang benar-benar terverifikasi dan tidak sedang dipakai transaksi, mulai dari ngrok/Expo/Web, proxy lalu backend. Jangan memakai `taskkill /IM node.exe`, mematikan seluruh PostgreSQL atau PID dari catatan lama. Periksa port lagi sesudahnya. Tidak ada perintah penghentian otomatis massal.
