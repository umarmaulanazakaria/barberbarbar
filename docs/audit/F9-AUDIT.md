> Dokumen historis dipindahkan dari `barberbarbar/server/F9-AUDIT.md`. Hasil dan path bukti mencatat waktu audit; panduan aktif ada di README utama dan laporan cleanup. Arsip privat kini berada di luar Stage 2.

# Audit fondasi Socket.IO dan realtime

14 Oktober 2026 (Asia/Jakarta), feature/project5-integration.
Baseline ffd5b7d04355e33c9ee0438c7ae3e60cc84249fe.
**F9 SELESAI sebagai foundation backend/harness; integrasi UI penuh belum dilakukan.**
F7 tetap PARSIAL: refund historis Rp2.000/F7-REFUND-48 pending eksternal.
Master PRD v2.0 lengkap tidak ditemukan; implementasi mengikuti prompt lengkap
pengguna, keputusan existing dan audit/source F2-F8.

## Penerapan

socket.io4.8.4 runtime dan socket.io-client4.8.4 dev dipasang setelah persetujuan.
Types bundled; tidak menambah @types, Redis, queue atau software. REST Express
dan Socket.IO berbagi HTTP server/PORT existing. Scheduler tetap didaftarkan
sekali setelah listen. Shutdown menunggu scheduler, menutup listener PostgreSQL,
socket/HTTP lalu Prisma; bind failure juga menutup helper dan exit1.

Migration additive 20261014143000_tambah_sinyal_realtime_transaksional menambah
satu fungsi dan17 trigger AFTER ROW. Tidak ada tabel/model/enum/constraint baru,
backfill atau perubahan record existing. Semua jalur mutasi, termasuk nested
Prisma, webhook, kasir dan scheduler, memakai trigger yang sama. SQL direview
sebelum deploy, tanpa DROP/TRUNCATE/ALTER TABLE.17 migrations up to date.

Backup sebelum deploy: backup-database/realtime-2026-10-14T14-37-11-813Z/database.dump,
113543 bytes; daftar objek dan rendering SQL pg_restore diverifikasi.22 model
domain identik sebelum/sesudah migration. Backup tidak masuk Git, tidak dibuat
ZIP, checksum, README-INSTALASI baru atau paket replace.

