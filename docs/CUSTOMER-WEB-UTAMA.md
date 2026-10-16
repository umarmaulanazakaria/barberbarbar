# Customer Web utama dan pensiun Customer Native

Tanggal keputusan dan validasi: 16 Oktober 2026. React Web Customer merupakan satu-satunya aplikasi Customer aktif. Web Admin tetap React/Vite, Mobile Staff tetap React Native/Expo, dan seluruhnya memakai Express/Prisma/PostgreSQL Project 3. Tidak ada aplikasi, worktree, backend atau database baru pada pekerjaan ini.

## Audit awal dan perlindungan

Audit empat source asli mencakup status, lima commit terakhir, diff staged/unstaged, daftar worktree, package, entrypoint, route, layanan dan kontrak. Baseline: Project 3 `d32c95c`, Staff `5b22382`, Native `59def09`, Web `546c0c0`. Native dan Web sudah merupakan dua worktree dalam satu repository sebelum pekerjaan ini. Native mempunyai divergensi lokal/remote (ahead 1, behind 1); tidak di-pull atau ditulis ulang.

Perubahan historis dipertahankan: tiga path Project 3 (termasuk Prisma staged), satu path Staff, 15 path Native dan 17 path Web. Snapshot hash source/index/environment tersimpan privat di checkpoint existing `.audit-integrasi-20261016/customer-primary-baseline.json`. Tidak ada credential, PII atau nilai kode tracking dalam laporan ini. Selama pekerjaan, `Customer Web/src/layanan/guest.ts` mendapat perubahan pemformatan dari luar pekerjaan ini; file dipertahankan dan dikecualikan dari commit migrasi.

## Pemetaan fitur berdasarkan source aktual

| Fitur | Native lama | Customer Web aktif | Keputusan |
|---|---|---|---|
| Katalog | Layanan/barber publik | `Katalog`, `ambilLayanan`, hanya layanan | Sudah tersedia; barber tidak dipilih customer |
| Booking/jadwal/kapasitas | Akun, multiservice/qty, pilihan barber | `FormBooking`, `buatGuest`; nama/HP, multiservice/qty, WIB | Sudah tersedia; backend memvalidasi slot/harga |
| Detail/status | JWT CUSTOMER dan riwayat akun | `BookingTamu`, `detailGuest`, sesi HttpOnly | Sudah tersedia; satu sesi aktif pada browser, bukan daftar riwayat akun |
| DP/pelunasan | WebBrowser dan API CUSTOMER | Snap popup, `checkoutGuest`, backend balance | Sudah tersedia; DP 50%, deadline server 15 menit |
| Verifikasi Midtrans | REST/realtime setelah webhook | Signature/status provider backend; callback hanya refetch | Sudah tersedia; callback tidak menetapkan settlement |
| Tracking/pemulihan | Login/reset akun | Kode rahasia setelah DP, `LacakBooking`, pemulihan ADMIN | Sudah tersedia; kode salah/revoked ditolak, legacy tetap didukung |
| Invoice/riwayat pembayaran | Milik akun | Endpoint final guest, transaksi per booking | Sudah tersedia; invoice harus COMPLETED dan PAID |
| Sinkronisasi | Socket.IO/AppState | Socket.IO guest terotorisasi, event memicu REST; polling 10 detik dan visibility/online sebagai fallback | Integrasi lanjutan tersedia; lihat [audit Socket.IO/Midtrans](INTEGRASI-SOCKET-MIDTRANS.md) |
| Error/jaringan/sesi | Axios/SecureStore | Timeout, pesan aman, kunci submit/idempotency, cookie HttpOnly | Sudah tersedia; retry bukan bukti pembayaran |
| Akun/profil/password | Registrasi/login/pengaitan/profil/reset | Tidak ada akun | Khusus workflow Native; sengaja tidak dipindahkan |
| Membership | Permohonan dan diskon sesuai ADMIN | Guest tidak mendapat membership dari HP | Memerlukan keputusan bisnis bila hendak ditambahkan |
| Reschedule/pembatalan/refund mandiri | Endpoint CUSTOMER, otorisasi akun | Tidak ada aksi mandiri guest | Memerlukan aturan otorisasi dan hak guest baru; operasional ADMIN existing tetap tersedia |

Rujukan utama: Native `src/layar/{Booking,DetailBooking,Riwayat,Akun}.tsx`; Web `src/App.tsx`, `src/komponen/{FormBooking,BookingTamu,LacakBooking}.tsx`, `src/layanan/{guest,snap}.ts`; backend `src/routes/{guest-booking,tracking-booking}.routes.ts`, `src/services/{guest-booking,tracking-booking,midtrans-booking}.service.ts`.

## Perubahan yang diterapkan

- Launcher `scripts/jalankan-barberbarbar.ps1` menjalankan Web Admin 5173, Customer Web 5175 dan Expo Staff 8081. Expo Customer 8082 dikeluarkan dari launcher default. Proses existing tidak dihentikan otomatis.
- README Native menandai pensiun dan mengarahkan ke Web; source, Git, build dan instruksi reproduksi arsip tetap utuh.
- README utama/backend, panduan menjalankan dan README Web mengacu pada sesi/tracking terkini. Panduan historis diberi penanda agar instruksi Native/token lama tidak menjadi default.
- Suite browser baru membuka entry aplikasi aktual pada delapan viewport, memeriksa checkout/status/tracking/invoice tanpa memakai entry pratinjau. Seluruh API pada suite ini diintersepsi; mock tidak ditambahkan ke UI publik.
- Suite pratinjau existing tetap hanya fixture pengujian mode test dan mengecualikan suite aplikasi utama. Tidak ada perubahan harga, ledger, webhook, schema, migration, environment atau kontrak API.

