# Audit F2 Customer Foundation

Tanggal: 9 Oktober 2026. Branch: `feature/project5-integration`.

**Status: temuan terakhir retensi hash F2 selesai.** Setelah persetujuan eksplisit
pemilik data, hanya `passwordHash` permohonan ID 1 dan ID 2 dikosongkan dalam
satu transaksi Serializable. Audit terakhir menunjukkan **0 hash pada permohonan
final**. Akun termasuk hash login, pelanggan, operator dan metadata keputusan
tetap identik dengan snapshot awal. Seluruh pengujian relevan lulus. Fondasi F2
terverifikasi untuk integrasi lokal; keterbatasan produksi tetap tercantum di bawah.
Tidak ada migration, reset database, push atau merge.

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
| Retensi hash keputusan existing | **PASS / selesai** | Dua hash ID 1/2 dikosongkan setelah persetujuan; audit final 0; sidik data lainnya identik |
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
  juga menampilkan ID/status dan hubungan akun tanpa hash. `--terapkan --rencana`
  mensyaratkan backup terverifikasi dan snapshot yang belum berubah; hanya dua ID
  final yang disetujui di-update. Sidik akun/pelanggan/operator/keputusan diverifikasi
  dalam transaksi Serializable; kegagalan menyebabkan rollback.
- `scripts/util-audit-hash-permohonan.mjs`: snapshot read-only dan pemeriksaan
  hubungan akun tanpa menampilkan hash password atau identitas kontak.
- `scripts/cadangkan-database-f2.mjs`: backup custom PostgreSQL di luar repository,
  verifikasi daftar isi dan dekompresi seluruh arsip tanpa restore; SHA-256 serta
  rencana target disimpan tanpa credential koneksi.
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
proteksi operator dan kontrak STAFF. Pemeriksaan retensi existing: **0 baris terbuka**.
Seluruh fixture dibersihkan berdasarkan ID/penanda proses. Perubahan data existing
hanya `passwordHash` ID 1/2 yang disetujui; akun aktif dan data lainnya tetap utuh.
Jalankan suite berurutan: reset memeriksa sidik seluruh password operator existing;
suite lain yang membuat fixture operator secara paralel dapat memicu false failure.

## Penutupan dan keterbatasan

1. **Selesai:** pembersihan dua hash lama telah disetujui dan diterapkan. Hasil
   read-only 0; hanya ID 1/2 berubah pada kolom passwordHash. Jangan menjalankan
   ulang penerapan: snapshot awal sudah berubah sesuai tujuan dan guard akan menolak.
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

## Persiapan penyelesaian temuan lama — 9 Oktober 2026

Bagian ini mencatat persiapan **sebelum penerapan**. Saat persetujuan diminta,
belum ada perubahan database. Hasil penerapan aktual tercantum pada bagian akhir.
Hash password tidak ditampilkan.

| ID permohonan | Status final | Pelanggan | ADMIN | Akun terkait | Hasil pemeriksaan |
| --- | --- | --- | --- | --- | --- |
| 1 | DISETUJUI | 39 / AKTIF | 1 | 2 | Hash login ada pada AkunPelanggan secara terpisah; hash permohonan sama dengan hash akun |
| 2 | DITOLAK | 40 / AKTIF | 1 | Tidak ada | Tidak ada akun customer yang perlu diubah |

Kedua record memiliki waktu keputusan; layanan persetujuan terbaru menyalin hash
ke akun sebelum mengosongkan permohonan. Login membaca `AkunPelanggan.passwordHash`,
bukan hash permohonan. Pengosongan hanya pada record permohonan tidak mengubah
hash login, sidik JWT, akun aktif, pelanggan, ADMIN atau riwayat keputusan.

Backup terbaru (di luar repository):
`../backup-database/f2-hash-2026-10-09T14-06-18-023Z/database.dump`
(path relatif dari root repository). Ukuran: **50.867 byte**.
SHA-256: `394165f18f4b13ec5e0256155fcb4f307fc176aadd5862cf3df9d3d71fca4f51`.
`pg_dump`/`pg_restore` PostgreSQL 18.6: PASS format custom, daftar TABLE DATA
empat tabel terkait tersedia, seluruh arsip dibaca/dekompresi menjadi SQL yang
dibuang. Tidak dilakukan restore ke database. Snapshot tabel terkait sama
sebelum dan setelah backup. Ini verifikasi arsip, bukan uji pemulihan ke database.

