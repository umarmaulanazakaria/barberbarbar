> Dokumen historis dipindahkan dari `barberbarbar/F10-AUDIT.md`. Hasil dan path bukti mencatat waktu audit; panduan aktif ada di README utama dan laporan cleanup. Arsip privat kini berada di luar Stage 2.

# Integrasi Web Management dan realtime

14 Oktober 2026, branch feature/project5-integration.
Baseline ac7b7485f109a6ad740d944e7ac4ac3cba115821.

**F10 PARSIAL untuk acceptance akhir:** implementasi Web dan pengujian
komponen/integrasi/regresi lulus; browser E2E masih DEFERRED. Tidak menyatakan
seluruh interaksi UI telah lulus dari hasil build/render server-side.
Master PRD v2.0 lengkap tidak ditemukan. Acuan adalah prompt pengguna lengkap,
keputusan existing, kontrak source aktual dan laporan F2–F9.

## Audit awal dan dependency

React19, React Query5, Router6, Axios, Zod, Lucide, Tailwind dan context auth/toast
sudah tersedia. Tidak membuat aplikasi baru atau memakai library state/UI lain.
socket.io-client belum tersedia di client; versi4.8.4 dipasang setelah persetujuan
pengguna. client/vite.config.ts menambah proxy /socket.io dengan ws:true menuju
backend127.0.0.1:3000, mempertahankan proxy /api dan port5173.
Tidak menyunting .env, menambah credential/config rahasia, software atau migration.
Deploy production tetap membutuhkan reverse proxy /api dan /socket.io pada origin
Web yang sama; konfigurasi deployment itu belum diuji pada task ini.

## Implementasi

- /bookings: daftar, pencarian, filter termasuk pending/terminal, riwayat timeout
  dan reschedule; /bookings/:id: detail customer, snapshot, jadwal WIB, durasi,
  preferensi/disetujui/final barber, deadline, riwayat/proposal dan pembayaran.
- ADMIN/STAFF confirm/reject (alasan wajib), check-in awal dengan DP terverifikasi,
  usulan pengganti, penentuan barber final, IN_SERVICE, layanan/qty aktual dan
  COMPLETED. Usulan PENDING menahan start; keputusan hanya dilakukan CUSTOMER.
  Reschedule tetap oleh CUSTOMER; operator mengonfirmasi ulang round terbaru.
  Deadline pending dihitung dari created/riwayat RESCHEDULE terakhir, 30menit;
  UI hanya gate awal, clock/status/prasyarat backend tetap menentukan keputusan.
- Tagihan memakai REST ledger: snapshot discount, DP, net paid, balance, excess,
  transaksi, OVERDUE, invoice sementara/final. Tidak menerima DP manual. Kasir
  pelunasan hanya COMPLETED, DP terverifikasi, saldo positif dan tanpa pelunasan
  online pending. Kunci idempotensi dan body dipertahankan pada hasil ambigu;
  respons validasi eksplisit400/401/403/404 dapat membuka koreksi input. Backend
  mengunci transaksi dan menghitung nominal authoritative.
- Pesanan linked booking mendapat tambahan opsional booking{id,nomorBooking}
  pada response existing orders; tidak mengubah field lama, endpoint/status/
  autentikasi operator. Modal order mengarahkan operasi/payment booking ke detail
  booking. PaymentModal legacy menolak linked booking. Walk-in tetap flow existing.
- Dashboard mempertahankan metrik kasir lama, menambah jumlah pending/confirmed/
  checked-in, lima booking terbaru dengan DP/status pembayaran/balance REST;
  ADMIN melihat jumlah pengajuan membership/refund dan refund PROCESSING.
- /refunds hanya ADMIN: nominal/alasan, created/decision time, catatan keputusan,
  status dan kode provider; approve/reject dengan catatan wajib, retry manual
  hanya APPROVED/FAILED dengan konfirmasi. PROCESSING tidak menyediakan retry;
  UNSUPPORTED menyatakan perlu kebijakan manual, tanpa menampilkan sukses palsu.
  Riwayat yang ditampilkan sesuai data REST available, bukan rekonstruksi audit
  provider atau entri ledger frontend. Refresh mengambil status database lokal.
- Panel membership ADMIN existing tetap dipakai; pendaftaran operator dan diskon
  existing dipertahankan. Customers menambah panel pengaitan ADMIN, dengan daftar
  aman dari REST, keputusan dan catatan; STAFF tidak memuat panel keputusan.

## Socket dan cache