Tidak perlu menulis ulang booking/payment Web: fitur inti sudah tersedia dan kembali dibuktikan oleh pengujian integrasi.

## Hasil validasi pekerjaan ini

| Pemeriksaan | Hasil dan batas bukti |
|---|---|
| Customer Web TypeScript dan build production | PASS; 39 modul, tanpa fixture pratinjau pada entry publik |
| UI aplikasi aktual 320/360/375/390/412/430/768/1440 | PASS: beranda, form, tracking, detail, pembayaran dan invoice; tanpa overflow/pageerror/console error |
| UI DP pending/failed/expired dan batas waktu lewat | PASS: tidak dianggap terverifikasi, tidak menerbitkan kode; checkout hilang setelah deadline |
| UI DP verified dan PAID/invoice | PASS dengan respons fixture authoritative; bukan bukti provider nyata |
| Timeout/503, double-submit dan retry | PASS pada Web aktif; semua POST booking diintersepsi, draf dan kunci idempotency dipertahankan |
| Readiness utama dan proxy | PASS read-only: lima layanan, availability backend dan proxy Web HTTP 200, tersedia=true |
| Regresi UI existing | PASS: 14 tes fixture/pratinjau terisolasi |
| Booking satu/multi layanan, qty, jadwal, kapasitas dan race/idempotency | PASS: 12 kelompok guest HTTP/PostgreSQL, termasuk guest vs Native dan walk-in |
| Tracking benar/salah, revoked, sesi expired, recovery ADMIN dan legacy | PASS: 13 kelompok HTTP/PostgreSQL; data finansial tetap identik saat rotasi |
| Browser Web hingga invoice | PASS: backend/DB fixture, DP 50%, deadline 900.000 ms, callback palsu tidak confirm, settlement MOCK, tracking/session recovery, lifecycle, pelunasan, replay: dua kredit dan satu invoice |
| Midtrans/refund dan ledger kasir | PASS: 17 kelompok Midtrans MOCK dan 8 kelompok pembayaran |
| Admin browser lintas aplikasi | PASS: 11 kelompok, lifecycle sampai invoice dan realtime/REST |
| Mobile Staff adapter/realtime/kasir | PASS: 10 kelompok; percobaan sandbox awal gagal akses baca esbuild, pengulangan dengan izin eksekusi yang sesuai lulus |
| Admin production build | PASS; peringatan ukuran chunk dan anotasi Zod existing |
| Backend build dan Prisma validate | PASS; tidak menjalankan migration |
| Staff TypeScript dan Native arsip TypeScript | PASS melalui compiler existing; tidak mengubah source aplikasi |
| Syntax PowerShell launcher | PASS; proses aplikasi utama tidak di-restart untuk mencoba launcher |
| Lint | NOT RUN: Customer Web belum menyediakan konfigurasi/script lint |
| Pembayaran/refund provider nyata baru | NOT RUN: tidak diotorisasi pada pekerjaan ini; MOCK bukan settlement Sandbox nyata |
| Perangkat fisik | NOT RUN: viewport browser/adapter bukan Android acceptance |

Semua mutasi integrasi diarahkan oleh runner privat existing ke database fixture loopback `bb_guest_20261016_<8hex>`, berbeda dari database utama. Fixture dibersihkan oleh pemilik suite dan snapshot/count diverifikasi sesuai harness. Database utama tidak digunakan untuk mutasi pengujian. Pengguna telah mengonfirmasi sedang menguji aplikasi utama saat audit sebelumnya; penambahan data dari pengujian tersebut dipertahankan, tanpa rollback atau pembersihan.

## Status pensiun dan batas migrasi

Pensiun pada tingkat aplikasi aktif/default launcher dan dokumentasi telah diterapkan. Tidak ada endpoint CUSTOMER, data akun/member, transaksi, invoice, source, Git history atau backup yang dihapus. Backend masih menyediakan JWT CUSTOMER, membership, reset password/deep link dan kontrak Native; sejumlah runner regresi tetap memakai SDK Native untuk menguji kompatibilitas. Proses Native yang sudah dijalankan pengguna tidak dimatikan oleh perubahan launcher.

Alur guest utama telah terverifikasi pada browser + backend/DB fixture. Bukti pembayaran Sandbox nyata historis booking 3745 berada pada `server/WEB-FINALIZATION.md`; tidak diverifikasi ulang dan tidak dipakai untuk mengklaim transaksi baru. Pengujian perangkat dan provider baru tidak termasuk hasil PASS pekerjaan ini. Penghapusan source/kontrak lama, membership guest, daftar riwayat lintas booking tanpa akun, dan aksi reschedule/refund mandiri memerlukan keputusan terpisah.

Hanya commit lokal dengan path eksplisit. Tidak ada push, merge, PR, instalasi dependency, deploy, reset database atau perubahan migration.