Rencana konkret: verifikasi checksum backup dan snapshot ulang, kemudian satu
transaksi Serializable mengubah **hanya passwordHash menjadi string kosong**
pada ID 1/DISETUJUI dan ID 2/DITOLAK. Harus tepat dua update dan nol hash final
tersisa. Sidik seluruh akun, pelanggan, operator dan metadata keputusan harus
tetap identik; jika tidak, rollback. Tidak ada record yang dihapus.

Sesudah persetujuan dan penerapan: ulangi audit read-only, uji login HTTP customer
dengan fixture dummy yang dibersihkan, dan bandingkan sidik akun existing.
Password asli akun existing tidak tersedia; jangan menyebut login akun asli
teruji tanpa credential sah. Saat persiapan, target nol hash masih belum tercapai;
setelah persetujuan, target berhasil dicapai sebagaimana hasil berikut.

Verifikasi persiapan terbaru: TypeScript PASS, build backend PASS, syntax tiga
script PASS, guard penerapan tanpa file rencana PASS (ditolak sebelum transaksi
perubahan), audit read-only tetap dua target. `src/lib/prisma.ts` tetap utuh.

## Hasil penerapan yang disetujui — 9 Oktober 2026

Pemilik data menyetujui pembersihan hanya passwordHash ID 1 dan ID 2 sesuai
rencana. Sebelum eksekusi, checksum backup diperiksa kembali dan cocok dengan
SHA-256 di atas; seluruh arsip kembali dibaca menggunakan `pg_restore --file=-`
ke output yang dibuang, tanpa restore. Snapshot dalam transaksi identik dengan
file rencana sebelum update. Semua pemeriksaan PASS; tidak ada rollback yang
diperlukan pada penerapan aktual.

| Verifikasi aktual | Hasil |
| --- | --- |
| Backup/checksum dan pembacaan penuh arsip sebelum penerapan | PASS |
| Snapshot target dan data terkait sebelum update | PASS, identik dengan rencana |
| Satu transaksi Serializable | PASS, tepat 2 record diperbarui |
| PasswordHash ID 1/DISETUJUI dan ID 2/DITOLAK | PASS, keduanya string kosong |
| Akun aktif, hash login, pelanggan, operator dan metadata keputusan | PASS, sidik identik sebelum/sesudah dalam transaksi |
| Audit read-only setelah commit database | PASS, 0 hash permohonan final |
| TypeScript dan build backend | PASS |
| Integrasi fondasi customer | PASS, 24 kelompok termasuk login email/telepon, profil, role, concurrency, limiter dan cleanup |
| Regresi reset password | PASS, 11 kelompok termasuk login password baru, token sekali pakai dan rollback fault injection pada dummy |
| API publik dan kontrak operator | PASS, kedua endpoint publik tanpa JWT, hanya aktif, whitelist field dan proteksi operator |
| Cleanup fixture | PASS, seluruh fixture ketiga suite dibersihkan |
| Verifikasi independen sesudah seluruh pengujian | PASS, target tetap kosong, 0 hash final, sidik akun/pelanggan/operator/keputusan identik dengan rencana awal |

Login HTTP customer diuji menggunakan akun dummy dengan password yang diketahui.
Login akun existing ID 2 tidak diklaim diuji dengan password asli; keutuhan seluruh
record akun beserta hash login dan status pelanggan dibuktikan lewat perbandingan
sidik terhadap snapshot sebelum pembersihan. Tidak ada password/hash login yang
diubah atau direset pada akun existing. Tidak ada record permohonan/pelanggan
yang dihapus oleh transaksi pembersihan.

Backup dan file rencana tetap disimpan di luar repository. `src/lib/prisma.ts`
tidak disentuh; commit tindak lanjut hanya mengubah dokumentasi laporan ini.