NOTIFY hanya dilepas PostgreSQL setelah commit; rollback tidak mengirimnya.
Listener dedicated per instance memakai pg existing, tanpa transaksi panjang,
retry2detik saat terputus. Semua instance mendengar channel yang sama lalu
memeriksa izin socket lokal. Error emit terjadi sesudah commit dan tidak
mengubah ledger/status. Ini bukan durable outbox/replay atau guaranteed delivery.
[Semantik NOTIFY PostgreSQL](https://www.postgresql.org/docs/current/sql-notify.html).

## Autentikasi, rooms dan payload

Handshake hanya auth {token}; tidak menerima role/userId/customerId/query token.
Verifikasi JWT HS256 existing. CUSTOMER wajib tipe CUSTOMER, ID akun, status
AKTIF dan sidik kredensial F2 cocok. Operator wajib JWT ADMIN/STAFF, record/role
DB masih cocok, STAFF mempunyai barber aktif. Kedua jenis tidak saling dianggap.
Token tidak dicatat atau dikembalikan melalui event.

Koneksi aktif diperiksa setiap1detik, sebelum event dan subscription. Blokir,
reset password CUSTOMER, role/deletion operator atau expiry memutus koneksi.
Hash operator saat connect juga dibandingkan untuk pencabutan koneksi aktif
ketika password berubah. JWT operator existing tidak mempunyai versi kredensial:
reconnect mengikuti validitas JWT REST existing; tidak mengubah alur token
ADMIN/STAFF atau mengklaim pencabutan global token operator setelah ganti password.

| Room | Akses |
|---|---|
| customer:{pelangganId} | Identitas CUSTOMER hasil verifikasi, hanya milik sendiri |
| operator:all | ADMIN/STAFF hasil verifikasi DB |
| operator:admin | ADMIN saja, sesuai REST keputusan/refund/pengaitan |
| booking:{id} | Subscription setelah owner CUSTOMER atau izin operator diverifikasi |
| catalog:authenticated | Semua socket terautentikasi, ID katalog publik saja |

booking.subscribe/unsubscribe menerima hanya {bookingId}, ack hanya {berhasil}.
IDOR/nonexistent sama-sama false, tidak membocorkan keberadaan. Subscription
idempotent, maksimal54 room total termasuk room internal. Unsubscribe tetap
bisa saat penuh. room.join ditolak. Room booking opsional; perubahan owned
customer tetap masuk own-room. Disconnect melepas room lewat Socket.IO.

Payload publik setiap *.changed hanya {id, aksi, versi, waktu, refetch:true}.
Owner/operator audience hanya metadata internal NOTIFY, dibuang sebelum emit.
Tidak mengirim nama, email, telepon, uang, password/hash, Snap token atau full
webhook. versi adalah transaction ID opaque, bukan angka versi resource untuk
mengganti state client. REST/PostgreSQL tetap authoritative.

## Kontrak event

| Event | ID / aksi relevan / refetch |
|---|---|
| booking.changed | Booking ID; status, CONFIRM/REJECT/CANCEL/RESCHEDULE, PROPOSE/ACCEPT/REJECT_BARBER, CHECK_IN/START/CHANGE_SERVICES/COMPLETE, TIMEOUT_CONFIRMATION/TIMEOUT_RESCHEDULE/TIMEOUT_DP, AUTO_NO_SHOW, PAYMENT_OVERDUE; slot/list/detail booking |
| order.changed | Pesanan ID; status/payment/items; operator orders/order/dashboard/reports |
| payment.changed | Booking ID; DP/PELUNASAN/REFUND_{status}, INVOICE_FINAL; own payments/invoice dan operator kasir |
| membership.changed | Pelanggan ID; PENDING_APPROVAL/APPROVED/REJECTED, ACTIVE/INACTIVE; own membership atau operator list |
| refund.changed | Refund-request ID; status DB aktual; ADMIN dan customer pemilik, bukan STAFF |
| customer.changed | Pelanggan ID; CREATED/UPDATED/ACCOUNT_CHANGED; own profile dan daftar operator |
| account-link.changed | Permohonan ID; keputusan/status; ADMIN saja |
| catalog.changed | ID layanan/barber; jenis pada aksi; services/barbers aktif |

DELETED berarti refetch/remove cache. Riwayat/row dapat memberi beberapa aksi
nyata dalam satu commit; listener dedup {versi,jenis,id,aksi} dengan cache bounded.
Update metadata provider saja tidak memberi DP/refund sukses baru. Webhook
duplicate tidak memberi kredit atau sinyal settlement ganda.202 tetap PROCESSING;
refund SUCCEEDED hanya mencerminkan state sah yang ditulis domain F7.

realtime.ready {protokol:1,refetch:true} muncul setelah connection/listener ready
dan setelah listener pulih. Client wajib refetch authorized REST; tidak memakai
payload sebagai snapshot keuangan atau izin. Helper scripts/klien-realtime.mjs
memasang listener sekali, SDK reconnect otomatis, refetch saat ready/foreground,
dedup bounded dan cleanup. Setelah server-disconnect karena akses dicabut,
aplikasi harus reauthenticate/logout; jangan retry token invalid tanpa batas.

SOCKET_ALLOWED_ORIGINS opsional, daftar origin exact dipisah koma. Default
http://localhost:5173,http://127.0.0.1:5173; origin lain ditolak pada WebSocket
dan polling melalui allowRequest. Native tanpa Origin tetap wajib JWT. .env
tidak disunting dan tetap ignored/untracked. Browser deployment memerlukan
origin yang sesuai. Client Web/Mobile belum dipasang dependency/integrasi UI.

## Reliability dan batas deployment

PostgreSQL fan-out sudah diuji dua instance, walaupun adapter rooms lokal tetap
in-memory. Tidak membutuhkan Redis. Event hilang saat offline/listener restart
tidak di-replay: reconnect/ready dan REST refetch memperbaiki state. Adapter
ini tidak menyediakan connection-state recovery antar instance. Jika memakai
load balancer dan HTTP polling, perlu sticky sessions; belum menguji topologi
load balancer nyata. WebSocket, polling, dua listener dan transport restart
lokal diuji. [Delivery Socket.IO](https://socket.io/docs/v4/delivery-guarantees/),
[multi-node](https://socket.io/docs/v4/using-multiple-nodes/).

Payload kecil dan listener tidak menahan transaksi, tetapi NOTIFY queue penuh
dapat menggagalkan commit menurut PostgreSQL. Monitor queue pada deployment;
tidak mengklaim kegagalan database tidak mungkin. Tidak ada event sukses ketika
commit gagal. Tidak menambah worker refund/retry otomatis.

## Pengujian aktual

node scripts/test-realtime.mjs: **23 kelompok PASS**, provider MOCK. Mencakup:
JWT/role/ownership/origin, WebSocket/polling, subscription penuh, semua domain
event, commit barrier/rollback, duplicate webhook, dua instance, reconnect SDK,
foreground/offline REST refetch, LISTEN failure/recovery, emit failure, active
block/reset/role/expiry, restart/cleanup dan occupied-port exit1. Regresi12
kelompok F7 ikut dijalankan sebagai subprocess; event bank-confirmed SUCCEEDED
diamati pada refund dummy, tidak pada refund historis.

| Pemeriksaan akhir | Hasil |
|---|---|
| Realtime security/events/reliability | PASS23 kelompok |
| F8 scheduler, termasuk startup/shutdown dua backend entrypoint terbaru | PASS26 kelompok |
| F7 Midtrans/refund contract | PASS12 kelompok MOCK, bagian suite realtime |
| F6 / F5 / F4 / F3 | PASS8 / 11 / 15 / 12 kelompok |
| F2 fondasi / reset / public | PASS24 / 11 / 4 checks utama |
| Kasir Project3 / kontrak HTTP Project4 | PASS melalui suite F4/F6 |
| TypeScript noEmit/noUnused, build, Prisma validate/status, Git diff check | PASS |
| Cleanup fixtures / snapshot22 model / file historis | PASS |
| Refund Rp2.000 historis provider final | DEFERRED eksternal; tidak diperiksa/diubah pada tugas ini |
| UI Web/Mobile/Customer, device/E2E/load-balancer nyata | DEFERRED tahap integrasi berikutnya |

Kegagalan awal harness: path profile keliru (/profile versus /me), cleanup
fixture tertahan FK permohonan membership, dan asumsi bentrok loopback IPv4/IPv6
Windows. Diperbaiki pada harness; fixture gagal diidentifikasi UUID + akun
example.invalid dan dibersihkan atomik. Semua23 kelompok retest PASS, snapshot
existing identik. Startup failure backend juga diperbaiki agar listener berhenti,
bukan meninggalkan proses hidup. Warning deprecation pg existing masih muncul.

npm audit terbaru:14 package terdampak (5 moderate/9 high/0 critical), rantai
Prisma/ESLint existing; socket.io/socket.io-client tidak tercantum. Tidak ada
audit fix --force/upgrade mayor. Ini tetap risiko dependency yang perlu ditinjau,
bukan klaim seluruh stack siap Production atau bebas kerentanan.

## File dan Git

Diubah: server/package.json, server/package-lock.json, server/src/server.ts.
Dibuat: src/realtime/autentikasi.ts, src/realtime/server.ts (di bawah server),
scripts/klien-realtime.mjs, scripts/test-realtime.mjs, migration di atas dan
server/F9-AUDIT.md. Project3 client/Project4 tidak diubah. Kedua file historis
dilindungi tetap tidak diedit/stage/commit oleh tugas ini. Prisma historis sudah
staged sebelum pekerjaan; commit hanya path realtime dengan --only sehingga
index historis tetap dipertahankan. Tidak amend/force-push/merge main.

Menjalankan: npm.cmd run build lalu npm.cmd start (atau npm.cmd run dev).
Checkout lain: backup DB, review SQL, npm ci dan prisma migrate deploy seperti
workflow existing; tidak perlu prisma generate karena model tidak berubah.
Rollback hanya lewat migration pembalikan terpisah yang direview: hapus17
trigger/function baru, pertahankan semua record. Tidak drop schema/reset DB atau
mengedit migration yang sudah applied. F10 dapat menghubungkan AuthContext dan
React Query existing ke kontrak di atas; F11/F12 tetap belum diimplementasikan.
