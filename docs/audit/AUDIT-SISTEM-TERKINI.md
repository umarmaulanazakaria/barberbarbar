# Audit sistem dan GitHub — 18 Oktober 2026

> Pembaruan remediasi keamanan: Backend **5 → 0**, Admin **2 → 2**, Staff **44 → 37**, Customer **0 → 0**; total **51 → 39** package reports, akar unik **8 → 4**. Verifikasi ulang lulus. Rincian, sisa risiko toolchain/runtime dan keputusan Router terdapat pada [laporan remediasi](REMEDIASI-KEAMANAN.md) serta [bukti JSON](REMEDIASI-KEAMANAN.json). Isi audit di bawah dipertahankan sebagai baseline historis sebelum remediasi.

**Keputusan: BELUM SIAP — ADA BLOCKER untuk penerimaan penuh.** Build dan integrasi terpilih lulus; advisory dependency belum dituntaskan, pengujian perangkat/printer/provider nyata belum diulang. Ini bukan klaim Production. Source yang diuji terpisah dari WIP lokal.

## Snapshot dan keamanan kerja

| Repository | Branch | HEAD awal | Commit belum dipush sebelum fetch |
| --- | --- | --- | --- |
| Admin/Backend | feature/project5-integration | 5a00ef8 |24|
| Staff | feature/project5-integration | b4859fc |8|
| Customer | feat/project5-react-web-mobile-first | aef2959 |7|

Commit penting 2aa195e, b4859fc, 7b4f9dd terbukti ancestor HEAD masing-masing. git fsck tidak menemukan objek rusak; dangling tree/blob bukan bukti commit hilang dan tidak dibersihkan. Reflog/branch/upstream diperiksa. Remote origin sesuai umarmaulanazakaria/barberbarbar, barberbarbar-mobile dan barberbarbar-customer. Fetch berhasil tanpa mengubah tip branch tujuan push; branch remote tambahan terdeteksi dan tidak dihapus.

Terhadap origin/main sebelum commit audit, Admin memiliki2 commit khusus main/36 khusus branch; Staff1/9; Customer0/7. Ini perbedaan riwayat yang dipertahankan, bukan direset/di-merge. Push hanya boleh fast-forward pada branch kerja setelah memeriksa SHA remote lagi. PR menuju main hanya disiapkan jika pemeriksaan konflik aman; tidak ada merge/default-branch change. Hasil SHA push/PR dilaporkan terpisah setelah eksekusi, bukan diasumsikan di dokumen pra-push ini.

WIP awal dipertahankan: Admin13 file tracked termasuk Prisma staged dan satu folder screenshot untracked; Staff4 file; Customer18 file. Hash file WIP dan diff index Prisma dibandingkan sebelum/sesudah commit audit. Tidak mengikutkan WIP finansial/refund, styling, screenshot atau perubahan lama ke commit audit. Snapshot HEAD diekspor ke temp untuk build/integrasi memakai dependency existing; tidak membuat branch/worktree baru atau reset source.

Tidak ada private .env, dump, ZIP, key atau node_modules/dist terlacak pada tiga snapshot. Ignore environment/dependency/output diperiksa. Scan pola key dikenal dan pencocokan nilai rahasia runtime pada diff commit outgoing tidak menemukan kecocokan. Ini pemeriksaan terbatas, bukan sertifikasi seluruh sejarah bebas semua jenis rahasia. Nilai credential tidak dicetak. Tidak mengubah dependency, credential, data operasional atau migration utama.

## Temuan dan perbaikan

1. **Bug quota Reguler:** batasiNomorMemberPublik memakai fallback IP saat nomor Member kosong. POST Reguler terkena batas tambahan6 meski route mempunyai batas IP 20. Reproduksi fixture menghasilkan201 / 429 pada race kapasitas yang semestinya201 / 409. Middleware kini membatasi hanya nomor Member yang ada; limiter IP route tetap aktif. Tes normalisasi kode lintas IP, kuota terpisah, Reguler dan limiter IP lulus.
2. **Build portabilitas:** tipe return middleware diekspisitkan RequestHandler. Build snapshot sebelumnya gagal TS2883 akibat inferred ParsedQs dari lokasi dependency lain; setelah koreksi build lulus.
3. **Tes lama tidak sesuai kontrak:** whitelist API layanan diperbarui untuk slotBookingMenit45; tes penghapusan pelanggan mengharapkan405sesuai penonaktifan permanen. Suite browser Customer diperbarui untuk langkah awal wizard dan slot 45.
4. **Fixture schema tertinggal:** awalnya beberapa tes gagal P2022 karena kolom baru belum ada. Dengan persetujuan eksplisit pengguna, schema fixture kosong bb_guest_20261016_b3cdb0fe dibackup custom schema-only, SHA-256 dan pg_restore --list diverifikasi; hanya3 migration tertinggal diterapkan pada fixture tersebut. Database utama tidak dimigrasikan.
5. **Cleanup fixture:** percobaan suite baru sempat tertahan FK karena urutan cleanup. Runner berhenti saat mendeteksi residu; hanya ID yang terikat penanda suite dipulihkan. Cleanup diperbaiki untuk akses guest/profil serta native Booking hasil race sebelum assertion. Run final14 suite membuktikan seluruh tabel data fixture kembali kosong dan row pengaturan hasil migration identik. Tidak memakai truncate/reset/delete global atau rollback database utama.

