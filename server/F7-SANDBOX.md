# Panduan pengujian F7 Sandbox

Tidak memakai Production. Jangan kirim credential/authtoken ke chat atau memasukkannya
ke source, log, commit/ZIP. server/.env sudah ignored dan untracked.

Isi manual MIDTRANS_MERCHANT_ID, MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY dari akun
Sandbox yang sama; MIDTRANS_IS_PRODUCTION=false. Nilai key tidak ditampilkan oleh
audit. SDK memiliki guard false dan hanya memanggil host Sandbox.

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
tidak menerima ID existing. Bila Snap berhasil, checkout URL sementara ditampilkan
hanya pada output developer untuk dibuka manual. Jangan menyalinnya ke dokumentasi/
Git/ZIP. Pilih metode Sandbox yang supported refund, misalnya GoPay, lalu gunakan
simulator Sandbox; jangan membayar dengan akun/card sungguhan.

Commands harness:

- `sync`: GetStatus resmi semua kredit online fixture, tanpa mark paid manual.
- `start`: check-in/start melalui API operator, hanya jika DP sudah sah.
- `complete`: complete layanan dan buat deadline pelunasan.
- `settlement`: buat Snap sisa pelunasan, buka URL lalu bayar simulator dan sync.
- `cancel`: sebelum start, cancel>=1jam menghasilkan request refund.
- `refund`: approve/retry ADMIN melalui API; sukses hanya bukti bank-confirmed GetStatus.
- `finish`: cleanup semua fixture lokal dan hentikan harness.

Satu booking tidak sekaligus dipakai full service dan cancel; ulang harness untuk
jalur refund. Transaksi provider Sandbox tetap di dashboard sebagai riwayat, tidak
dihapus oleh cleanup lokal. Tanpa finish, fixture masih diperlukan untuk webhook;
jangan menutup proses atau menghapus record saat pembayaran sedang diuji.

Pada audit14 Oktober, Snap create gagal HTTP500 bahkan di luar sandbox eksekusi;
tidak ada URL/settlement/refund provider nyata yang PASS. Periksa status layanan
Sandbox/akun di dashboard, lalu ulang harness setelah penyebab terselesaikan.
Jangan regenerate/menyalin key otomatis atau membuka Production sebagai jalan pintas.

Refund `UNSUPPORTED` berarti butuh keputusan policy manual (kasir/bank transfer/
metode tanpa fasilitas refund/partial yang tidak didukung), bukan uang sudah kembali.
Refund `FAILED` dapat di-retry ADMIN dengan key sama. `PROCESSING` menunggu provider/
bank-confirmed dan retry hanya reconcile; tidak memanggil refund baru bersamaan.

Referensi resmi:

- https://github.com/Midtrans/midtrans-nodejs-client
- https://docs.midtrans.com/docs/https-notification-webhooks
- https://docs.midtrans.com/reference/refund-transaction
- https://docs.midtrans.com/reference/expire-a-snap-session