Satu effect per identitas/token setelah auth siap. Token hanya auth{token}, bukan
URL. Logout/ganti akun/storage/unmount melepas listeners, timer, koneksi dan auth
socket. Response /auth/me lama dibatalkan/dijaga agar tidak memulihkan akun lama.
StrictMode cleanup tidak meninggalkan listener dari mount sebelumnya.
SDK reconnect otomatis. connect/realtime.ready (termasuk recovery PG LISTEN),
online dan foreground memulihkan query operator yang diketahui. Tidak invalidasi
seluruh cache. Fallback30detik hanya tab visible; polling dashboard/detail existing
dipertahankan. Event dibatch100ms, dedup1000 sinyal, REST tetap authoritative.
Tidak mengisi cache domain dari payload socket. Detail order yang terkait ID
booking tidak ada dalam payload sinyal; prefix order aktif direfresh agar tidak
menebak pesananId. Query admin dikecualikan bagi STAFF.

| Event | Query utama yang diperbarui |
|---|---|
| booking.changed | bookings, booking:id, booking-payments:id, orders, order, dashboard |
| order.changed | orders, order:id, booking, booking-payments, reports, dashboard |
| payment.changed | booking-payments:id, bookings, orders, order, invoices, reports, dashboard |
| membership.changed | memberships, customers, dashboard; membership-requests ADMIN |
| refund.changed | refund-requests, booking-payments, orders, order, invoices, reports, dashboard ADMIN |
| customer.changed | customers, memberships, orders, order, bookings, booking, dashboard |
| account-link.changed | account-link-requests, customers, dashboard ADMIN |
| catalog.changed | services atau barbers berdasarkan jenis; staff-accounts ADMIN, dashboard |