Suite historis test-walkin-dashboard dan test-guest-booking tidak dijadikan gerbang final: kontraknya mengasumsikan profil/diskon lama dan barber/durasi sebelum aturan terbaru. WIP suite guest tetap dilindungi. Regresi aktual memakai test-member-operasional-aktual dan test-booking-web-aktual, tanpa melonggarkan bisnis agar tes lama lulus.

## Bukti pengujian

- PASS TypeScript working tree Backend/Admin/Customer/Staff. Build Vite Admin dan Customer lulus; backend snapshot build lulus setelah anotasi tipe.
- PASS snapshot commit terpisah: build Backend/Admin/Customer; TypeScript Staff; export Android/Hermes Staff997 modul. Export bukan APK terpasang. Compiler awal diblokir sandbox; pengulangan dengan izin eksekusi existing lulus, tanpa instalasi.
- PASS Prisma validate; migrate status database utama menyatakan26 migration up to date (read-only).
- PASS28 probe HTTP in-process memakai snapshot source dan koneksi utama dipaksa default_transaction_read_only=on:12 GET ADMIN, 12 GET STAFF, 3 endpoint publik200 dan Dashboard anonymous401. Tidak melakukan login/password pengguna nyata; token audit internal untuk pembacaan saja.
- PASS14 suite backend final pada fixture lokal terisolasi, dijalankan sekuensial; provider mock/stub.
- PASS1 suite browser Customer utama pada8 viewport dengan API sepenuhnya diintersepsi. Bukan bukti provider atau seluruh langkah wizard end-to-end.

| Suite backend final | Hasil | Cakupan |
| --- | --- | --- |
| test-api-publik | PASS | Tanpa JWT, aktif saja, whitelist publik, endpoint operator terlindungi |
| test-fondasi-pelanggan | PASS | Race registrasi/keputusanADMIN, login/profil/role, blokir, reset, limiter |
| test-penutupan-akun | PASS | Identitas/password, rollback, pencabutan sesi; delivery email mock |
| test-dashboard-final | PASS |10 kelompok KPI/bukti pembayaran, aktivitas, perhatian, WIB, auth |
| test-riwayat-pesanan | PASS |10 kelompok closure, filter, pagination, DTO dan bukti finansial |
| test-detail-tindakan | PASS |10 kelompok lifecycle, kasir, QRISstub, replay/ledger/invoice |
| test-pesanan-terpadu | PASS |9 kelompok daftar lintasjenis, mendatang, filter dan realtime |
| test-tracking-booking | PASS |13 kelompok akses, cookie, recoveryADMIN, expiry dan rate limit |
| test-realtime-tamu | PASS |12 kelompok room scoped, revoke/reconnect, REST dan event tanpa PII |
| test-batas-nomor-member | PASS | Kuota Member/Reguler/IP dan normalisasi |
| test-booking-web-aktual | PASS |12 kelompok guest, DPmock, race slot, lifecycle, pelunasan/invoice, slot 45/qty |
| test-member-operasional-aktual | PASS | Member numerik/legacy tanpa DP, quote, batas gratis, fisik, Walk-in/replay/role |
| test-pemeriksaan-pembayaran | PASS | Penggabungan request, cooldown dan recovery |
| test-log-aman-e2e | PASS | Middleware tidak membocorkan sentinel password/token/error |

## Matriks modul

PASS di bawah hanya mencakup bukti pada kolom kanan. Pembacaan API tidak dianggap pengujian seluruh CRUD/UI.

