# Audit sistem dan regresi akhir

16 Oktober 2026, WIB. Source pada empat project asli. Tidak ada clone/worktree baru, migration baru, reset, perubahan environment, instalasi, push, merge, PR atau transaksi provider nyata oleh audit ini.

## Baseline dan perlindungan

| Repository | Branch | HEAD awal | Perubahan existing |
| --- | --- | --- | --- |
| Project 3 | feature/project5-integration | 263ab85 | Prisma staged, RingkasanBookingDashboard dan F10-AUDIT unstaged |
| Mobile Staff | feature/project5-integration | 5b22382 | booking.ts unstaged |
| Native Customer | feature/project5-integration | 38e3fce | 15 file unstaged |
| Customer Web | feat/project5-react-web-mobile-first | d59549e | 17 file unstaged: 11 historis dan 6 perubahan bersamaan |

Checkpoint privat `final-system-baseline.json` mencatat HEAD/branch, hash tracked files, staged patch dan hash environment. Isi dua file Native yang akan ditambal juga dicadangkan sebagai checkpoint. File historis lain dipertahankan byte-identik. Untuk dua file Native, verifikasi membandingkan source akhir dengan source awal ditambah tepat patch yang disetujui; pemformatan dan fungsi existing tidak ditimpa.

## Bug yang direproduksi dan diperbaiki

1. **TypeScript Native Customer:** tiga TS2339 di DetailBooking.tsx:157,159,267. Tipe Booking tidak memiliki alasanPenolakan, sedangkan Ringkasan tidak memiliki pembayaranPercobaan. Backend mengirim field tersebut melalui kolomBooking dan bacaRingkasanPembayaran. Perbaikan hanya menambah `alasanPenolakan?: string | null` dan `pembayaranPercobaan?: boolean` pada src/tipe.ts:44,85; tidak menutupi error dengan any atau mengubah workflow Native.
2. **Tes dropdown Native:** assertion regex mengharapkan `<PilihanBerpencarian ` satu baris sehingga salah menghitung nol komponen pada JSX beberapa baris. Tes kini memeriksa AST TypeScript: tepat dua pemakaian pada LayarBooking/LayarJadwalUlang, binding draf barber dan callback, serta prop loading/error/retry/disabled. Kontrol negatif memastikan dropdown hilang, binding salah dan JSX dalam komentar ditolak. Dua format whitespace diterima. Hasil: 12 kelompok PASS, tanpa menonaktifkan assertion.
3. **Tes browser lintas project usang:** selector mencari nomor booking dan label Cari booking dari daftar Booking Pelanggan lama. UI aktif sudah memakai daftar Pesanan ringkas. Tes diperbarui memakai href detail dengan ID booking sebenarnya dan label Cari pesanan; pemeriksaan HTTP, state, fokus, lifecycle dan invoice tetap dijalankan. Hasil akhir 11 kelompok PASS.
4. **Modal umum Admin tidak memiliki role/nama dialog:** ditemukan saat CRUD browser menggunakan semantic locator. Ditambahkan role=dialog, aria-modal dan aria-label judul pada komponen Modal tanpa perubahan desain atau aturan bisnis. CRUD modal/browser dan navigasi semua modul kemudian PASS.

File perubahan: Native `src/tipe.ts`, `scripts/test-pilihan-barber.mjs`; Project 3 `client/src/components/ui.tsx`, `client/scripts/test-e2e-browser.mjs`, `client/scripts/test-modul-admin-browser.mjs` dan laporan ini; Customer Web `playwright.config.ts`, `playwright.reliability.config.ts`, `tests/reliability-public.spec.ts`. Source Mobile Staff, backend runtime/keuangan dan source runtime Customer Web tidak diubah.

## Pengujian aktual

Rangkaian 26 suite existing awal menghasilkan 25 PASS dan satu FAIL pada selector browser usang. Sesudah perbaikan, pengulangan browser lintas project PASS 11 kelompok. Suite lain sudah PASS terhadap patch Native yang sama. Pengulangan browser terakhir sesudah perbaikan modal juga PASS; tidak menyatakan kegagalan awal sebagai hasil final.

