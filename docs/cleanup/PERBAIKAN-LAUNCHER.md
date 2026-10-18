# Perbaikan identitas backend pada launcher

17 Oktober 2026. Branch `feature/project5-integration`. Perubahan hanya disimpan dalam commit lokal, tanpa push.

## Penyebab dan perbaikan

Backend existing PID31868 menjalankan `node --watch-preserve-output dist/server.js`; parent watcher PID3096 juga memakai entrypoint relatif. `server/scripts/dev.mjs` sudah menetapkan cwd backend dengan benar. Bug ada pada guard launcher yang hanya mencari string path absolut di command line; perubahan cwd terminal bukan penyebab backend gagal.

`scripts/jalankan-barberbarbar.ps1` tetap launcher utama. Root diturunkan dari PSScriptRoot dan seluruh cwd startup tetap absolut. Helper Windows memecah argumen menggunakan CommandLineToArgvW, mencocokkan executable dengan Node yang dipilih launcher, memeriksa posisi script secara tepat, dan menormalisasi entrypoint. Argumen eval/loader/skrip lain tidak diterima sebagai identitas backend.

Untuk watcher lama, cwd proses dibaca secara read-only melalui handle QUERY_INFORMATION/VM_READ, bukan ditebak dari terminal atau parent dengan argumen relatif. Hanya field cwd yang dibaca, bukan blok environment, credential atau isi memori lain. PID, waktu pembuatan, executable dan command line diperiksa ulang; pemilik port diperiksa lagi sebelum menerima hasil. Jika akses/metadata/struktur tidak dapat diverifikasi, proses ditolak. Respons HTTP yang sama dari node lain tidak cukup untuk lolos.

