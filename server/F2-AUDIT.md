# Audit F2 Customer Foundation

Tanggal: 9 Oktober 2026. Branch: `feature/project5-integration`.

**Status: F2 belum ditutup.** Seluruh pengujian fungsi dan perbaikan baru lulus,
tetapi pemeriksaan read-only menemukan **2 permohonan existing** yang sudah
diputuskan dan masih menyimpan hash password. Pembersihan data existing menunggu
persetujuan pemilik data. Tidak ada migration, reset database, push atau merge.

## Hasil fitur

| Fitur | Hasil | Bukti |
| --- | --- | --- |
| Registrasi customer baru | PASS | HTTP 201; satu pelanggan dan akun dalam transaksi; konflik HTTP 409 umum |
| Pengaitan customer existing | PASS | HTTP 202; satu permohonan MENUNGGU; akun belum dibuat |
| Persetujuan/penolakan ADMIN | PASS | Satu keputusan; persetujuan membuat satu akun; penolakan tidak membuat akun |
| Login email/nomor telepon | PASS | Kedua identitas HTTP 200; email dinormalisasi |
| Pemisahan JWT | PASS | CUSTOMER ditolak operator; ADMIN/STAFF ditolak `/auth/customer/me` |
| Profil sendiri | PASS | GET/PATCH menggunakan ID akun dari JWT; perubahan ID/email/status ditolak |
| Forgot/reset password | PASS sebagai fondasi | Respons forgot identik; reset valid berhasil; belum ada pengiriman email/WhatsApp |
| API publik services/barbers | PASS | Tanpa JWT; hanya aktif; whitelist field sesuai kebutuhan customer |

## Hasil keamanan

| Pemeriksaan | Hasil | Bukti / perbaikan |
| --- | --- | --- |
| Registrasi baru bersamaan | PASS | Respons 201/409; satu pelanggan dan satu akun |
| Email sama, telepon berbeda bersamaan | PASS | Satu akun; pelanggan dari transaksi yang gagal di-rollback |
| Pengaitan existing bersamaan | PASS | Respons 202/409; satu permohonan |
| Email pending untuk customer berbeda | PASS | Satu permohonan; registrasi baru dengan email pending ditolak |
| Unique constraint database aktual | PASS | Indeks unik telepon, akun per pelanggan, email akun, hash token diperiksa read-only |
| Konflik email persetujuan | PASS | HTTP 409 umum; tidak ada akun/keputusan parsial |
| Dua ADMIN approve bersamaan | PASS | Respons 200/409; satu keputusan dan akun |
| Approve versus reject bersamaan | PASS | Respons 200/409; status akhir konsisten dengan jumlah akun |
| STAFF memutuskan permohonan | PASS | Approve/reject/list ADMIN-only mengembalikan 403 |
| DIBLOKIR | PASS | Registrasi, login, middleware GET/PATCH, persetujuan ditolak |
| Customer mengakses operator | PASS | Seluruh mount operator dan auth/me ditolak dengan 401 |
| Mengakses/mengubah profil customer lain | PASS | Query ID tidak mengubah akun tujuan; body ID/email/status ditolak 400 |
| Kebocoran hash/token reset | PASS | Respons registrasi/profil/permohonan/forgot menggunakan field aman; public API whitelist |
| Token reset | PASS | Random 32 byte; SHA-256 tersimpan; expiry 30 menit; palsu/kedaluwarsa/bekas ditolak |
| Atomisitas reset | PASS | Fault injection rollback klaim token dan hash password |
| Reset bersamaan | PASS | Token sama dan dua token akun sama masing-masing hanya satu berhasil |
| JWT aktif setelah reset | PASS | Semua JWT CUSTOMER lama ditolak; login baru berhasil |
| Password/JWT operator setelah reset | PASS | Hash ADMIN/STAFF tetap; JWT operator masih berlaku |
| Retensi hash keputusan baru | PASS | Hash disalin ke akun lalu dikosongkan pada permohonan dalam transaksi; penolakan mengosongkan hash |
| Retensi hash keputusan existing | **FAIL / terbuka** | 2 baris masih menyimpan hash; belum diubah karena membutuhkan persetujuan |
| Penghapusan customer existing | PASS | Endpoint operator menolak penghapusan pemilik akun/riwayat pengaitan; FK permohonan Restrict |
| Rate limit empat endpoint | PASS lokal | Register/login 20, forgot 10, reset 30 per IP per 15 menit; HTTP 429 dan Retry-After |
| Rate-limit expiry/IP spoof | PASS | Jendela kembali setelah 15 menit; IP berbeda terpisah; X-Forwarded-For tidak melewati batas |
| Batas password bcrypt | PASS | Registrasi/reset menolak password melebihi 72 byte UTF-8 |

## Perubahan dan alasan

