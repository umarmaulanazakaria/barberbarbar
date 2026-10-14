# BARBER BARBAR — Paket F3 Membership Request

14 Oktober 2026 · branch `feature/project5-integration`.

F3 tersedia sebagai API backend, panel keputusan ADMIN pada halaman Membership
Project 3, dan komponen React customer siap integrasi. Sesuai jawaban pemilik proyek,
source Project 5 yang belum tersedia tidak dibuat ulang. Project 4 tidak diubah.
Master PRD v2.0/handover tidak ditemukan; implementasi mengikuti requirement F3
dan keputusan eksplisit pengguna. Detail pengujian: `server/F3-AUDIT.md`.

## Lokasi ekstraksi / replace

ZIP `BARBERBARBAR-F3-MEMBERSHIP.zip` menggunakan struktur `barberbarbar/...`.
Ekstrak ke folder **Stage 2** (parent repository Project 3), sehingga file masuk
ke `Stage 2/barberbarbar`. Semua file di paket adalah file lengkap, bukan patch.
Backup versi lama dari file-file pada daftar di bawah sebelum replace.

**Working tree yang dikerjakan sudah berisi F3 dan migration sudah diterapkan.**
Tidak perlu replace ulang di workspace tersebut. ZIP ditujukan untuk distribusi
ke checkout lain dengan baseline F2 yang sudah lengkap. Pastikan checkout tujuan
berada di branch yang benar dan tidak memiliki perubahan lokal pada file target.

Paket tidak menyertakan `.env`, dependency, dump database, generated Prisma,
build output, Git, atau token. Dua file yang wajib dilindungi **tidak disertakan**:
`barberbarbar/server/src/lib/prisma.ts` dan
`barberbarbar-mobile/src/layar/LayarTambahPelanggan.tsx`.

## Prasyarat dan backup

Tidak ada dependency, extension VS Code, software atau variabel environment baru.
Gunakan Node/npm, dependency Project 3/F2 existing, PostgreSQL, Prisma CLI, serta
`DATABASE_URL` dan `JWT_SECRET` existing. Jangan mengubah credential.

Sebelum migration di checkout tujuan:

1. Backup file source yang akan diganti.
2. Buat backup PostgreSQL dengan tooling existing, misalnya:
   `pg_dump -h localhost -U <user> -d <database> --format=custom --file=<lokasi-backup-di-luar-repository>`.
   Jangan memasukkan password ke argumen atau Git.
3. Verifikasi arsip dengan `pg_restore --list <arsip>` dan baca seluruh arsip
   tanpa restore, misalnya PowerShell `pg_restore --file=- <arsip> | Out-Null`.
   Pastikan exit code 0 dan catat SHA-256 (`Get-FileHash <arsip>`).
4. Tinjau `server/prisma/migrations/20261014074849_tambah_permohonan_membership/migration.sql`.
   SQL hanya menambah enum, tabel baru, indeks dan FK pada tabel baru; tidak
   mengubah data membership/customer existing. Jangan menjalankan reset database.

Alternatif backup setelah file script tersedia dan build F2 tersedia:
`node scripts/backup-f3.mjs` dari `server`. Script khusus database lokal;
backup tersimpan di `Stage 2/backup-database`, bukan dalam repository.

## Migration dan build

Dari `Stage 2/barberbarbar/server`:

```powershell
node node_modules/prisma/build/index.js validate
node node_modules/prisma/build/index.js migrate status
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js generate
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false --noUnusedLocals --noUnusedParameters
npm.cmd run build
```

Gunakan `migrate deploy`, bukan `migrate dev`/reset untuk penerapan paket.
Migration sudah dibuat create-only dan ditinjau. Tabel baru memiliki unique index
parsial untuk satu PENDING_APPROVAL per pelanggan; index tersebut didefinisikan
dalam SQL. Pertahankan index tersebut saat membuat migration berikutnya.

Dari `barberbarbar/client`, jalankan `npm.cmd run build`. Restart backend/client
dengan cara startup existing. Tidak perlu menginstal atau memperbarui package.

## Kontrak API F3

| Method/path | JWT | Fungsi |
| --- | --- | --- |
| GET `/customer/membership` | CUSTOMER | Status membership sendiri |
| POST `/customer/membership/requests` | CUSTOMER | Ajukan dengan body `{}` atau tanpa body |
| GET `/membership-requests` | ADMIN | Daftar permohonan dan keputusan |
| POST `/membership-requests/:id/approve` | ADMIN | Setujui atomik |
| POST `/membership-requests/:id/reject` | ADMIN | Tolak atomik |

Keputusan dapat memakai `{ "catatanKeputusan": "..." }` (opsional, maksimal 500
karakter). CUSTOMER tidak memiliki endpoint list/detail/update permohonan orang
lain. Query ID tidak mengganti identitas; body pengajuan yang mengandung identitas
atau diskon ditolak 400. JWT operator pada API customer ditolak 401; STAFF pada
API keputusan ditolak 403; CUSTOMER pada API ADMIN ditolak 401.

GET customer mengembalikan `status`, `dapatMengajukan`, `diskonPersen`, `membership`
dan `permohonan` terbaru milik sendiri. Tidak ada identitas operator/customer lain,
hash password atau kontak customer lain. Pengajuan berhasil 201, konflik 409.
Keputusan berhasil 200, sudah diputuskan/konflik 409, ID tidak ditemukan 404.