Pembacaan cwd legacy dibatasi layout native Windows x64, dengan pemeriksaan panjang/arsitektur dan penolakan bila tidak didukung. Struktur PEB adalah internal Windows dan dapat berubah; kegagalan berarti fail-closed, bukan fallback ke cwd terminal. Startup watcher berikutnya memakai entrypoint dan watch-path absolut sehingga tidak memerlukan pembacaan cwd legacy. Referensi: [NtQueryInformationProcess](https://learn.microsoft.com/en-us/windows/win32/api/winternl/nf-winternl-ntqueryinformationprocess), [PEB](https://learn.microsoft.com/en-us/windows/win32/api/winternl/ns-winternl-peb).

Ketika port sementara kosong tetapi watcher terverifikasi masih hidup, launcher menunggu listener dengan batas percobaan; tidak rebuild/spawn backend kedua. Watcher tidak terverifikasi atau timeout tetap memblokir startup. Mutex antar-launcher tetap dipertahankan. Tidak ada fungsi penghentian proses di launcher.

Mode `-Periksa` tidak memulai proxy/tunnel yang belum tersedia. Proxy3001 yang tidak aktif dilaporkan opsional dan pembayaran tidak dinyatakan siap. `-Periksa -Ngrok` tetap mensyaratkan proxy serta validasi forwarding HTTPS yang ketat. `-TanpaNgrok` tidak memeriksa/mengubah tunnel existing. Startup normal tetap menjalankan backend/proxy dan tiga frontend sesuai alur existing. Ngrok existing yang langsung menuju3000 tidak diubah pada pekerjaan ini.

## Pengujian

Perintah dari `server`:

```powershell
node scripts/test-startup-development.mjs
node scripts/test-startup-development.mjs --live
node node_modules/typescript/bin/tsc --noEmit
```

Suite default memakai Node fixture pada port acak dan folder temp dengan spasi; mock port3000 tidak menyentuh listener pengguna. `--live` menambah pemeriksaan launcher actual dari Stage2, Project3 dan folder temp. Cleanup hanya mematikan pohon proses fixture yang dibuat suite, setelah command line dengan path temp unik diverifikasi. Tidak ada backend bisnis yang di-build atau di-restart untuk pengujian ini.

| Tes wajib | Hasil dan batas bukti |
|---|---|
| 1. Semua server mati, startup normal | PASS orkestrasi mock: backend, proxy, Admin5173, Customer5175, Staff8081; satu spawn backend. Penghentian seluruh server pengguna untuk tes live NOT RUN karena sedang aktif. |
| 2. Backend existing + Periksa | PASS live: PID31868 diterima; tidak spawn/restart. |
| 3. Working directory berbeda/spasi | PASS live: Stage2, Project3 dan folder temp; path relatif fixture diselesaikan terhadap cwd proses sebenarnya. |
| 4. Port3000 milik aplikasi lain | PASS fixture: node asing pada port acak memberi greeting API yang sama tetapi ditolak; pemetaan port3000 mock juga menolak tanpa spawn. Port3000 pengguna tidak direbut. |
| 5. Identitas tidak dapat diverifikasi | PASS: metadata/cwd hilang, executable berbeda, PID/waktu berubah, eval, argumen/suffix palsu dan watcher tidak terverifikasi ditolak. |
| 6. Launcher berulang dan restart | PASS mock: tepat satu spawn saat kosong, tidak bertambah ketika diulang; watcher ditunggu, timeout tanpa duplikat. Periksa live diulang tanpa mengganti PID backend. |
| 7. Admin/Customer mengakses backend | PASS HTTP200 pada kedua UI dan kedua proxy `/api/public/services` bertipe JSON; backend publik juga200. |
| 8. Socket.IO | PASS handshake transport backend existing; 23 kelompok realtime terisolasi lulus, termasuk autentikasi CUSTOMER/ADMIN/STAFF, WebSocket/polling, reconnect dan cleanup. Provider MOCK, snapshot22 fixture identik. |
| 9. Mobile Staff startup | PASS target Expo existing dan HTTP200 `/status` port8081; PID11072 tetap. Device/scan QR baru NOT RUN. |
| 10. Proses pengguna tidak dihentikan | PASS: backend31868, Admin668, Customer27172, Staff11072 tetap menjadi pemilik listener sebelum/sesudah. |

TypeScript backend noEmit dan pemeriksaan sintaks JavaScript/PowerShell lulus. Tidak menjalankan build yang mengubah dist karena watcher pengguna aktif. Tidak ada dependency baru atau instalasi software. Pada percobaan fixture awal, file readiness sempat ikut memicu watch restart; fixture diperbaiki agar hanya mengawasi entrypoint, kemudian suite akhir lulus.

## File dan perlindungan

- `scripts/jalankan-barberbarbar.ps1`: penerimaan identitas, penantian restart dan pelaporan pemeriksaan opsional.
- `scripts/identitas-node.ps1`, `scripts/IdentitasProses.cs`: helper identitas Windows read-only.
- `server/scripts/dev.mjs`: watch-path dan entrypoint absolut.
- `server/scripts/test-startup-development.mjs`, `server/scripts/uji-startup-launcher.ps1`: regresi terisolasi serta opsi live.
- `README.md` dan laporan ini: perilaku/pengujian aktual.

Perubahan historis: tiga file Project3 termasuk Prisma staged; satu file Staff; 18 file Web tetap utuh dan tidak masuk commit launcher. Tidak ada perubahan database, migration, autentikasi, booking, DP/deadline, tracking, invoice, guest socket, LAN atau credential. Tidak membuat ulang Native atau mengubah remote GitHub. Snapshot hash source/index/environment tersedia privat pada folder temp audit; pemeriksaan preservasi dilakukan sebelum commit.

Keterbatasan: belum menguji ARM64/WOW64 atau Windows dengan pembacaan cwd diblokir kebijakan endpoint; perilakunya menolak identitas relatif yang tidak bisa diverifikasi. Pengujian fisik Android dan siklus mematikan semua aplikasi pengguna tidak dilakukan. Pembayaran/tunnel live bukan hasil PASS dari mode pemeriksaan backend ini.
