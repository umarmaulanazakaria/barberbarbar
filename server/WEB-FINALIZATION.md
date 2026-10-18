# Finalisasi Customer Web — bukti end-to-end Sandbox

16 Oktober 2026 WIB. Melanjutkan source/worktree existing tanpa mengulang migration. Tidak ada push, PR, merge, Production, dependency baru, reset atau penghapusan data existing.

## Status

**Alur React Web end-to-end dengan provider Midtrans Sandbox: PASS.** Booking3745 dibuat dari form Web, DP dan pelunasan masing-masing Rp10.000 mencapai settlement resmi, booking otomatis CONFIRMED setelah DP, proses operasional selesai, balance0 dan satu invoice final. Tidak mengklaim validasi perangkat Android: ADB mendeteksi0 perangkat; Mobile Staff/Native device acceptance tetap DEFERRED. Bukti kompatibilitasnya adalah API/regresi dan source original yang tidak berubah.

## Perubahan source yang diselesaikan

- Aplikasi publik hanya membuat booking melalui API. Kontrol katalog demo, halaman hasil pratinjau dan pesan developer dipisahkan dari entry publik. Kegagalan tidak mengganti data dengan dummy atau menampilkan sukses palsu.
- App pratinjau lama berada di tests/fixtures, hanya dimuat oleh Vite mode test.14 tes lama dipertahankan. Bundle publik tidak mengandung kontrol layanan demo/PREVIEW/route hasil pratinjau.
- Riwayat pembayaran memakai ledger aktual. Status, balance dan invoice berasal dari backend; invoice memerlukan COMPLETED+PAID.
- Empat pembacaan daftar/detail booking Staff/Native memakai transaksi baca SET LOCAL TIME ZONE UTC. Ketidaksesuaian deadline DTO operator terhadap guest dibuktikan sebelum perbaikan dan identik setelahnya. Shape API dan autentikasi dipertahankan; tes membandingkan waktu Staff/guest dan Native/create.
- Layanan dummy lama pengujian dinonaktifkan dari katalog. Booking, transaksi dan riwayatnya dipertahankan. Pengujian baru memakai Hair Wash existing seharga Rp20.000 dengan identitas uji.

## Bukti provider nyata

| Pemeriksaan | Hasil booking3745 |
| --- | --- |
| Sumber booking |Form React Web aktual5175, Chrome existing |
| Harga / DP |Rp20.000 / Rp10.000; dihitung backend |
| Waktu dibuat / deadline |13.31.29 /13.46.29 WIB; tepat900000ms |
| DP ledger1246 |SUCCEEDED; MIDTRANS_STATUS_V1 |
| DP provider |settlement; Rp10.000; transaction ID801b9846-e8db-4bac-a166-7df7bbeca6d6 |
| Auto confirmation |AWAITING_DP → CONFIRMED; tepat1 AUTO_CONFIRM_GUEST; tanpa keputusan operator |
| Pelunasan ledger1247 |SUCCEEDED; MIDTRANS_STATUS_V1 |
| Pelunasan provider |settlement; Rp10.000; transaction ID810c5c66-2d5e-40fb-a40b-2e9f3c81ac4e |
| Status akhir |COMPLETED + PAID; balance Rp0 |
| Ledger berhasil |Tepat2 kredit, satu DP dan satu pelunasan |
| Invoice |Tepat1; INV-BKG-a984ed80-1594-4c9d-ab63-140563ff6171 |
| Webhook resmi |DP13.34.36 WIB dan pelunasan13.37.00 WIB, HTTP200 |
| Replay |Payload settlement asli masing-masing diulang2 kali; sync berulang; tetap2 kredit/1 invoice/1 auto confirmation |

Snap resmi dibuka melalui tombol React Web, tanpa mock gateway/intersepsi API. Pembayaran diselesaikan memakai simulator BCA resmi https://simulator.sandbox.midtrans.com/bca/va/index sesuai dokumentasi https://docs.midtrans.com/docs/testing-payment-on-sandbox . Simulator ini bagian dari lingkungan provider Sandbox; tidak ada tombol simulasi/fake success pada aplikasi publik dan tidak memakai uang nyata.

