# Acceptance demonstrasi lokal

15 Oktober 2026. **DEMO READY WITH LIMITATIONS** untuk tugas kuliah/portofolio lokal. Ini berbeda dari kesiapan Production. Tidak membuat pembayaran/refund baru, menambah dependency atau menerapkan migration. Audit Production historis tetap ada di [penutupan sebelumnya](FINAL-ACCEPTANCE-CLOSURE.md).

Baseline source sebelum pekerjaan: Web/backend `b2438eb`, Staff `283aeda`, Customer `f8f79d4`. Ketiganya `feature/project5-integration`. Bukti ringkas run baru: [VERIFIKASI.json](demo/VERIFIKASI.json). Log mentah dan backup tetap privat di luar Stage 2.

| Pemeriksaan | Status | Bukti dan batas |
|---|---|---|
| Regresi baseline | PASS | 29/29 suite, bukan sekadar menyalin hasil historis; 22 model fixture identik setelah setiap tahap |
| TypeScript ketiga aplikasi, backend/Web build | PASS | Runner + build backend terpisah |
| Prisma validate/status | PASS | Schema valid, 18 migration up-to-date; tidak menerapkan migration |
| Staff/Customer Expo check + Android Hermes | PASS | Bundle dan kecocokan dependency, bukan tap/native UI |
| Akun/RBAC/session/reset/profil | PASS | HTTP/database/SDK; race registrasi/keputusan/reset, pencabutan JWT, batas role dan pemilik |
| Katalog/membership/booking/reschedule/dropdown | PASS | Backend + SDK/adapter komponen aktual; konfirmasi ulang dan draf/refetch |
| Check-in/barber/pesanan/IN_SERVICE/items/COMPLETED | PASS | Fixture lintas backend, Web aktual dan SDK Staff/Customer |
| DP, pelunasan, kasir/invoice/refund approval | PASS | Provider MOCK, authoritative amount, idempotensi dan rollback; bukan refund/pembayaran provider baru |
| Scheduler | PASS | Deadline, perlombaan request, timeout/refund request memerlukan ADMIN |
| Socket room/reconnect/refetch | PASS | Integrasi runtime JWT/room dan SDK; REST tetap sumber kebenaran |
| Web Edge aktual | PASS | 11 grup UI/SDK + cleanup, diulang setelah penyempurnaan capture; lima screenshot asli ditinjau visual |
| Seed existing diproteksi | PASS | Dua penolakan aman, password privat, dua run tanpa duplikat/perubahan akun dan cleanup berdasarkan ID fixture |
| API lokal | PASS | Katalog tanpa JWT 200; orders tanpa JWT 401; backend/proxy readiness sesuai |
| Web/Expo proses lokal | PASS | Web localhost:5173 200; Metro Staff8081/Customer8082 200 packager running; identitas path workspace diperiksa |
| Database aplikasi | PASS | Snapshot 22 model identik dengan backup terbaru; enam pemeriksaan orphan/duplikat/hash final bernilai nol |
| File historis/staging Prisma | PASS | SHA tiga file tetap, blob index Prisma tetap; tidak ikut commit tugas |
| Pengujian perangkat yang disampaikan pengguna | USER-REPORTED | Pengguna menyatakan mobile berhasil; tidak meminta mengulang semua tes; rincian tiap skenario/build/perangkat belum terdokumentasi |
| Pending/Settlement Sandbox nyata | USER-REPORTED | Pengguna melaporkan Success 15 Oktober 2026 pukul 13.20 WIB; tidak mengirim ulang webhook |
| Pembayaran lunas Rp12.500 historis | PASS (bukti historis) | Verifikasi provider/ledger/balance0/satu invoice di laporan sebelumnya; snapshot saat ini menjaga datanya, tidak membayar ulang |
| Checkout UI Android end-to-end | DEFERRED | Tidak disimpulkan dari webhook, Hermes atau adapter; ADB/AVD saat audit kosong |
| Screenshot Staff/Customer native | DEFERRED | Panduan capture tersedia, tidak membuat placeholder/gambar fiktif |
| Email ke inbox nyata | DEFERRED | Transport default nonaktif; template/mock/token 30 menit single-use lulus; tidak memasang provider baru |
| Refund historis Rp2.000 F7-REFUND-48 | DEFERRED | Final provider belum terbukti; respons lama 202/PROCESSING bukan sukses. Tidak retry, debit ledger atau ubah status manual |
| Dependency bebas advisory | FAIL | Audit terbaru masih memiliki High/Moderate; lihat pembatasan paparan di review rilis. Tidak ada Critical pada run ini |
| Kesesuaian Master PRD lengkap | DEFERRED | Master PRD v2.0 lengkap tidak ditemukan; tidak mengarang persyaratan tambahan |

## Apa yang dapat dipresentasikan

Web aktual, diagram tiga aplikasi, katalog/booking/konfirmasi, lifecycle, ledger/invoice, membership, realtime/refetch dan hasil integrasi fixture. [Lima screenshot](screenshots/README.md) memakai dummy dan provider MOCK. Customer Android dan Staff mengikuti [panduan demo](PANDUAN-JALANKAN-DEMO.md) saat perangkat tersedia; keberhasilan umum dari pengguna dipertahankan sebagai USER-REPORTED.

Untuk pembayaran, tampilkan bukti historis yang sah atau jelaskan simulasi harness. Checkout Sandbox baru hanya setelah otorisasi, bukan untuk melengkapi laporan. Jangan menampilkan ID provider/URL Snap atau data pelanggan asli dalam presentasi publik. Refund approval mock tidak membuktikan pengembalian dana nyata.

## Integritas dan keterbatasan

Backup terbaru `e2e-2026-10-15T08-17-35-408Z`: 129.403 byte, SHA-256 `766dd963c94327bff6d5c19781c406999d54118eccedc171fee7fcbe135d5c0b`, checksum/list/dekompresi terverifikasi. Tes memakai database kosong tersendiri dari schema-only backup, tidak menyalin data pelanggan asli. Seed diuji setelah regresi, lalu menghapus hanya ID milik fixture. Database fixture kosong diverifikasi sebelum dibersihkan; database aplikasi tidak berubah.

Laptop/tunnel tidak menjamin uptime. Metro hanya pada LAN tepercaya, ngrok hanya proxy webhook3001. Tidak mengaktifkan Production atau mematikan validasi keamanan. Advisory, email, refund dan bukti native tetap terbuka; ketiadaan hosting bukan kegagalan demo lokal. [Review keamanan dan Git](PORTFOLIO-RELEASE-REVIEW.md).