| Lingkup | Hasil dan bukti |
| --- | --- |
| Native TypeScript | PASS setelah dua field DTO ditambahkan |
| Native dropdown | PASS 12 kelompok, termasuk kontrol negatif AST |
| Native integrasi | PASS 14 kelompok: sesi/login/register, booking/barber, keputusan Staff, pembayaran, membership, realtime dan reset melalui adapter/provider mock |
| Native detail/draf reschedule | PASS; alasan penolakan, indikator percobaan, return checkout dan draf bertahan saat refetch |
| Native Android bundling | PASS, Expo export: 1074 modules, bundle Hermes dan 37 aset |
| Staff TypeScript/integrasi | PASS; 10 kelompok adapter mencakup sesi, API order/booking/payment dan realtime |
| Staff Android bundling | PASS, Expo export: 990 modules, bundle Hermes dan 37 aset |
| Kedua Expo install --check | PASS terhadap metadata offline; CLI menyatakan pemeriksaan offline tidak menjamin metadata terbaru |
| Backend build/TypeScript | PASS |
| Web Admin TypeScript/Vite build | PASS setelah perubahan modal; warning bundle >500kB dan annotation Zod existing tetap ada |
| Customer Web TypeScript/Vite build | PASS setelah penambahan suite reliability |
| Prisma validate / migrate status | PASS; 21 migration sudah applied, database schema up to date; tidak menjalankan migration |
| npm ls --depth=0 | PASS untuk kelima package (backend, Admin, Staff, Native, Web Customer); package/lock tidak berubah |
| Fondasi customer, reset dan penutupan akun | PASS; autentikasi/otorisasi, konflik/concurrency, status blokir, profile ownership, reset sekali, hash/sesi dan respons umum |
| Membership | PASS 12 kelompok; benefit/keputusan customer dan kompatibilitas operator |
| Booking/kasir foundation | PASS 15 kelompok; validasi waktu/kapasitas, concurrency dan walk-in legacy |
| Operasional booking | PASS 11 kelompok; operasi dengan DP sah juga diperiksa suite pembayaran dan browser lintas project |
| Pembayaran/ledger/invoice | PASS 8 kelompok; nominal DB, rollback, saldo dan kasir legacy |
| Midtrans/refund | PASS 17 kelompok provider mock; pending/failed/expired/late/replay, bukti, rekonsiliasi dan refund tanpa kredit/debit ganda |
| Scheduler | PASS 27 kelompok; batas waktu, restart, multiprocess dan race; tanpa refund provider otomatis |
| Realtime | PASS 23 kelompok; event, scope akses, reconnect, shutdown dan pemulihan REST |
| Pesanan terpadu | PASS 9 kelompok; hari WIB, Native/Web/walk-in, mendatang, dedup, pagination, filter, metric dan DTO |
| Tracking/session | PASS 13 kelompok; eligibility DP, random/hash/enkripsi, scoped access, Origin/cookie, expiry, rotasi ADMIN, race dan rate limit |
| Guest/Native coexistence | PASS 12 kelompok; guest auto-confirm, Native tetap keputusan Staff, ledger/lifecycle/invoice, DTO waktu dan Socket→REST |
| Batas reschedule | PASS; batas satu jam dan jadwal tujuh hari |
| Payment-check helper, proxy webhook dan log safety | PASS; dedup/cooldown/recovery, route forwarding ketat, error/log tanpa credential, listener ditutup saat crash |
| Browser lintas Native/Admin/Staff | PASS 11 kelompok; approval membership, dialog keyboard/fokus, confirm, DP mock, barber/start, edit layanan, pelunasan/invoice, reject, refund202 tanpa retry, responsive/logout |
| Browser modul Admin tambahan | PASS 10 kelompok; CRUD pelanggan/barber/layanan/membership melalui API, akun STAFF, validasi/role, walk-in sampai invoice, guard penghapusan riwayat, 10 halaman, CRUD layanan melalui modal/keyboard dan viewport1440/1024/768/390 |
| Browser dashboard/Pesanan | PASS 9 kelompok; Hari Ini/Mendatang, pencarian/filter/pagination, detail booking/walk-in, history, Socket lintas tab, responsive dan perpindahan hari WIB |
| Browser fixture antarmuka Customer | PASS 14 tes, diulang setelah konfigurasi suite baru; mode test terpisah dari aplikasi publik |
| Browser guest/tracking Customer | PASS satu skenario penuh: tanpa akun/barber, DP50%, deadline15menit, callback palsu, settlement fixture, kode/copy, sesi ulang, Staff complete, pelunasan/invoice, replay, akses baru, legacy dan 320–1440px |
| Browser reliability pada5175 | PASS; timeout jaringan sintetis/503, draf bertahan, submit kedua diblokir dan retry memakai kunci request yang sama. Semua POST booking diintersepsi, tidak diteruskan ke database utama |
| Smoke aplikasi utama5173/5175 | PASS read-only: dashboard mendatang, form booking/katalog aktual, kesiapan aktif, tracking invalid dan desktop/mobile tanpa overflow |
| Android fisik / emulator | NOT RUN; adb devices kosong dan emulator -list-avds kosong |
| Settlement/refund provider nyata baru | NOT RUN; seluruh pembayaran tes menggunakan provider mock |
| ESLint | NOT RUN; tidak ada konfigurasi/script aktif yang ditemukan, tidak memasang tool baru |