| Aplikasi/modul | Status | Bukti dan batas |
| --- | --- | --- |
| Admin Dashboard | PASS | API read-only +10 kelompok fixture; visual terbaru tidak diulang |
| Admin Riwayat | PASS | API +10 kelompok closure/filter/auth; data besar belum benchmark |
| Admin Pesanan/Detail/Tindakan | PASS | API +lifecycle / ledger/idempotensi fixture |
| Admin Walk-in | PASS | Quote anonim/race/Member/otorisasi fixture; UI tidak diklik |
| Admin Pelanggan | PASS | GET actual, perlindungan delete, create STAFF 403; seluruh CRUDAdmin belum diuji |
| Admin Membership | PASS | GET actual, manfaat/status, kode numerik/legacy/fisik fixture; seluruh penjualan/perpanjangan belum diuji |
| Admin Barber/Layanan | PASS | GET actual, whitelistaktif dan validasi slot fixture; seluruh CRUD belum diuji |
| Admin Invoice/Struk | PASS | API actual +dokumen/ledger fixture; printer belum diuji |
| Admin Laporan/Pengaturan | PASS | GET actual read-only; rekonsiliasi manual seluruh laporan belum diuji |
| Customer katalog/halaman | PASS | APIaktif, build, browser8 viewport/mock |
| Customer wizard/barber/jadwal | PASS | Source+langkah awal UI; quote/POST slot 45 dan race backend |
| Customer Booking Reguler | PASS | Fixture DP 50%/15 menit, hold, konfirmasi dan lifecycle/mock |
| Customer Booking Member | PASS | Fixture nomor baru/legacy, tanpa kontak/DP, status dan batas gratis |
| Customer tracking/invoice/sinkronisasi | PASS | Fixture HTTP+Socket dan browser/mock |
| Customer pembayaran Sandbox nyata terbaru | BELUM TERVERIFIKASI | Tidak membuat transaksi/provider GetStatusbaru; bukti lama tetap historis |
| Staff Beranda/Pesanan/Walk-in/Riwayat | PASS | Source, TS/export dan kontrak API fixture; UI native belum diverifikasi |
| Staff profil/autentikasi | PASS | GETrole, JWT dan backendfixture; SecureStore perangkat belum diuji |
| Staff Member Kartu+KTP | PASS | Endpoint resmi, audit actor/context, mismatch dan check-in fixture |
| Staff pembayaran/Detail/Invoice | PASS | Kontrak fixture Tunai/Transfer/QRISstub; bukan checkout HP |
| Staff realtime/refocus | PASS | Socket fixture dan audit wiring; AppState perangkat belum diuji |
| Backend auth/role | PASS | CUSTOMER/operator terpisah; guardADMIN dan profil sendiri/limiter fixture |
| Backend finansial/idempotensi | PASS | Providerstub, nominal tidak valid, replay, balance dan invoice |
| Backend schema/migration/WIB | PASS |26 migrationutama sinkron; fixture +batas tengah malam |
| HP Android/iOS end-to-end | BELUM TERVERIFIKASI | Tidak ada bukti perangkat pada audit ini |
| Printer fisik | BELUM TERVERIFIKASI | Export/preview PDF bukan cetakperangkat |
| Dependency bersih | FAIL | Advisory masih terbuka, lihat di bawah |

## Dependency dan risiko tersisa

Hasil npm audit sesuai lockfile saat pemeriksaan; jumlah merupakan advisory package termasuk propagasi dependency, bukan jumlah eksploitasi independen.

| Target | Moderate | High | Critical |
| --- | ---: | ---: | ---: |
| Backend |1|4|0|
| Admin |2|0|0|
| Staff |7|37|0|
| Customer |0|0|0|

Backend melibatkan Prisma/@prisma/config/deepmerge-ts/mysql2; Admin react-router/react-router-dom; Staff rantai Expo/RN/Metro/node-forge/braces/micromatch/uuid/xcode dan propagasinya. Tidak semua mempunyai fixAvailable; sebagian perubahan dapat mengganggu SDK. Belum menentukan exploitability tiap advisory. Tidak menjalankan npm audit fix/force, override atau upgrade major. Tindak lanjut: triage jalur runtime/dev, rencanakan patch kompatibel, minta izin pemasangan bila diperlukan, lalu ulang regresi dan export/perangkat sebelum menyatakan dependency aman.

Batas lain: email reset nyata belum dikirim; delivery yang diuji mock. Seluruh CRUD halaman, UI native, printer, performa arsip besar serta provider nyata kontrak terbaru belum diverifikasi. WIP lokal dan commit publik berbeda; pembuktian suatu versi tidak boleh dipakai untuk mengklaim versi lainnya.

