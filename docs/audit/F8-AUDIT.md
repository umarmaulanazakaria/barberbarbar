> Dokumen historis dipindahkan dari `barberbarbar/server/F8-AUDIT.md`. Hasil dan path bukti mencatat waktu audit; panduan aktif ada di README utama dan laporan cleanup. Arsip privat kini berada di luar Stage 2.

# Audit scheduler dan automatic jobs

14 Oktober 2026, Asia/Jakarta. Branch feature/project5-integration;
baseline 9bdf29f387e2711f7ddb2ddf51997dbfc8efa319.

**F8 SELESAI secara independen:** kelima job dan acceptance lokal lulus.
**F7 tetap PARSIAL:** refund historis Rp2.000 belum terkonfirmasi final.
Tidak mengulang pembayaran Sandbox nyata yang sudah PASS pada F7.
Master PRD v2.0 lengkap tidak ditemukan di workspace; aturan waktu dan acceptance
mengikuti prompt F8 lengkap pengguna, keputusan refund terbaru, audit F5/F6/F7
dan source aktual. Ini bukan klaim telah mencocokkan dokumen PRD yang tidak tersedia.

## Audit dan pilihan implementasi

Tidak membutuhkan instalasi scheduler/cron/queue/Redis/software/extension baru.
package.json, lockfile, schema dan 16 migration existing tidak diubah.
Scanner memakai PostgreSQL, Prisma dan timer Node existing. Timer hanya pemicu
scan; deadline/state/histori berada di database dan tetap ada setelah restart.

| Job | Deadline durable / hasil |
|---|---|
| Confirmation timeout | Booking.dibuatPada +30 menit; PENDING_CONFIRMATION menjadi CANCELLED |
| Reschedule timeout | Riwayat RESCHEDULE terakhir menurut ID +30 menit; CANCELLED, slot baru dilepas, tidak restore jadwal lama |
| DP timeout | Booking.deadlineDp = dikonfirmasiPada +1 jam; CONFIRMED tanpa DP sah menjadi CANCELLED |
| No-show | mulaiPada +15 menit; hanya CONFIRMED, checkInPada null, pesananId null menjadi NO_SHOW |
| Overdue | deadlinePelunasan atau layananSelesaiPada +1 jam; balance positif dicatat PAYMENT_OVERDUE, layanan tetap COMPLETED |

Confirmation tidak membutuhkan kolom baru: waktu kejadian existing disimpan
persisten. diperbaruiPada tidak dipakai sebagai deadline. Scanner membaca versi
reschedule terbaru di dalam lock sehingga kandidat scan lama tidak memutuskan
versi baru. Pembentukan booking dan histori operasional kini memakai clock DB
setelah lock, bukan waktu transaksi yang mungkin dimulai sebelum menunggu lock.

Clock authoritative berasal dari clock_timestamp PostgreSQL dalam epoch ms.
Query scan/preflight/mutation memakai UTC sesuai pola PrismaPg existing, lalu
timestamp operasional tetap Asia/Jakarta. Batas eligible menggunakan >=;
konfirmasi dan check-in yang sudah melewati batas ditolak juga saat scanner
belum sempat berjalan. OVERDUE tampil tepat batas satu jam; PAID lebih utama.
Clock injectable hanya argumen service internal untuk testing, tidak diterima
controller, payload client atau environment. Jam OS tidak diubah.

Transisi, riwayat sistem dan permohonan refund berada dalam satu transaksi
READ COMMITTED, memakai pg_advisory_xact_lock(7354,1) existing, validasi state
ulang, dan conditional update. Lock tersebut juga dipakai lifecycle, webhook
serta pembayaran kasir. OVERDUE hanya satu riwayat per booking di bawah lock;
tidak menambah enum layanan/payment yang bertentangan. Slot dilepas melalui
status terminal existing, tidak memelihara counter kapasitas kedua.
Referensi: [advisory lock transaksi PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS).

## DP pending, provider terlambat dan kebijakan refund

Sebelum DP timeout, scanner mencoba Get Status untuk attempt DP MIDTRANS PENDING
yang mempunyai referensi provider. Network di luar lock; identitas/merchant/
nominal/currency/waktu provider memakai validasi existing. Settlement tepatwaktu
yang sudah terjadi dapat dicatat sebelum webhook tiba, sehingga booking tidak
dibatalkan hanya karena status lokal belum diperbarui.

Provider pending/gagal/tidak memenuhi kontrak tidak menahan slot selamanya:
booking dibatalkan pada deadline, record payment tetap utuh dan ID attempt
pending dicatat di riwayat timeout. Tidak menandai failed/paid secara palsu,
tidak menghapus Snap/payment, tidak membuat charge pengganti. Webhook atau sync
existing dapat merekonsiliasi kredit setelah itu; booking terminal tidak dihidupkan.
Tidak menambahkan worker rekonsiliasi transaksi terminal/refund baru pada F8.

