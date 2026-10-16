# Booking tamu Web — audit kompatibilitas

16 Oktober 2026 (WIB). Branch lokal `feat/guest-booking-web-compatible`, worktree terisolasi di luar Stage 2; basis `origin/main` `023764fce5fc4201ac220204eee56f2c2152b843`. Tidak ada push, PR atau merge.

## Pembaruan finalisasi

Hasil terbaru, perbaikan UI/UTC dan pengujian booking3744: lihat WEB-FINALIZATION.md. Booking3742 sudah teramati CANCELLED oleh scheduler, tanpa kredit/invoice.

## Status aktual

Implementasi telah diuji end-to-end pada PostgreSQL fixture dengan gateway Midtrans MOCK. Dua migration additive telah diterapkan pada database existing setelah persetujuan user dan verifikasi ulang backup. Runtime kompatibel aktif pada port3000 dengan database/JWT/Sandbox environment existing yang sama. Snapshot22 existing tetap identik sebelum/sesudah DDL; seluruh row existing juga tetap identik setelah penambahan fixture dummy. Snap Sandbox nyata DP Rp5.000 berhasil dibuat satu kali, tetapi user menunda pembayaran: settlement/auto confirmation provider nyata belum diuji. Perangkat Native tetap DEFERRED.

## Endpoint baru

Semua endpoint memakai `Cache-Control: no-store`, tanpa JWT akun. Operasi privat selalu memverifikasi header `Authorization: Guest <token>`; token tidak diterima melalui nomor booking, URL, query atau body.

| Endpoint | Fungsi |
| --- | --- |
| `POST /guest/bookings` | Membuat booking guest, identitas khusus, nomor unik, token dan tautan pribadi |
| `GET /guest/bookings/current` | Detail milik token dan ringkasan authoritative |
| `GET /guest/bookings/current/payments` | Ringkasan ledger dan waktu server |
| `POST /guest/bookings/current/checkout` | Snap DP atau pelunasan melalui gateway existing |
| `POST /guest/bookings/current/sync` | Get Status provider hanya transaksi milik booking token |
| `GET /guest/bookings/current/invoice` | Invoice final hanya COMPLETED + PAID |

Feature flag backend `GUEST_BOOKING_ENABLED=true` diperlukan. Tanpa flag, route guest gagal tertutup sebelum membaca tabel baru. Jangan menjalankan kode baru pada database existing sebelum migration disetujui dan diterapkan. Endpoint `/customer/*`, JWT CUSTOMER, operator dan autentikasi lama tidak dihapus atau dibuka menjadi publik.

POST menerima nama, nomor HP, jadwal, items `{layananId,qty}` dan UUID `kunciIdempotensi`. Nominal, diskon, status, pilihan barber dan identitas akun tambahan ditolak. Retry create dengan kunci sama menghasilkan 409, tanpa booking kedua atau pengembalian token yang disimpan plaintext. Jika respons create hilang sebelum tautan diterima, tidak ada checkout yang sudah dibuat; reservasi kedaluwarsa setelah 15 menit. Pemulihan tautan hilang belum disediakan.

## Dua alur berdampingan

- **AKUN:** default seluruh row lama. Login, pilihan barber, pending konfirmasi, keputusan Staff, DP satu jam dari konfirmasi dan riwayat akun dipertahankan.
- **TAMU:** tanpa akun/barber/membership. Mulai `AWAITING_DP`, deadline tepat dibuatPada +15 menit dari clock PostgreSQL. Setelah provider sah dan tepat waktu, menjadi CONFIRMED tanpa keputusan operator. Setelah itu check-in, barber final, layanan, pelunasan dan invoice memakai service existing.
- Sebelum DP, guest tidak tampil sebagai antrean konfirmasi operator. Sesudah CONFIRMED masuk DTO operator existing. Kontak guest ditambahkan pada DTO operator tanpa token/hash; Project 4 tidak diubah.
- Guest tidak ditautkan ke akun/membership hanya karena nomor HP sama. Dibuat Pelanggan terpisah dengan penanda nomor internal `TAMU-UUID`; nama dan nomor kontak yang diklaim disimpan pada AksesBookingTamu. Nomor kontak ini belum diverifikasi. Akun existing beserta password, status dan riwayatnya tidak diubah. UI Staff lama belum menyajikan kontak tambahan tersebut; ini dicatat untuk pekerjaan Staff terpisah.