Mapping sesuai keputusan pengguna:

- Tanpa Membership/pending: `NON_MEMBER`, diskon 0, boleh mengajukan.
- Pending dan belum memiliki Membership: `PENDING_APPROVAL`, diskon 0.
- Membership `isActive=true`: `ACTIVE`, diskon mengikuti Membership existing.
- Membership `isActive=false`: `INACTIVE`, diskon 0, tidak dapat mengajukan;
  hanya ADMIN dapat reaktivasi lewat API existing.
- Penolakan tanpa Membership: kembali `NON_MEMBER`; dapat mengajukan ulang.

Membership yang dibuat lewat approval customer selalu 10%, menggunakan tabel dan
format kode member existing. Kebijakan API operator diskon 0–100% dipertahankan
sesuai keputusan pengguna. Tidak ada sistem benefit kedua.

Jika operator langsung mendaftarkan member saat permohonan masih pending,
Membership existing menjadi authoritative dan status customer ACTIVE. Pending
tetap hanya dapat diputuskan ADMIN; approval mengakui Membership existing tanpa
membuat duplikat/mengubah benefit. Reject ditolak 409 agar tidak mencabut benefit
operator. Jika Membership existing nonaktif, approval tidak mereaktivasi;
reaktivasi tetap hanya melalui flow ADMIN existing.

## Komponen customer / panel ADMIN

Panel permohonan otomatis tampil pada halaman Membership Project 3 hanya untuk
ADMIN. Flow create oleh ADMIN/STAFF serta edit/delete ADMIN existing tetap ada.

Komponen customer terletak di
`client/src/components/customer/MembershipPelanggan.tsx`. Integrasikan ke host
React Project 5 dengan token CUSTOMER milik sesi login host:

```tsx
<MembershipPelanggan tokenCustomer={tokenSesiCustomer} alamatApi="/api" />
```

Komponen memiliki status, tombol Ajukan Membership tanpa formulir, status pending,
INACTIVE, benefit aktif, dan tombol Perbarui status. Token diberikan lewat props;
tidak membaca/menyimpan token operator di localStorage. Ganti token/cleanup akan
membatalkan fetch lama. Gunakan same-origin `/api` atau proxy existing; konfigurasi
lintas origin Project 5 mengikuti host aplikasi saat source-nya tersedia.
Komponen ini belum dipasang pada halaman customer nyata karena host belum tersedia.

## Pengujian

Dari `server`, jalankan **berurutan**, hanya database lokal dengan fixture dummy:

```powershell
node scripts/test-membership-f3.mjs
node scripts/test-fondasi-pelanggan.mjs
node scripts/test-reset-password-pelanggan.mjs
node scripts/test-api-publik.mjs
```

Script F3 membersihkan fixture yang dibuat proses sendiri. Jangan menjalankan
suite bersamaan karena suite reset memeriksa hash operator existing. Tidak
menggunakan akun/data customer sebenarnya. Validasi HTTP/integrasi, TypeScript,
build dan Prisma lulus; UI/browser/device Project 5 belum diuji pada host nyata.

Booking customer, DP 50%, dan F4/F6 tidak ditambahkan. Pesanan Project 3 existing
tetap menyimpan snapshot diskon/nominal dari backend; regresinya diuji dengan
pesanan dummy sebelum/sesudah perubahan membership.

## Rollback aman

Jika rollback kode diperlukan, hentikan proses aplikasi lalu pulihkan **hanya
file pada daftar paket** dari backup source/baseline F2. Jangan menyentuh dua file
lokal yang dilindungi. Build kembali dan restart dengan flow existing.

Pertahankan tabel/migration F3 yang sudah diterapkan: perubahan bersifat additive
dan source F2 tidak menggunakannya. Jangan drop tabel, menghapus riwayat permohonan,
menjalankan reset, atau otomatis restore database existing. Jika pemulihan database
diperlukan, tinjau arsip dan rencana pemulihan terpisah terlebih dahulu dengan
persetujuan pemilik data. Backup dapat diverifikasi di database isolasi, tanpa
menimpa database existing.

## Daftar file paket

Semua path berikut relatif root ZIP / Stage 2:

1. `barberbarbar/README-INSTALASI.md` — baru.
2. `barberbarbar/server/F3-AUDIT.md` — baru.
3. `barberbarbar/server/prisma/schema.prisma` — berubah.
4. `barberbarbar/server/prisma/migrations/20261014074849_tambah_permohonan_membership/migration.sql` — baru.
5. `barberbarbar/server/src/app.ts` — berubah.
6. `barberbarbar/server/src/services/membership.service.ts` — berubah.
7. `barberbarbar/server/src/services/permohonan-membership.service.ts` — baru.
8. `barberbarbar/server/src/controllers/permohonan-membership.controller.ts` — baru.
9. `barberbarbar/server/src/routes/membership-pelanggan.routes.ts` — baru.
10. `barberbarbar/server/src/routes/permohonan-membership.routes.ts` — baru.
11. `barberbarbar/server/scripts/backup-f3.mjs` — baru.
12. `barberbarbar/server/scripts/test-membership-f3.mjs` — baru.
13. `barberbarbar/client/src/pages/MembershipPage.tsx` — berubah.
14. `barberbarbar/client/src/components/PermohonanMembershipAdmin.tsx` — baru.
15. `barberbarbar/client/src/components/customer/MembershipPelanggan.tsx` — baru.
