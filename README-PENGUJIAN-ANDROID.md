# Checklist penerimaan Android

Status saat audit15 Oktober2026: ADB terpasang tetapi tidak ada device/AVD.
Seluruh checklist native di bawah **DEFERRED**, bukan PASS dari Hermes export.
Panduan ini dapat dijalankan tanpa mengubah source. Tidak perlu mengirim serial
perangkat, credential atau token kepada pengembang.

## Persiapan sekali

1. Sambungkan HP dengan USB debugging, izinkan komputer pada HP. Jalankan
   `adb devices -l` sampai tampil device. Jika adb tidak ada di PATH gunakan
   `$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe`.
2. Gunakan Expo Go yang kompatibel SDK57. Instalasi software baru memerlukan
   persetujuan; panduan ini tidak memasangnya otomatis.
3. Jalankan backend dan Web sesuai README-FINAL. HP satu Wi-Fi dengan PC dan
   dapat membuka `http://<IP-PC>:3000/public/services`. Jangan mengubah firewall
   global atau memakai database Production.
4. Periksa env publik API kedua app, jalankan Metro Staff8081 dan Customer8082.
   Scan QR Expo Go; gunakan dua HP bila tersedia atau bergantian pada satu HP.
5. Gunakan akun ADMIN/STAFF dummy dan dua Customer dummy dari flow existing,
   email example.invalid. Simpan credential hanya pada penguji. Buat layanan/
   barber dummy melalui operator bila perlu; jangan mengubah pelanggan asli.
6. Catat ID fixture dan bukti. Jangan membersihkan transaksi provider pending;
   tunggu bukti final atau arsip aman sebelum cleanup terarah.

## Project 4 Staff

Isi hasil PASS/FAIL beserta actual; biarkan DEFERRED jika belum dijalankan.

| ID | Langkah / expected | Hasil awal |
|---|---|---|
| ST-01 | Login STAFF, password salah ditolak, data akun tepat | DEFERRED |
| ST-02 | Booking dummy Customer muncul di daftar dan detail tanpa refresh manual | DEFERRED |
| ST-03 | Confirm memperbarui Customer; reject wajib alasan dan alasan terlihat di Customer | DEFERRED |
| ST-04 | Tanpa DP check-in/start ditolak; DP sah membuka check-in awal | DEFERRED |
| ST-05 | Any barber wajib assignment final saat start; satu Pesanan IN_SERVICE | DEFERRED |
| ST-06 | Edit service/qty saat IN_SERVICE, total DB berubah, diskon snapshot utuh | DEFERRED |
| ST-07 | Complete, pelunasan kasir/Staff, balance0 dan invoice final sekali | DEFERRED |
| ST-08 | Walk-in WAITING tanpa barber awal; wajib barber ketika mulai layanan | DEFERRED |
| ST-09 | STAFF tidak approve membership/refund; ADMIN sesuai wewenang | DEFERRED |
| ST-10 | Keyboard/form/validation/empty/error/retry, safe area/tab/scroll/back benar | DEFERRED |
| ST-11 | Putus jaringan/reconnect dan background/foreground refetch data terbaru | DEFERRED |
| ST-12 | Logout/restart/pergantian operator membersihkan cache/socket/SecureStore | DEFERRED |

## Project 5 Customer

| ID | Langkah / expected | Hasil awal |
|---|---|---|
| CU-01 | Guest membuka Beranda, layanan/barber aktif, 4 tab Beranda/Booking/Riwayat/Akun | DEFERRED |
| CU-02 | Register/login email/telepon; pengaitan nomor dummy existing menunggu ADMIN | DEFERRED |
| CU-03 | Pilih layanan/qty sebagai guest, login lalu kembali; draf tetap ada | DEFERRED |
| CU-04 | PilihanBerpencarian: search campuran, no-result, loading/error/retry dan FlatList panjang | DEFERRED |
| CU-05 | Pilih barber ID/null; tutup modal/Back tidak mengubah pilihan, keyboard/scroll aman | DEFERRED |
| CU-06 | Maju/mundur langkah dan reschedule memakai pilihan yang sama; refetch tidak menimpa draf | DEFERRED |
| CU-07 | Booking multiservice, status konfirmasi/reject/alasan/realtime tepat | DEFERRED |
| CU-08 | Membership pending/approve/reject/inactive sesuai ADMIN, snapshot harga tetap | DEFERRED |
| CU-09 | DP Sandbox melalui WebBrowser; pending/failed/expired/cancel tidak memberi kredit palsu | DEFERRED |
| CU-10 | Setelah DP sah, check-in/start/edit/complete dari operator terlihat di timeline Customer | DEFERRED |
| CU-11 | Pelunasan Sandbox dari app: balance0/PAID/invoice final, webhook replay tidak menggandakan kredit | DEFERRED |
| CU-12 | Kembali dari checkout/background/foreground/disconnect/reconnect refetch dengan benar | DEFERRED |
| CU-13 | Riwayat/refund sendiri saja; PROCESSING belum dianggap dana kembali | DEFERRED |
| CU-14 | Profil sendiri; recovery menyatakan email belum tersedia, tidak memberi klaim terkirim | DEFERRED |
| CU-15 | Logout/restart/login Customer B tidak menampilkan data/cache Customer A | DEFERRED |

## Pembayaran Sandbox yang sah

Gunakan key Sandbox pada server lokal milik pemilik, bukan app. Jalankan tunnel
HTTPS ke backend, simpan Notification URL aktif `/midtrans/notifications` pada
dashboard Sandbox. URL ngrok lama tidak dianggap masih aktif. Dari Customer
tekan Bayar DP pada booking dummy CONFIRMED; nominal harus berasal dari server.
Selesaikan simulasi, verifikasi notifikasi resmi sebelum sync manual: signature,
nominal, identity provider, satu kredit ledger. Setelah layanan COMPLETED,
jalankan pelunasan dari app dengan sisa DB; pastikan PAID/balance0/satu invoice.
Ulangi notifikasi resmi hanya pada fixture sendiri, tanpa membagikan payload
signature/token. Callback frontend tidak menjadi otoritas pembayaran.

Refund historis F7-REFUND-48 tidak diulang. Bukti final harus diperoleh merchant
dari dashboard/provider sebelum keputusan retry; jangan mengirim refund baru
sebagai pengganti pengujian lama.

Format laporan yang dapat disalin:

```text
ID skenario:
Waktu WIB:
Project dan versi app:
Status: PASS / FAIL / DEFERRED
Expected:
Actual:
ID fixture dummy (tanpa data pribadi):
Bukti aman / catatan:
```

Sebelum screenshot/rekaman, pastikan tidak ada credential, URL Snap, pelanggan
asli atau notifikasi pribadi. Setelah selesai bandingkan data awal/akhir dan
bersihkan hanya fixture yang telah final dan dimiliki pengujian ini.