## Tindakan rilis

Branch kerja dapat dibagikan untuk review hasil source/build/fixture yang terverifikasi, dengan laporan blocker ini. Jangan merge ke main atau menganggap push sebagai penerimaan rilis. Dokumentasi seluruh repository diperbarui dan ditautkan silang. Tidak menghapus/memindahkan arsip, source, migration, backup atau branch. Tidak menambahkan screenshot yang belum aman. Hasil push/PR/CI harus diverifikasi remote setelah commit.

## Publikasi yang telah diverifikasi

Push normal fast-forward berhasil; SHA remote cocok dengan lokal melalui git ls-remote. README dan dokumen terbaru ketiga repository dibaca kembali melalui GitHub. [Hasil 14 suite final](HASIL-UJI-TERKINI.json) menyimpan exit code, cleanup dan ringkasan assertion tanpa credential/data pelanggan.

| Repository | Snapshot kode/dokumentasi yang sudah dipush | Jumlah commit pada push pertama audit | Status awal yang tetap lokal setelah push |
| --- | --- | ---: | --- |
| Admin/Backend | [c982c8f](https://github.com/umarmaulanazakaria/barberbarbar/commit/c982c8f7c3e527daac542a8cd8f382b0f27c45b4) |25|13 file WIP tracked +1 folder untracked; Prisma tetap staged |
| Staff | [5d2c872](https://github.com/umarmaulanazakaria/barberbarbar-mobile/commit/5d2c87297a0b6cf2fa64f767ff2427787aad801a) |9|4 file WIP |
| Customer | [8e60cb2](https://github.com/umarmaulanazakaria/barberbarbar-customer/commit/8e60cb2738e8ee079643a1dc0cc58255a961bf82) |8|18 file WIP |

Pencocokan hash WIP dan diff staged setelah push lulus; ahead/behind 0/0 pada ketiga branch. Catatan hasil publikasi ini dicatat melalui commit dokumentasi tambahan pada backend; snapshot kode di tabel tidak berubah. HEAD branch aktual dapat diperiksa melalui GitHub/git log. Tidak mengubah main atau default branch.

**PR belum dibuat:** GitHub menolak create_pull_request pada ketiga repository dengan HTTP 403: Resource not accessible by integration. Simulasi merge tanpa mengubah working tree tidak menemukan konflik pada saat pemeriksaan, tetapi keterbatasan izin integration tetap berlaku. Tidak mencari/mencetak credential atau mengubah izin akun untuk melewati penolakan. Draft review dapat disiapkan manual melalui:

- [Bandingkan Admin/Backend ke main](https://github.com/umarmaulanazakaria/barberbarbar/compare/main...feature/project5-integration)
- [Bandingkan Staff ke main](https://github.com/umarmaulanazakaria/barberbarbar-mobile/compare/main...feature/project5-integration)
- [Bandingkan Customer ke main](https://github.com/umarmaulanazakaria/barberbarbar-customer/compare/main...feat/project5-react-web-mobile-first)

Gunakan draft dan cantumkan blocker dependency/perangkat/provider; jangan merge otomatis. Tidak ada workflow .github/workflows pada snapshot yang dipush. Pemeriksaan workflow runs commit melalui connector mengembalikan daftar kosong (wrapper hanya run pemicu PR); ini bukan CI PASS. Endpoint daftar seluruh workflow tidak didukung connector, sehingga tidak menyimpulkan kondisi seluruh konfigurasi GitHub Actions dari respons tersebut.

Cleanup hanya memperketat ignore environment/key/dump/ZIP/backup lokal dan memperbarui dokumentasi; tidak menghapus atau memindahkan file/branch/arsip. Tidak menginstal atau memperbarui dependency.

## File audit yang diubah

- Admin/Backend: .gitignore, README.md, docs/PANDUAN-SISTEM-TERKINI.md, docs/audit/AUDIT-SISTEM-TERKINI.md, docs/audit/HASIL-UJI-TERKINI.json; middleware batas-percobaan-pelanggan; test-api-publik, test-fondasi-pelanggan, test-batas-nomor-member, test-booking-web-aktual dan test-member-operasional-aktual pada server/scripts.
- Staff: .gitignore, README.md dan docs/OPERASIONAL-TERKINI.md. Tidak mengubah source Mobile.
- Customer: .gitignore, README.md, docs/INTEGRASI-TERKINI.md dan tests/customer-principal.spec.ts. Tidak mengubah source UI Customer.

Total 18 file unik; source bisnis yang berubah hanya middleware pembatas nomor Member.
