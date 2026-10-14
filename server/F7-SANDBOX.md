# Panduan pengujian F7 Sandbox

Tidak memakai Production. Jangan kirim credential/authtoken ke chat atau memasukkannya
ke source, log, commit/ZIP. server/.env sudah ignored dan untracked.

Isi manual MIDTRANS_MERCHANT_ID, MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY dari akun
Sandbox yang sama; MIDTRANS_IS_PRODUCTION=false. Nilai key tidak ditampilkan oleh
audit. SDK memiliki guard false dan hanya memanggil host Sandbox.

## Hasil finalisasi 14 Oktober 2026

Pelunasan online QRIS Sandbox **PASS**: fixture baru total Rp10.000, DP dan
pelunasan masing-masing Rp5.000, webhook sah sebelum sync, PAID/balance nol,
satu invoice final. Replay tiga payload signature asli provider HTTP200 semua,
kredit pelunasan/invoice tetap satu. Detail ada pada bagian terbaru F7-AUDIT.md.

Refund lama Rp2.000 **DEFERRED**, bukan sukses: Get Status terakhir
2026-10-14T12:57:27.698Z untuk order BBF7-DP-157-a9a8c1a770be4a92,
transaction ID 10cb3319-9196-463d-8484-715d01485c9f, masih settlement tanpa
entri F7-REFUND-48 atau bank_confirmed_at. Respons pengajuan historis202/status
lokal terakhir PROCESSING tidak membuktikan refund final. Fixture lokal lama
sudah dibersihkan sebelumnya; tidak merekonstruksi ledger atau menjalankan
refund/retry baru. Cek berikutnya hanya Get Status, jangan membuat refund pengganti.

Fixture pelunasan baru sudah dibersihkan setelah bukti dicatat; backend/tunnel
dan redirect localhost ditutup. Link checkout sesi tersebut tidak lagi berlaku.
Jangan mengulangi pembayaran yang sudah lulus tanpa alasan regresi.

## Webhook lokal

Port konfigurasi audit3000. Jalankan backend sesuai build existing, lalu ngrok
yang sudah diautentikasi secara manual:

```powershell
npm.cmd run build
npm.cmd start
# terminal lain
& 'C:\laragon\bin\ngrok\ngrok.exe' http http://127.0.0.1:3000 --inspect=false
```

Di **Midtrans Sandbox → Settings → Configuration → Payment Notification URL**,
masukkan URL HTTPS ngrok terbaru ditambah `/midtrans/notifications`, kemudian Save.
Jangan memakai BI SNAP Notification URL. Verifikasi port bila PORT berubah.
URL pada audit: https://trifle-unviable-levitator.ngrok-free.dev/midtrans/notifications
(sementara, hanya saat sesi masih aktif). Jangan menganggap domain ini permanen.

## Suite

Mock/integrasi DB lokal (tanpa merchant credential nyata):

```powershell
node scripts/test-midtrans-f7.mjs
```

Suite memakai override environment hanya dalam proses, fixture acak dan mock SDK;
tidak mengubah .env. PASS mock tidak membuktikan provider nyata.

Harness provider nyata khusus DB lokal/Sandbox:

```powershell
# hentikan backend lain yang Anda jalankan pada port sama sebelum harness
node scripts/test-sandbox-f7.mjs
```

Harness memegang port3000 sesuai env, akun/customer/operator/layanan dummy acak,
tidak menerima ID existing. Bila Snap berhasil, hanya tautan redirect localhost
yang ditampilkan; token/URL Snap provider tidak dicetak. Server redirect ephemeral
terikat127.0.0.1, memiliki path nonce acak, no-store, dan ditutup saat finish.
Pilih metode Sandbox yang supported refund, misalnya GoPay, lalu gunakan
simulator Sandbox; jangan membayar dengan akun/card sungguhan.

Commands harness:

- `sync`: GetStatus resmi semua kredit online fixture, tanpa mark paid manual.
- `start`: check-in/start melalui API operator, hanya jika DP sudah sah.
- `complete`: complete layanan dan buat deadline pelunasan.
- `settlement`: buat Snap sisa pelunasan dari database; tautan localhost yang sama
  kini mengarah ke pelunasan. Bayar simulator, lalu periksa ledger/evidence webhook
  **sebelum** sync untuk membuktikan webhook nyata; setelah itu Get Status/replay.
- `cancel`: sebelum start, cancel>=1jam menghasilkan request refund.
- `refund`: approve/retry ADMIN melalui API; sukses hanya bukti bank-confirmed GetStatus.
  Jangan menjalankan command ini untuk kasus lama yang masih PROCESSING; gunakan
  Get Status read-only saja, tanpa refund/retry baru.
- `finish`: cleanup semua fixture lokal dan hentikan harness.

Satu booking tidak sekaligus dipakai full service dan cancel; ulang harness untuk
jalur refund. Transaksi provider Sandbox tetap di dashboard sebagai riwayat, tidak
dihapus oleh cleanup lokal. Tanpa finish, fixture masih diperlukan untuk webhook;
jangan menutup proses atau menghapus record saat pembayaran sedang diuji.

Riwayat audit pertama14 Oktober: Snap create gagal HTTP500 bahkan di luar sandbox eksekusi;
tidak ada URL/settlement/refund provider nyata yang PASS. Periksa status layanan
Sandbox/akun di dashboard, lalu ulang harness setelah penyebab terselesaikan.
Jangan regenerate/menyalin key otomatis atau membuka Production sebagai jalan pintas.

Diagnosis lanjutan pada tanggal yang sama: Snap201 dan webhook/settlement DP5000
nyata berhasil, tanpa perubahan payment-domain. QRIS refund request2000 diterima
202 tetapi belum bank-confirmed; tetap PROCESSING, jangan menandainya sukses.
Penyebab internal500 historis belum pasti karena tidak lagi dapat direproduksi.
Pelunasan provider nyata kemudian lulus pada finalisasi di atas; refund final
tetap belum terkonfirmasi. Bagian riwayat bukan status terbaru.

Untuk observabilitas metadata aman (tidak mencetak token/key/body mentah):

```powershell
node scripts/diagnosis-midtrans-sandbox.mjs
```

Script menguji Snap SDK/native minimal dan varian expiry; tiap request mempunyai
order dummy unik. Tidak ada pembayaran, ledger settlement atau personal data.
Hasil Snap diagnostic tidak boleh dipakai sebagai bukti paid. Metadata request ID
dan status dapat dipakai saat eskalasi Midtrans jika500 berulang.

Refund `UNSUPPORTED` berarti butuh keputusan policy manual (kasir/bank transfer/
metode tanpa fasilitas refund/partial yang tidak didukung), bukan uang sudah kembali.
Refund `FAILED` dapat di-retry ADMIN dengan key sama. `PROCESSING` menunggu provider/
bank-confirmed dan retry hanya reconcile; tidak memanggil refund baru bersamaan.

Referensi resmi:

- https://github.com/Midtrans/midtrans-nodejs-client
- https://docs.midtrans.com/docs/https-notification-webhooks
- https://docs.midtrans.com/reference/refund-transaction
- https://docs.midtrans.com/reference/expire-a-snap-session
