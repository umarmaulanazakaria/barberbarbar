# Checklist review dan rilis

Review PR tidak sama dengan izin merge atau Production. Tidak ada merge,
migration deployment, perubahan credential atau transaksi Production dilakukan
pada finalisasi ini. Hasil aktual ada pada F14-AUDIT dan matriks revalidasi.

| Gate | Syarat penutupan | Kondisi |
|---|---|---|
| Source/Git | Path commit eksplisit, file historis utuh, secret tidak ikut, upstream sinkron | Diverifikasi sebelum penyerahan |
| Regresi | TS/build/Prisma, backend, Web, kedua mobile, scheduler/realtime/payment/race | Lihat HASIL-REGRESI.json; setiap FAIL wajib ditangani |
| Data | Backup baru, cleanup terarah, relasi/ledger/invoice/refund konsisten | HASIL-INTEGRITAS.json terbaru, bukan angka historis |
| Browser | Root cause timeout dan pengulangan stabil, keyboard dialog, critical flow | Lihat bukti diagnostik/soak; jangan menutup dari retry tunggal |
| Android Staff/Customer | Checklist perangkat nyata/AVD, native storage/restart/keyboard/back | DEFERRED: perangkat/AVD tidak tersedia |
| Customer Sandbox | DP dan pelunasan dari WebBrowser app, webhook sah, satu kredit/invoice | DEFERRED: perangkat belum tersedia |
| Refund historis | Bukti final provider/acquirer untuk refund_key F7-REFUND-48 | DEFERRED: transaksi asal settlement, tidak ada refund final cocok |
| Recovery email | Provider/sender/link/template/retry yang disetujui dan inbox nyata | BLOCKER: delivery belum ada; UI tidak mengklaim terkirim |
| Requirement produk | PRD dan keputusan change-password/identitas/reschedule item UI | BLOCKER acceptance: PRD lengkap belum tersedia |
| Dependency | Reachability advisory runtime/build, perbaikan yang disetujui, audit ulang | Advisory high/moderate masih terbuka; jangan upgrade major otomatis |
| Bootstrap akun | Provision akun ADMIN aman, tanpa default seed demo | BLOCKER Production: seed demo existing tidak boleh dipakai untuk rilis |
| PR Customer | Base branch main yang disetujui pemilik | Belum ada origin/main; hanya teks PR disiapkan |
| Operasional | HTTPS/origin, monitoring, shutdown, scanner, backup/restore rehearsal | Belum ada validasi deployment Production atau restore trial |

## Prioritas dan dampak

P0 berarti bukti pelanggaran keamanan/integritas atau fungsi utama rusak; jangan
melanjutkan rilis sebelum pulih. Tidak menyamakan angka high npm dengan exploit
P0 yang telah terbukti. P1 menghambat acceptance/release: perangkat/payment
native, delivery recovery, keputusan requirement, refund final ambigu, serta
triage high dependency. P2 mencakup stabilitas browser dan operasional yang
belum terbukti di deployment. P3 adalah dokumentasi/kosmetik tanpa perubahan
perilaku. Severity spesifik dan bukti ada di F14-AUDIT, bukan label tanpa dampak.

## Urutan jika merge/deployment kelak disetujui

1. Review backend terlebih dahulu: kontrak kompatibel, schema/migration dan
   integritas keuangan. Buat backup target dan restore rehearsal di lingkungan
   terpisah. Periksa 18 migration existing; tidak reset atau menjalankan seed.
2. Evaluasi migration yang belum ada di target. Perubahan barberId nullable
   disertai CHECK saat layanan, ledger/FK/unique, trigger NOTIFY dan hash
   permohonan nullable perlu dicek terhadap data target. Eksekusi migration
   berisiko memerlukan persetujuan tersendiri, bukan izin dari dokumen ini.
3. Setelah backend staging lulus smoke, Web dapat mengikuti; origin Socket dan
   reverse proxy HTTPS/WebSocket harus sesuai. Pertahankan API operator legacy.
4. Staff berikutnya, lalu Customer setelah API dan notification delivery siap.
   Verifikasi Expo/native bundle/build pada perangkat dan URL API target.
5. Baru lakukan acceptance provider/merchant dan seluruh blocker release,
   monitoring/rollback plan, lalu minta persetujuan rilis/merge eksplisit.

Rollback aplikasi tidak berarti menghapus ledger/migration atau mengembalikan
dump di atas transaksi baru. Gunakan investigasi dan rekonsiliasi keuangan yang
disetujui. Jangan membersihkan fixture provider ambigu sebelum bukti disimpan.
