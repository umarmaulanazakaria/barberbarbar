# Lengkapi pengelolaan booking, pembayaran terverifikasi dan dokumentasi demo

Draft PR: feature/project5-integration ke main. Belum membuat/merge PR. Main remote terbaru ed37007 sudah memuat merge terdahulu; PR ini hanya untuk selisih lanjutan, bukan mengulang seluruh implementasi awal.

## Masalah dan perubahan

Operator dan customer memerlukan status booking/tagihan yang konsisten antar aplikasi. Backend menjaga nominal, lifecycle, ledger, invoice dan otorisasi; frontend memperbaiki bahasa serta kendali edit saat refetch. Pemeriksaan status payment tidak membuat transaksi ganda. Webhook development melewati proxy route tunggal; launcher memeriksa identitas backend agar tidak menjalankan duplikat.

Recovery/profil customer memiliki autentikasi ulang dan pencabutan sesi. Template/transport email diuji MOCK; default tidak mengirim inbox nyata. Demo/portofolio disertai README, naskah, panduan startup, acceptance dan lima screenshot Web dummy. Seed existing kini meminta password privat, izin eksplisit dan database lokal khusus, tidak mengganti akun existing atau mencetak credential.

## File signifikan untuk reviewer

- server/src/services/auth-pelanggan.service.ts, email-reset-pelanggan.service.ts; schema/controller/routes customer.
- server/src/lib/pemeriksaan-pembayaran.ts, services/midtrans-booking.service.ts, pembayaran-booking.service.ts.
- server/scripts/jalankan-proxy-webhook.mjs, periksa-webhook-development.mjs, dev.mjs; scripts/jalankan-barberbarbar.ps1.
- client/src/pages/DetailBookingPage.tsx, komponen pembayaran/dialog, lib/teks.ts dan halaman operasional.
- server/src/seed.ts, scripts/test-seed-demo.mjs; client/scripts/test-e2e-browser.mjs.
- README.md, docs/DEMO-ACCEPTANCE.md, PORTFOLIO-RELEASE-REVIEW.md serta panduan/screenshot terkait.

Daftar utuh: git diff --name-status origin/main...HEAD. Perubahan historis lokal server/src/lib/prisma.ts staged tidak ikut commit/PR. Tidak ada migration/dependency baru pada pekerjaan demo ini; tinjau history/schema feature bila base target berubah.

## Validasi

29/29 regresi PASS pada database kosong terpisah, snapshot 22 model tiap tahap identik. TypeScript/backend build/Web build, Prisma validate dan 18 migration up-to-date. Browser Edge aktual: 11 grup + cleanup PASS; capture diulang sesudah penutupan toast melalui UI. Seed safety/idempotensi/cleanup PASS. Lihat [acceptance](DEMO-ACCEPTANCE.md) dan [bukti](demo/VERIFIKASI.json). Simulator provider MOCK bukan Sandbox/device nyata.

## Batas dan review

DEMO READY WITH LIMITATIONS untuk akademik/lokal, bukan Production. Native berhasil menurut laporan umum pengguna; checkout Android dan screenshot native belum rinci. Webhook Sandbox Success 13.20 WIB USER-REPORTED; tidak diulang. Email nyata nonaktif; refund historis Rp2.000 belum final dan tidak di-retry. Advisory High/Moderate terbuka tanpa upgrade paksa. Master PRD lengkap belum ditemukan.

merge-tree terhadap origin/main terbaru exit0 tanpa konflik saat audit. Periksa ulang bila main berubah. Tidak menggabungkan staged Prisma, tidak force push, tidak merge main otomatis.
