# Panduan ekosistem BARBER BARBAR

Branch kerja ketiga repository: `feature/project5-integration`. Review source
dan persetujuan merge terpisah dari izin deployment. Jangan menganggap hasil
build atau adapter test sebagai acceptance perangkat/Production.

## Arsitektur dan kontrak

| Project | Peran | Koneksi |
|---|---|---|
| barberbarbar/client | Web ADMIN/STAFF | HTTP dan Socket.IO ke backend pusat |
| barberbarbar-mobile | Expo ADMIN/STAFF | HTTP JWT operator, SecureStore, Socket.IO |
| barberbarbar-customer | Expo CUSTOMER dan katalog publik | HTTP JWT CUSTOMER, SecureStore, WebBrowser checkout, Socket.IO |
| barberbarbar/server | Express/Prisma/PostgreSQL | Otoritas harga, status, ledger, invoice, refund, scheduler |

Tidak ada backend/database tambahan. Socket hanya sinyal refetch; REST dan
PostgreSQL adalah sumber data. Room diotorisasi server berdasarkan JWT;
CUSTOMER tidak memperoleh hak operator, STAFF tidak memutuskan pengajuan ADMIN.
JWT Customer membawa sidik kredensial sehingga reset password mencabut sesi
lama. Secret berada di server, bukan EXPO_PUBLIC atau bundle Web.

## Menjalankan lokal

Gunakan dependency yang sudah terpasang. Jika perlu install/update baru, minta
persetujuan dan gunakan lockfile repository terkait; jangan upgrade major/force.
Node saat audit24.19.0, npm11.17.0. Expo57 menargetkan React Native0.86 dan
React19.2.3: [dokumentasi versi](https://docs.expo.dev/versions/v57.0.0/).
Versi aktual setiap package dicatat pada `server/finalization/HASIL-DEPENDENCY.json`.

Terminal backend, dari `barberbarbar/server`:

```powershell
npm.cmd run build
npx.cmd prisma validate
npx.cmd prisma migrate status
npm.cmd start
```

Untuk pengembangan dapat memakai `npm.cmd run dev` (runner existing).
Periksa respons HTTP `http://127.0.0.1:3000/public/services` dan listener, bukan
hanya log startup. Entrypoint menyalakan scanner persisted deadline secara
default; jangan menjalankan instance lain terhadap data uji tanpa kontrol.
`SCHEDULER_BOOKING_AKTIF=false` tersedia untuk menghentikan scanner pada
lingkungan inspeksi. Jangan memakai `seed` pada data existing/Production;
seed demo existing memiliki credential tetap dan bukan bootstrap rilis.

Terminal Web, dari `barberbarbar/client`:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Vite memakai configLoader runner dan proxy backend3000 termasuk WebSocket
`/socket.io`. Buka URL5173 yang ditampilkan Vite. Build: `npm.cmd run build`.
Jangan menjalankan harness browser bersamaan dengan server/Vite manual pada
port3000/5173; harness menyediakan prosesnya sendiri.

Terminal Staff, dari `barberbarbar-mobile`:

```powershell
npm.cmd start -- --lan --port 8081
```

Terminal Customer, dari `barberbarbar-customer`:

```powershell
npm.cmd start -- --lan --port 8082
```

HP dan komputer harus berada pada LAN yang saling terjangkau. Periksa IP PC
sekarang, bukan mengandalkan IP historis. Kedua app memakai variabel publik
`EXPO_PUBLIC_API_URL=http://<IP-LAN-PC>:3000` pada env lokal yang diabaikan Git.
Ubah hanya dengan persetujuan pemilik dan restart Metro setelah perubahan.
localhost pada HP menunjuk HP sendiri. Jangan mematikan firewall otomatis.
Tanpa Android/AVD, lihat [checklist perangkat](README-PENGUJIAN-ANDROID.md).

## Environment tanpa nilai rahasia

| Lokasi/variabel | Kegunaan |
|---|---|
| server/.env DATABASE_URL | PostgreSQL target yang sudah diverifikasi pemilik |
| JWT_SECRET | Tanda tangan token; jangan mengganti sembarangan karena mencabut sesi |
| PORT | Port backend, default3000 |
| MIDTRANS_MERCHANT_ID, MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY | Identitas merchant dan credential; hanya server |
| MIDTRANS_IS_PRODUCTION | Harus false; implementasi sekarang menolak Production |
| SOCKET_ALLOWED_ORIGINS | Daftar origin Web dipisahkan koma, default localhost/127.0.0.1:5173 |
| SCHEDULER_BOOKING_AKTIF | true/false; default aktif pada entrypoint |
| SCHEDULER_BOOKING_INTERVAL_MS | 1000–60000 ms; default15000 |
| Mobile .env EXPO_PUBLIC_API_URL | Alamat API publik LAN, bukan tempat credential |
| BB_AUDIT_OUTPUT_DIR | Variabel proses test untuk memisahkan bukti audit; bukan konfigurasi produk |

File env asli tidak masuk Git/ZIP. Tidak ada konfigurasi provider email baru.
Jangan mengirim key, token, header auth, URL Snap atau dump ke chat/PR.

## Operasi dan pembayaran

Customer boleh booking tanpa membership. Pengajuan membership menunggu ADMIN,
status INACTIVE hanya diaktifkan melalui flow ADMIN existing. Booking memakai
snapshot benefit10% bila aktif; diskon/operator existing tetap kompatibel.

Alur utama: PENDING_CONFIRMATION → CONFIRMED → DP provider sah → CHECKED_IN →
barber final/Pesanan → IN_SERVICE → COMPLETED → pelunasan/PAID/invoice final.
Penolakan menyertakan alasan; usulan barber memerlukan keputusan Customer.
Reschedule setelah penolakan usulan minimal satu jam sebelum jadwal lama dan
kembali PENDING_CONFIRMATION. UI Customer saat ini mengganti jadwal/barber,
bukan edit item. Source backend menerima item dengan guard DP dan slot.

Nominal DP/pelunasan berasal dari DB. Callback WebBrowser tidak menetapkan PAID.
Webhook diverifikasi signature/merchant/order/transaction/amount, settlement
idempotent memberi kredit sekali. Kasir legacy walk-in tetap terpisah dari
ledger booking. COMPLETED tidak sama dengan PAID. Invoice final milik booking
sendiri dan diterbitkan setelah pembayaran sah.

Refund memerlukan ADMIN; PROCESSING/202 belum berarti berhasil. Retry harus
merekonsiliasi identitas provider dan tidak membuat refund ganda. Timeout
sistem dengan DP sah mengajukan refund100% untuk ADMIN; NO_SHOW DP hangus.
Scheduler menangani konfirmasi/reschedule30 menit, DP1 jam, no-show15 menit dan
overdue pelunasan1 jam dengan DB clock/lock, bukan timer frontend.

## Testing dan batas rilis

Panduan teknis dan fixture: [README-PENGUJIAN](README-PENGUJIAN.md).
Hasil terbaru: [F14-AUDIT](F14-AUDIT.md).
Release gate: [RELEASE-CHECKLIST](RELEASE-CHECKLIST.md).
Demo: [PANDUAN-DEMO](PANDUAN-DEMO.md).

Pengiriman recovery email belum tersedia; UI menjelaskannya secara eksplisit.
Device UI, Customer checkout Sandbox, refund historis final, PRD/gap identitas
dan beberapa advisory tetap menjadi pemeriksaan wajib sebelum rilis.
Tidak ada merge atau deployment Production otomatis.