## Token dan kapasitas

Token 32 byte acak `crypto.randomBytes`, dikirim hanya pada respons create milik pemohon. Hanya SHA-256 disimpan, scope satu booking, berlaku sampai 30 hari setelah jadwal selesai. Semua operasi privat menurunkan ID booking dari token, tanpa menerima ID milik caller. DTO tidak mengandung tokenHash, password, kunci idempotency atau ID akun. Rate limit per IP/socket dibatasi memori: create20, checkout30, sync60, detail180 per 15 menit; X-Forwarded-For tidak dipercaya otomatis. Ini limiter per proses, belum limiter cluster terdistribusi.

Semua penulis reservasi Native/guest memakai advisory transaction lock yang sama dan READ COMMITTED. Kapasitas mencakup barber aktif, durasi, seluruh reservasi aktif, hold DP dan pesanan WAITING/IN_SERVICE. Linked booking/order dihitung sekali. Validasi alokasi utuh menolak celah barber yang bergantian namun tidak cukup sepanjang satu layanan. Alokasi hanya untuk validasi, tidak menetapkan barber pelanggan. Pencarian alokasi dibatasi 10.000 langkah dan gagal tertutup jika terlalu kompleks.

Pembuatan/start walk-in juga memakai lock dan melindungi kapasitas guest yang bersinggungan, tanpa mengubah model antrean kasir lama di luar konflik guest. Jam operasional 09.00–23.00 WIB, maksimal 14 hari dan minimal 3 jam untuk hari yang sama mengikuti aturan jadwal existing. Penonaktifan barber oleh operator dapat mengubah kapasitas; auto confirmation memeriksa ulang dan gagal ke pembatalan/review bila tidak dapat dipenuhi.

## Pembayaran dan deadline

Harga, durasi, DP ceil(total/2), balance dan invoice dihitung backend. DP guest round mengacu waktu pembuatan, terpisah dari round konfirmasi akun. Snap expiry memakai `start_time` waktu pembuatan dan duration15; tidak direset saat checkout dibuat/diulang. Tidak mengirim token guest, data kontak, callback URL pribadi atau identitas akun ke Midtrans.

Hanya gateway Midtrans existing digunakan, Sandbox saja. Satu intent pending per round, lock serta index existing mencegah checkout/kredit ganda. Signature webhook diperiksa lalu Get Status resmi memastikan merchant, transaksi, currency dan nominal. Callback frontend tidak mengubah ledger/booking. Konfirmasi otomatis terjadi dalam transaksi yang sama dengan kredit/bukti/audit setelah verifikasi dan sebelum deadline server.

Scheduler memindai AWAITING_DP secara persisten; pembacaan kapasitas/detail juga melepaskan hold guest lewat deadline. Pembayaran yang baru diverifikasi setelah slot dilepas tidak mengonfirmasi ulang, meskipun provider melaporkan waktu bayar lebih awal. Kredit sah tetap dicatat dan diajukan sebagai review/refund 100% dengan persetujuan ADMIN; tidak mengirim refund otomatis. Kapasitas baru tidak direbut. Kegagalan audit/refund allocation me-rollback kredit dan perubahan status bersama.

## Migration

Dua migration baru, keduanya transaksi DDL atomik; diuji dari database kosong dengan seluruh 20 migration berhasil:

1. `20261016090000_tambahkan_booking_tamu`: enum AWAITING_DP, kolom sumberBooking defaultAKUN, tabel AksesBookingTamu dengan unique/FK/hash CHECK/index.
2. `20261016091000_batasi_deadline_guest`: memperluas CHECK deadline secara kondisional, mempertahankan persis satu jam untuk akun dan 15 menit untuk guest, serta larangan membership/pilihan barber guest.

Tidak menghapus tabel, row, histori atau migration lama. Migration existing **DISETUJUI DAN DITERAPKAN**; seluruh 20 migration selesai tanpa gagal. Lihat `GUEST-MIGRATION-PLAN.md` untuk rencana rollout dan backup.

## Validasi