- `src/services/auth-pelanggan.service.ts`: transaksi Serializable mencakup
  pemeriksaan akun, email pending, customer dan pembuatan akun/permohonan.
  Konflik P2002/P2034 menjadi respons umum 409. JWT menyertakan sidik kredensial.
- `src/services/pengaitan-akun.service.ts`: persetujuan Serializable; keputusan
  mengosongkan hash permohonan. Update status bersyarat tetap menjamin satu keputusan.
- `src/lib/kredensial-pelanggan.ts`: HMAC-SHA256 terikat secret JWT dan hash password.
  Middleware membandingkan sidik dengan hash saat ini. Tidak memerlukan schema baru.
- `src/middleware/auth-pelanggan.middleware.ts`: menolak JWT dengan sidik lama/hilang.
- `src/middleware/batas-percobaan-pelanggan.middleware.ts`: counter IP dengan expiry,
  maksimum 10.000 key per endpoint dan penolakan ketika kapasitas penuh.
- `src/routes/auth-pelanggan.routes.ts`: limiter hanya pada empat endpoint CUSTOMER.
- `src/schemas/auth-pelanggan.schema.ts`: batas bcrypt 72 byte saat registrasi.
- `scripts/test-fondasi-pelanggan.mjs`: integrasi HTTP, concurrency, role, profil,
  blokir, pencabutan JWT, retensi hash baru, deletion dan rate limit dengan fixture lokal.
- `scripts/bersihkan-hash-permohonan.mjs`: default read-only, hanya count;
  `--terapkan` mengosongkan passwordHash permohonan DISETUJUI/DITOLAK secara atomik
  menggunakan updateMany. Tidak menyentuh akun, keputusan, identitas atau riwayat.
- `scripts/RESET-PASSWORD-CUSTOMER.md`: memperbarui keterangan pencabutan JWT
  dan rate limit setelah perbaikan audit.
- `F2-AUDIT.md`: laporan ini.

`src/lib/prisma.ts` memiliki perubahan lama sebelum audit; sidik file tetap sama
dan file tersebut dikecualikan dari commit. Schema/migration tidak berubah.

## Verifikasi

Dari folder `server`:

```powershell
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false --noUnusedLocals --noUnusedParameters
npm.cmd run build
node scripts/test-fondasi-pelanggan.mjs
node scripts/test-reset-password-pelanggan.mjs
node scripts/test-api-publik.mjs
node scripts/bersihkan-hash-permohonan.mjs
```

TypeScript dan build: PASS. Suite fondasi: 24 kelompok PASS, termasuk cleanup.
Regresi reset: 11 kelompok PASS. Regresi API publik: PASS kedua endpoint,
proteksi operator dan kontrak STAFF. Pemeriksaan retensi existing: 2 baris terbuka.
Seluruh fixture dibersihkan berdasarkan ID/penanda proses; data existing tidak diubah.
Jalankan suite berurutan: reset memeriksa sidik seluruh password operator existing;
suite lain yang membuat fixture operator secara paralel dapat memicu false failure.

## Penutupan dan keterbatasan

1. **Wajib diselesaikan sebelum penutupan:** persetujuan pembersihan dua hash lama,
   lalu jalankan `node scripts/bersihkan-hash-permohonan.mjs --terapkan` dan verifikasi
   ulang dengan mode read-only (hasil harus 0). Script sudah konkret dan tersedia,
   penerapan belum diotorisasi saat laporan ini dibuat.
2. Forgot-password belum dapat dipakai customer sungguhan: belum ada pengiriman
   token email/WhatsApp. Simulasi hanya akun dummy; token tidak dikembalikan API.
3. Rate limiter menggunakan memori satu proses. Counter hilang saat restart dan
   tidak dibagi antar instance. Sebelum deployment multi-instance, gunakan store
   bersama atau limiter gateway; konfigurasikan trusted proxy secara eksplisit.
4. Deployment perubahan ini membuat JWT CUSTOMER sebelum versi sidik kredensial
   tidak berlaku; customer harus login ulang. JWT ADMIN/STAFF tidak diubah.
5. Hash permohonan MENUNGGU masih diperlukan untuk persetujuan. Kebijakan masa
   simpan/expiry permohonan pending dan pembersihan token reset historis belum
   ditetapkan dalam PRD yang tersedia.
6. Master PRD v2.0 tidak ditemukan di workspace. Audit berbasis source dan
   ketentuan pengguna; kesesuaian lengkap terhadap PRD belum dapat dibuktikan.
7. Route/controller/schema operator Project 3/4 tidak diubah. Smoke HTTP operator
   dan kontrak STAFF lulus. Alur kasir end-to-end, UI/device Project 4/5 serta
   deployment produksi tidak diuji dalam audit ini.

Commit audit dan status Git akhir dicantumkan pada laporan akhir percakapan;
gunakan `git log -1` dan `git status --short --branch` untuk pemeriksaan ulang.