**Keputusan user pada sesi ini:** seluruh DP terverifikasi pada pembatalan sistem
karena timeout dibuatkan permohonan refund100% tanpa batas jarak jadwal, termasuk
DP yang diverifikasi setelah pembatalan sistem. Tetap PENDING_APPROVAL, hanya
ADMIN dapat menyetujui lewat flow existing. Tidak mengirim refund otomatis.
Alokasi dan kunci sumber existing mencegah permohonan ganda. DP yang dibayar
setelah deadline tetap mengikuti penanganan kredit/refund-request existing.

NO_SHOW menghanguskan DP, mempertahankan kredit uang, tidak membuat refund atau
invoice palsu dan menghentikan kewajiban sisa pelunasan. CHECKED_IN/IN_SERVICE
tidak NO_SHOW. Route manual NO_SHOW operator existing tetap tersedia dengan
kontrak sebelumnya; aturan otomatis baru menggunakan tenggang15 menit.

OVERDUE tidak memblokir akun/pembayaran, tidak membuat refund, tidak membatalkan
COMPLETED. Midtrans dan kasir Project3/4 tetap dapat melunasi; PAID/balance nol
dan invoice final memakai domain ledger existing. Riwayat overdue tetap ada.
Dalam race pembayaran, histori hanya dapat mencatat saldo yang masih positif
pada saat transaksi scanner memperoleh lock, bukan sesudah pembayaran commit.

## Runtime, recovery, logging dan shutdown

Runner didaftarkan sekali oleh server.ts setelah HTTP listen. Import app.ts
oleh test HTTP tidak menjalankan scanner. Development npm run dev tetap build
watch + node --watch dist/server.js; process replacement membaca database lagi.
Production npm start menjalankan runner yang sama. Multiple instance boleh scan
bersamaan; lock/validasi transaksi mencegah transisi/riwayat/ledger ganda.

Scan langsung saat startup, lalu default15.000 ms **setelah scan sebelumnya
selesai**; tidak menumpuk scan dalam satu proses. Kandidat dipaginasi100 record
per halaman sampai selesai sehingga lebih dari100 kandidat tidak starvation.
Evaluasi dapat terlambat sebesar interval, durasi scan dan penantian provider
(timeout SDK existing15detik); deadline tidak diubah menjadi waktu scan.

Pengaturan opsional (tidak menyunting .env otomatis):

- SCHEDULER_BOOKING_AKTIF=true default bila tidak diisi; false menonaktifkan runner.
- SCHEDULER_BOOKING_INTERVAL_MS=15000 default; integer1000 sampai60000.

Error satu record diisolasi; kandidat lain diteruskan, record gagal dicoba scan
berikutnya. Tidak ada recursive retry/hot loop. Log JSON berisi kejadian/job,
booking ID teknis, deadline/hasil saat tersedia, kode error tersanitasi, jumlah
kandidat/berhasil/gagal. Tidak memuat customer PII, raw payload, JWT, password,
credential atau Snap token. SIGINT/SIGTERM menutup HTTP, menghentikan timer,
menunggu pekerjaan scanner sebelum disconnect DB. Grace shutdown30detik.

## Bukti pengujian aktual

Suite `node scripts/test-scheduler-booking.mjs` PASS26 kelompok pada database
PostgreSQL lokal dengan fixture acak, clock injectable dan provider MOCK.
Tidak memakai credential merchant nyata. Subprocess backend benar-benar listen
dan HTTP200; restart/catch-up, dua proses dan graceful shutdown exit0 diuji.

