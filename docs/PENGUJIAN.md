# Pengujian dan pemulihan workspace

Panduan aktif sesudah cleanup 15 Oktober 2026. Bukti historis berada di `docs/audit`, `server/e2e`, dan `server/finalization`; file tersebut bukan hasil run baru. Output baru masuk `server/artifacts/` yang diabaikan Git.

## Prasyarat dan perintah

Jalankan dari `server` dengan dependency ketiga repository tersedia, PostgreSQL lokal, `pg_dump`/`pg_restore`, dan `MIDTRANS_IS_PRODUCTION=false`. Hentikan backend/Vite manual pada port 3000/5173 sebelum harness browser. Jangan menjalankan suite database paralel. Suite memakai fixture terisolasi dan memeriksa 22 model setelah setiap tahap; jika snapshot berubah, hentikan dan selidiki.

```powershell
npm.cmd run build
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js migrate status
node scripts/backup-e2e.mjs
$env:BB_AUDIT_OUTPUT_DIR='artifacts/cleanup'
node scripts/jalankan-regresi-e2e.mjs
node scripts/verifikasi-integritas-e2e.mjs "<folder-backup>"
node scripts/audit-dependency-e2e.mjs
```

Runner mencakup 27 tahap: TypeScript, akun customer, reset, katalog, membership, booking, lifecycle, ledger, scheduler, realtime, Web, Staff, Customer, ekspor Hermes Android, reschedule, browser, draft, dan keamanan log. Provider pada regresi memakai MOCK. Acceptance perangkat dan checkout Customer Sandbox memerlukan bukti nyata terpisah.

## Backup dan recovery

`backup-e2e.mjs` menyimpan dump PostgreSQL custom dan snapshot 22 model di `%LOCALAPPDATA%/BARBERBARBAR/database-backups`. Script membaca seluruh dump melalui `pg_restore` tanpa restore, membandingkan snapshot sebelum/sesudah, dan menulis checksum. Pemeriksaan ulang: `node scripts/backup-e2e.mjs "<folder-backup>"`.

Backup workspace dicatat dalam [laporan cleanup](WORKSPACE-CLEANUP-AUDIT.md), meliputi manifest SHA-256, source sebelum cleanup, environment, dan patch perubahan lokal. Untuk recovery file, cocokkan checksum manifest lalu salin hanya file yang ditinjau dari `files/<path-relatif-Stage-2>`. Bandingkan perubahan baru sebelum menimpa file. Metadata `.git` dan patch privat tersedia untuk inspeksi; jangan mereset riwayat remote atau mengganti keseluruhan metadata Git.

Restore database bukan bagian cleanup dan memerlukan rencana serta persetujuan tersendiri. Dump/snapshot mengandung data sensitif dan tidak boleh masuk Git, chat, atau ZIP publik.

## Bukti dan batas

Baseline finalisasi: 27/27 PASS, matriks 216 PASS / 46 DEFERRED / 9 N/A, browser 8/8 stabil. Hasil cleanup harus dibaca dari [audit terbaru](WORKSPACE-CLEANUP-AUDIT.md), bukan diasumsikan dari baseline. [Panduan Android](README-PENGUJIAN-ANDROID.md) memuat acceptance yang tertunda. Email recovery, refund historis, advisory, dan gap PRD tetap menjadi gate rilis.