Mengikuti [opsi auth/reconnect Socket.IO](https://socket.io/docs/v4/client-options/)
dan [invalidation query terarah](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation).

## Pengujian aktual

| Pengujian | Hasil | Batas bukti |
|---|---|---|
| Client TypeScript strict/noUnused dan build | PASS | Warning bundle601KB dan anotasi pure Zod; bukan error |
| Backend TypeScript strict/noUnused dan build | PASS | Perubahan produksi hanya metadata relasi booking safe |
| Prisma validate/migrate status | PASS |17migration up-to-date; tidak menjalankan migration |
| test-integrasi-web.mjs | PASS9kelompok | Logika aktual, React Query dengan REST server dummy, render SSR React; bukan browser E2E |
| F2 foundation/reset/public | PASS24/11/4kelompok | Role, races, IDOR, rate limit, hash cleanup dan kompatibilitas operator |
| F3 membership | PASS12kelompok | ADMIN-only, concurrency dan operator membership |
| F4 booking | PASS15kelompok | Kapasitas, snapshot, races, kasir Project3/kontrak HTTP Project4 |
| F5 operasional | PASS11kelompok | Foundation; gate DP dan proposal/reschedule |
| F6 payment | PASS8kelompok | Ledger/kasir/invoice, pending guard, rollback dan double payment |
| F7 Midtrans | PASS12kelompok MOCK | DP/provider evidence, lifecycle, pembayaran/refund; bukan Sandbox baru |
| F8 scheduler | PASS26kelompok | Timeout, no-show, overdue, concurrency, startup/shutdown |
| F9 backend realtime | PASS23kelompok | JWT invalid/roles, reconnect, listeners, postcommit/rollback, webhook signals dan cleanup22model |
| Browser lokal E2E | DEFERRED | CUA helper Windows gagal inisialisasi: setup refresh/helper_unknown_error |
| Visual/responsif/keyboard dan klik form browser | DEFERRED | Belum ada bukti browser; tidak diklaim dari SSR/build |
| Refund historis Rp2.000 final | DEFERRED | Tidak ada bukti final baru; F7 tetap PARSIAL |

Suite Web membuktikan batas konfirmasi/terminal/round reschedule, gate DP dan
consent, OVERDUE/payable/pending online/lunas, delapan mappings/STAFF restrictions,
event→REST→Query tanpa refresh manual, dedup/cache unrelated, invalid payload,
recovery/foreground, pergantian akun/logout/cleanup dan REST ketika socket mati.
Render React membuktikan PROCESSING tanpa retry/sukses, STAFF tanpa refund,
linked order dialihkan, walk-in tombol lama tetap, reject disabled tanpa alasan,
proposal PENDING menahan start, OVERDUE dan invoice PAID. Hook login/effect di DOM,
transport proxy dari browser dan interaksi end-to-end masih perlu browser E2E.

Percobaan awal suite F7 gagal pada fixture now+30/+60menit yang melewati23.00
saat dijalankan malam; cleanup tetap berhasil. Fixture late-cancel/no-show kini
memakai layanan dummy yang sudah lewat pada jam operasional valid, sehingga tidak
bergantung jam eksekusi. Ditambah assertion REST order linked hanya mengirim
booking{id,nomorBooking}, tanpa passwordHash. F7 dan F9 ulang lulus seluruhnya.
Tidak mengubah perilaku produksi demi fixture. Harness Web awal salah menganggap
ToastProvider tidak merender elemen ketika modal null; assertion diperbaiki,
hasil akhir9kelompok lulus. FAIL percobaan awal sudah diperbaiki; tidak ada FAIL
akhir pada suites yang dijalankan.

Fixture hanya akun/record dummy lokal, seluruh suite melakukan cleanup miliknya.
F9 memverifikasi22model existing identik sesudah cleanup. Tidak menghapus data
existing, backup atau mengirim pembayaran/refund provider nyata pada task ini.
Peringatan pg concurrent-query existing tetap muncul, exit akhir suites0.

## Dependency dan keamanan

npm audit aktual client:8paket (2moderate,6high,0critical), berbeda dari ringkasan
install yang menyebut3. Backend:14paket (5moderate,9high,0critical), sama sebelumnya.
Tidak memakai audit fix --force atau upgrade unrelated.

- source-map-js high mempengaruhi rantai PostCSS/Tailwind/Vite/plugin-react:
  processing indexed source-map berpotensi DoS. Ini tooling build/dev, bukan
  dependency runtime browser atau endpoint booking; input build harus terpercaya.
- Router moderate: open redirect dari path backslash dan SSR error hydration.
  Source memakai BrowserRouter/createRoot client, tanpa hydrateRoot/deserializeErrors;
  link baru prefix internal tetap dan ID backend, tidak menerima URL redirect user.
  Temuan tetap dicatat, bukan dinyatakan paket bebas vulnerability.
- Backend temuan Prisma tooling/ESLint/mysql2/deepmerge/URI tetap existing; runtime
  memakai PostgreSQL. Socket.IO/client tidak masuk daftar paket vulnerability.

Tidak memperluas room/event backend, membuka akses STAFF ke keputusan ADMIN,
atau mengirim credential/hash/payload authoritative dari socket. Fallback REST
dan otorisasi server tetap berlaku. Upgrade dependency major perlu audit/persetujuan
terpisah. Tidak menambah any untuk menyembunyikan kesalahan TypeScript.

## Refund lama, batas penerimaan dan Git

Refund F7-REFUND-48 Rp2.000 belum final menurut F7-AUDIT/F7-SANDBOX. Fixture lokal
ID48 sudah dibersihkan sebelum task ini; tidak dibuat kembali untuk UI. Get Status
terakhir yang tercatat hanya settlement tanpa refunds/bank_confirmed_at. Tidak
melakukan status check provider baru, retry, refund pengganti atau debit ledger.
UI menampilkan record/status lokal aktual; hasil MOCK tidak membuktikan refund lama.

Source diubah langsung, tanpa ZIP/checksum/paket replace/README-INSTALASI baru.
Project4 tidak diubah. server/src/lib/prisma.ts tetap staged historis dan dikecualikan
melalui commit --only path eksplisit; tidak di-reset/stage ulang/commit. Daftar file
commit dan hasil push/sinkronisasi dilaporkan setelah operasi Git selesai.

File implementasi: client/package{,-lock}.json, vite.config.ts, App.tsx,
AppLayout/OrderDetailModal/PaymentModal/ui, AuthContext, CustomersPage/DashboardPage,
types.ts; baru RealtimeOperator, PembayaranBooking, PermohonanPengaitanAdmin,
RingkasanBookingDashboard, BookingPage, DetailBookingPage, RefundPage,
types-booking.ts, lib/booking.ts, lib/sinkronisasi-realtime.ts,
lib/tampilan-booking.ts, scripts/test-integrasi-web.mjs; backend
src/services/pesanan.service.ts dan scripts/test-midtrans-f7.mjs; laporan ini.

Fondasi teknis untuk F11 tersedia, tetapi acceptance browser Web perlu diselesaikan
dan refund historis tetap terpisah/PARSIAL. Tidak mengerjakan Mobile Staff,
Customer App penuh, E2E lintas project atau cleanup final pada task ini.