Tidak ada error JavaScript tak terduga pada browser yang diuji. Respons error yang disengaja (400/401/403/404/409/429/503) merupakan skenario negatif, bukan kegagalan request yang disembunyikan. Tidak mengklaim semua kemungkinan bug, semua tombol pada perangkat, atau kepatuhan aksesibilitas lengkap sudah teruji.

## Database dan aktivitas bersamaan

Semua suite mutasi dijalankan melalui wrapper yang mengganti DATABASE_URL ke database fixture existing `bb_guest_20261016_*`, memeriksa target berbeda dari database utama, dan memakai credential provider palsu. Suite tidak dijalankan paralel pada fixture yang sama. Cleanup suite lolos, termasuk pemeriksaan 24 model fixture kosong.

Snapshot awal/akhir utama tidak identik secara keseluruhan: Booking11→13, satu Pesanan dan satu Invoice baru serta transaksi/bukti terkait. Pemeriksaan read-only menemukan dua booking AKUN id3750/3751 yang dibuat pada20.06/20.17 WIB selama audit. Riwayat menunjukkan konfirmasi, pembayaran dan lifecycle; identitas, credential dan payload provider tidak dicetak. Tidak ada data tersebut dihapus, dibayar ulang atau dipulihkan.

Perbandingan tambahan hanya pada hasil SELECT, dengan mengecualikan booking yang DIBUAT setelah checkpoint serta graph record turunannya, menghasilkan **25/25 tabel baseline identik**, termasuk seluruh record lama. Ini bukan penghapusan atau pemalsuan snapshot penuh. Sumber aktivitas paralel dimintakan konfirmasi pengguna; sebelum ada jawaban, asalnya tidak diklaim pasti. Status konfirmasi tersebut tidak mengubah hasil bahwa record lama tetap identik.

Migration/schema, environment dan data existing tidak diubah oleh perbaikan. Backup database dan bukti Sandbox historis dipertahankan. Kesiapan guest tetap true setelah build/reload backend; aktivasi tersimpan dalam environment lokal existing, bukan variabel proses sementara. API publik kedua Mobile sesuai origin lokal192.168.1.9:3000 dan IP Wi-Fi komputer saat audit.

## Git dan batas kesimpulan

Native: commit parsial dibuat dari HEAD ditambah dua field dan perubahan AST saja; perubahan format/user existing tidak masuk index. Kandidat patch test yang akan di-commit juga diuji langsung melalui stdin dan PASS12 sebelum commit. Commit Native: `59def097346ce322c0756d695f01ffcaed96da99`.

Project 3 memakai daftar file eksplisit dan commit --only agar staging Prisma tetap identik. Customer Web hanya memasukkan konfigurasi dan tes baru, bukan17 perubahan historis. Tidak ada commit di Staff karena source tidak berubah. Hash environment/package/lock, file protected dan staging historis diverifikasi ulang.

Kesimpulan: dua kegagalan Native terselesaikan dan seluruh regresi yang dijalankan akhirnya PASS. Acceptance Android fisik serta transaksi provider baru tetap NOT RUN, sehingga hasil ini bukan pernyataan bahwa seluruh sistem bebas kendala atau siap Production. Warning dependency/build existing tidak ditutupi dengan upgrade, menonaktifkan compiler atau perubahan aturan finansial.