Script inspeksi pelunasan sempat berhenti sebelum submit simulator. Get Status membuktikan intent1247 sudah PENDING dengan VA/nominal yang benar. Peninjauan otomatis menolak pengulangan script checkout karena risiko intent baru. Alternatif aman yang disetujui hanya membaca intent1247 dan membayar VA existing melalui simulator, tanpa checkout/createTransaction/retry/refund baru. Marker satu submit dipakai. Dua provider settlement diverifikasi ulang setelahnya; tidak ada charge ganda.

Booking lama3742 dan3744 yang pembayarannya ditunda user sudah CANCELLED oleh scheduler, masing-masing tanpa kredit berhasil atau invoice. Referensi transaksi/riwayat tidak dihapus atau dihidupkan kembali. Tidak menjalankan refund provider.

## Operasional dan browser nyata

- Login akun operator uji khusus ber-role ADMIN melalui endpoint login existing, bukan mengubah akun operator lama. Booking paid guest terlihat di daftar operasional; confirm ulang409.
- Check-in → pilih barber final1 → IN_SERVICE dengan satu Pesanan → COMPLETED melalui API existing berhasil. Tidak mengubah row barber/customer asli. Enam event booking.changed diterima lewat Socket.IO JWT operator.
- Peran STAFF dan kontrak Mobile diuji dalam suite guest/booking existing; pengujian provider nyata ini memakai operator ADMIN. Tidak mengklaim klik UI Mobile Staff atau device Android.
- Invoice final dibuka melalui tautan pribadi pada Web aktual; dua entri riwayat berhasil dan balance0 terlihat. Reload dan browser context baru tetap membuka invoice yang sama.
- Viewport320/375/430/768/1440 tidak overflow; nol pageerror; token tidak berada pada URL request API. Token/private link/credential tidak masuk laporan atau repository.

## Validasi

| Pemeriksaan | Hasil |
| --- | --- |
| TypeScript/build backend, Prisma validate |PASS; build/validate diperiksa ulang setelah sesi dilanjutkan |
| Guest/Native login, barber, confirm, DP, history, IDOR, kapasitas/race, Socket→REST |12 kelompok PASS, provider MOCK |
| Booking/kasir legacy Project3/4 |15 kelompok PASS, diulang setelah patch UTC |
| Payment/refund/idempotency existing |17 kelompok PASS, provider MOCK |
| Scheduler/deadline/restart/race |27 kelompok PASS, provider MOCK |
| TypeScript/Vite Web |PASS;37 modules |
| UI lama5viewport |14 PASS pada mode test |
| UI publik tanpa demo dan Web→API→invoice fixture |2 PASS, provider MOCK |
| Form/Snap/DP/auto confirm/operasional/pelunasan/invoice provider nyata |PASS booking3745 |
| Reload/browser baru/responsif/riwayat invoice provider nyata |PASS |
| Realm JWT/guest tanpa token pada backend aktif |401/404 sesuai kontrak |
| Native/Staff Android |DEFERRED,0 device |

Hasil suite yang sudah lulus sebelum interupsi dipertahankan, tidak diklaim sebagai provider nyata. Runner browser sempat tertahan pada teardown Vite Windows; setelah seluruh kasus selesai, hanya server tes5185/5186 dihentikan, kemudian runner keluar0 (14 dan2 passed). Server3000/5175 tidak ikut dihentikan.

## Database dan perlindungan

Checkpoint terbaru sebelum percobaan3745: e2e-2026-10-16T06-30-38-563Z;136466 byte; SHA-256 2ae00a249c1ae104e918d7cc80d1ca385e0cda25b68417e2ad2f06c2c0836cd7. pg_restore list/dekompresi dan snapshot23 terverifikasi. Checkpoint terdahulu sebelum3744 tetap disimpan. Backup memakai adapter privat dengan generated Prisma terbaru dan snapshot UTC, tanpa mengubah helper original.

20 migration tetap selesai; tidak ada migration baru/ulang. Seluruh row lama snapshot22 sebelum migration kembali diperiksa identik; penambahan dibatasi fixture uji. Source, .env, index, branch dan HEAD original Project3/4/Native dibandingkan dengan baseline dan tidak disentuh. server/src/lib/prisma.ts, Staff LayarTambahPelanggan.tsx dan booking.ts historis terlindungi.

Backend kompatibel tetap pada3000, Web5175, tunnel testing existing menuju /midtrans/notifications. Tidak menyunting .env. Fixture finansial aktual dan bukti provider dipertahankan untuk audit; tidak menghapus transaksi. Restrukturisasi Web Admin belum dikerjakan sesuai prioritas user.