| Pengujian scheduler | Hasil |
|---|---|
| Pending29 menit, batas-1ms, tepat30, lewat30, slot release | PASS |
| Dua runner, scan ulang dan riwayat terminal tunggal | PASS |
| Confirm sebelum deadline / already confirmed | PASS |
| ADMIN confirm / STAFF reject versus timeout tepatdeadline | PASS |
| DP sebelum/saat deadline, provider pending, histori/record retained | PASS |
| GetStatus settlement tepatwaktu tanpa webhook | PASS MOCK |
| Provider gagal, webhook terlambat/duplicate, satu kredit/refund-request100% | PASS MOCK |
| Webhook versus scanner, late settlement, tanpa hak pelayanan | PASS MOCK |
| No-show batas-1ms/tepat15, DP hangus, nol refund/sisa tagihan/invoice | PASS |
| Early check-in / CHECKED_IN / IN_SERVICE tidak NO_SHOW | PASS |
| Start service dan check-in versus scanner | PASS |
| Overdue sebelum/tepat/sesudah1jam, dua runner satu histori | PASS |
| Lunas tidak overdue; kasir/online setelah overdue tetap PAID | PASS; online MOCK |
| Kasir/webhook versus overdue; satu invoice dan histori retained | PASS MOCK/DB |
| Flow reschedule existing, DP carried, slot baru release/tidak restore lama | PASS |
| Reschedule confirmed/versi lama/versi terbaru/race scanner | PASS |
| Rollback audit serta rollback refund request/status/riwayat bersama | PASS |
| Restart, missed deadline, dua backend aktif, HTTP dan shutdown | PASS |
| Satu error tidak menghentikan kandidat lain; retry aman/log tersanitasi | PASS |
| Pagination101 kandidat / scan ulang idempotent | PASS |
| Singleton, scan berkala sesudah startup, stop/drain | PASS |
| Clock DB independen clock proses, disable runner, nol refund API call | PASS |
| Regresi F7 mock / F6 / F5 / F4 / F3 | PASS12 / 8 / 11 / 15 / 12 kelompok |
| F2 fondasi / reset password / API publik | PASS24 / 11 / 4 pemeriksaan utama |
| Kasir Project3 / kontrak HTTP Project4 | PASS pada suite F4/F6 |
| TypeScript noEmit/noUnused / build / Prisma validate/status / Git diff | PASS |
| Snapshot22 model, checksum backup, file historis dan env protection | PASS |
| UI/device Project4/5, Socket.IO, E2E seluruh aplikasi | DEFERRED, fase berikutnya |
| Refund provider historis Rp2.000 final | DEFERRED eksternal, bukan acceptance F8 |

Tes awal gagal pada preflight DP karena pembacaan timestamp di luar sesi UTC.
Perbaikan menambahkan sesi UTC pada preflight dan query scan; seluruh kelompok
terkait diuji ulang dan PASS. Tidak menonaktifkan assertion untuk menyembunyikan
kegagalan. Warning deprecation pg concurrent query existing masih muncul;
seluruh suite akhir exit0. Pesan historis F5/F6 suite tentang fase tidak menjadi
klaim status terkini. UI/browser/mobile tidak diuji pada sesi ini.

Backup baru dibuat sebelum testing memakai script backup existing, diverifikasi
pg_restore dan checksum: backup-database/f7-2026-10-14T13-16-23-299Z,
113541 bytes, SHA256235647500a7ff7f1b8fd0154661f30fb8f6ce01fd91cbe66630b02ce6696edbd.
Sesudah cleanup seluruh fixture, sidik22 model identik; 0 Booking/0 Refund lokal
dan17 Pembayaran existing tetap. Tidak reset sequence/database, tidak migration
atau mengubah data existing. Backup database tidak masuk Git/ZIP.

## File lengkap dalam ZIP

Semua path berikut berprefix barberbarbar/ relatif Stage2:

1. README-INSTALASI.md
2. server/F8-AUDIT.md
3. server/src/server.ts
4. server/src/lib/deadline-booking.ts
5. server/src/lib/scheduler-booking.ts
6. server/src/services/scheduler-booking.service.ts
7. server/src/services/booking.service.ts
8. server/src/services/operasional-booking.service.ts
9. server/src/services/midtrans-booking.service.ts
10. server/src/services/pembayaran-booking.service.ts
11. server/scripts/test-scheduler-booking.mjs
12. server/scripts/jalankan-server-uji-scheduler.mjs

ZIP hanya cadangan file lengkap yang dibuat/diubah, membutuhkan baseline di atas,
bukan aplikasi/backend baru. Checksum setiap entry dibandingkan dengan source
final. Tidak menyertakan .env, node_modules, .git, generated/dist, dump, credential
atau dua file historis dilindungi. Panduan runtime/rollback ada pada README.

## Pekerjaan terbuka dan fase berikutnya

Refund F7-REFUND-48 Rp2.000 masih pending eksternal berdasarkan hasil terakhir
Get Status pada F7-AUDIT: settlement, tanpa entri refund/bank_confirmed_at.
Record fixture lokal lama sudah dibersihkan sebelumnya. Tidak membaca/mengubah
histori provider tersebut pada sesi F8, tidak mengirim refund/retry otomatis,
tidak menambah debit ledger dan tidak mengklaim refund sukses.

F9 Socket.IO dapat dilanjutkan secara independen sesuai keputusan user untuk
melanjutkan meskipun F7 parsial. F8 menyediakan riwayat perubahan DB yang sah;
tidak menambahkan socket, notifikasi, worker refund atau UI fase berikutnya.
Ketika menambah publisher, pertahankan fakta bahwa overdue memakai status layanan
COMPLETED dan event sistem memiliki aktor null/rincian sumber SCHEDULER.

Commit/push hanya branch fitur, judul Bahasa Indonesia tanpa nama fase/prefix.
Tidak amend/force-push/merge main. Perubahan historis server/src/lib/prisma.ts
dan Project4 src/layar/LayarTambahPelanggan.tsx tetap utuh dan tidak masuk commit.