| Pemeriksaan | Hasil |
| --- | --- |
| TypeScript/backend build | PASS |
| Prisma generate/validate, drift fixture | PASS; tidak ada difference schema |
| Guest API PostgreSQL + provider MOCK | 12 kelompok PASS |
| Native booking/API dan kasir legacy | 15 kelompok PASS |
| Gateway/payment/refund existing (MOCK) | 17 kelompok PASS |
| Scheduler existing (MOCK) | 27 kelompok PASS |
| Socket.IO actual -> REST Staff dari guest | PASS dalam suite guest |
| Browser Web -> API aktual -> DP -> Staff -> pelunasan/invoice | PASS pada fixture, provider MOCK |
| Migration dari nol pada fixture kedua | PASS; database fixture pertama dibersihkan setelah 23 tabel terbukti kosong |
| Snapshot fixture 23 model setelah suite | PASS, identik sebelum/sesudah |
| Provider Sandbox nyata | Snap DP Rp5.000 berhasil dibuat; pembayaran/settlement DEFERRED atas permintaan user |
| Android device React Native | DEFERRED, tidak diklaim dari tes API |
| Database existing/aktivasi runtime baru | PASS, dua migration diterapkan dan backend3000 aktif |

Tes mencakup create unik, harga injection, IDOR/realm JWT, token palsu/expired, rate limit429, deadline15, Snap race satu provider call, pending/forged webhook, replay kredit/audit satu kali, alur Staff dan layanan aktual, invoice sekali, late settlement/review, race Native vs guest serta alokasi barber terfragmentasi. Test server `scripts/serve-guest-browser.mjs` memiliki kontrol fixture terpisah, hanya pada nama database test; tidak dipasang pada `src/app.ts`.

## File dan perlindungan

Baru: dua migration, `lib/alokasi-barber.ts`, `lib/kapasitas-lintas-booking.ts`, `routes/guest-booking.routes.ts`, `services/guest-booking.service.ts`, `scripts/test-guest-booking.mjs`, `scripts/serve-guest-browser.mjs` dan laporan ini. Perubahan terbatas pada Prisma schema, app mount, shared capacity, service Midtrans/pembayaran/scheduler, DTO operator dan pesan konflik walk-in. Tidak ada dependency baru atau perubahan gateway kedua.

`server/src/lib/prisma.ts` tidak diubah/di-stage. Original Project 3, Mobile Staff dan Native Customer dipertahankan dengan snapshot seluruh tracked file, environment, index, HEAD dan status. Metadata worktree/branch baru memang ditambahkan, bukan mengganti branch original. Tidak ada push, PR atau merge.

Referensi resmi: https://docs.midtrans.com/reference/expire-a-snap-session , https://docs.midtrans.com/reference/snap-js , https://docs.midtrans.com/docs/https-notification-webhooks . Provider callback bukan bukti server dan expiry provider tidak menggantikan deadline database.

## Penerapan yang disetujui dan penundaan pembayaran

Backup terbaru e2e-2026-10-16T05-29-37-455Z: 129403 byte, SHA-256 b1744d338f5583f79491e7569242050b444153727bf7abaced38e75223bbb20f. Arsip list/dekompresi dan snapshot22 valid sebelum serta sesudah migration. Seluruh row lama pada 22 model kembali dibandingkan setelah fixture dibuat: identik, termasuk hash login dan metadata akun/operator.

Smoke HTTP backend aktif: public services/barbers 200, customer bookings/orders tanpa JWT 401, guest tanpa token 404. Tunnel https://trifle-unviable-levitator.ngrok-free.dev menuju backend3000 merespons katalog200. Tidak menyunting .env original.

Booking dummy3742, layanan Rp10.000, DP Rp5.000, deadline 16 Oktober 2026 12.47 WIB. Ledger1243 masih PENDING, nol kredit SUCCEEDED, nol invoice, tanpa bukti provider. Get Status resmi mengembalikan404 (Snap dibuat, metode pembayaran belum diproses). User memilih menunda pembayaran; helper checkout lokal ditutup, tidak ada checkout/refund/retry baru. Hold akan dilepas scheduler setelah deadline; status pembatalan aktual belum diklaim sebelum diamati. Fixture/audit finansial dipertahankan, tidak dihapus.

Guard UTC ditambahkan pada transaksi verifikasi expiry token agar konsisten dengan waktu database lintas timezone. Tes expiry memakai clock_timestamp database, bukan Date aplikasi. Build dan 12 kelompok guest diulang PASS dengan PGOPTIONS timezone Asia/Jakarta; cleanup23 model identik. Tidak ada perubahan schema tambahan.
