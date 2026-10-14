# F3 Membership Request — Audit dan hasil aktual

14 Oktober 2026 · `feature/project5-integration`.

**Status: selesai untuk scope yang disetujui: backend + panel ADMIN Project 3 +
komponen React customer siap integrasi.** Bukan aplikasi Project 5 utuh. Source
host customer/PRD v2.0/handover tidak ditemukan. Keputusan pengguna: INACTIVE hanya
ADMIN reaktivasi, approval customer 10%, kebijakan diskon operator existing tetap.
Tidak ada instalasi dependency, extension, software atau perubahan environment.

## Audit source awal

- Model Pelanggan/AkunPelanggan/Membership dan status AKTIF/DIBLOKIR sudah tersedia.
- Membership mempunyai pelangganId unik, memberCode unik, discountPercent default
  10 dan isActive. Empat record existing semuanya aktif dan berdiskon 10%.
- Operator POST `/memberships` dapat digunakan ADMIN/STAFF; PATCH/DELETE ADMIN-only.
  Controller/schema, URL dan format respons operator dipertahankan.
- JWT CUSTOMER dipisahkan dari ADMIN/STAFF oleh middleware F2; akun blocked dan JWT
  kredensial lama ditolak. F3 menggunakan middleware tersebut tanpa mengubahnya.
- Pesanan existing menghitung diskon backend dari Membership dan menyimpan
  discountPercent/diskon/total. Source pesanan dan Project 4 tidak diubah.
- Tidak ada penyimpanan permohonan membership sebelum F3; F2-AUDIT sudah ditutup
  untuk temuan hash final. Regresi hash final tetap nol.

## Database dan integritas

Migration `20261014074849_tambah_permohonan_membership` dibuat **create-only**,
ditinjau, lalu diterapkan menggunakan `migrate deploy`. SQL hanya CREATE enum,
CREATE tabel baru, CREATE index dan FK pada tabel baru; tidak ada update/delete
data existing. Dibungkus BEGIN/COMMIT. Status enum PENDING_APPROVAL/APPROVED/REJECTED.
Unique index parsial memastikan satu pending per pelanggan; FK customer Restrict
melindungi riwayat. Metadata keputusan menggunakan ADMIN existing.

Backup sebelum migration:
`Stage 2/backup-database/f3-2026-10-14T07-52-32-554Z/database.dump`.
Ukuran 50.766 byte; SHA-256
`a21354e645de697ff4b5e35c8fa2d7bb9f5bbf985af6ceda015ab462359ad697`.
PASS custom archive, daftar isi, pembacaan/dekompresi penuh tanpa restore,
checksum dan perbandingan snapshot data sebelum/sesudah backup. Tidak dilakukan
restore trial. Dump/manifest berada di luar Git dan ZIP.

Pengajuan, approval dan pembuatan membership operator mengambil lock baris
Pelanggan yang sama dalam transaksi. Keputusan mengklaim status pending secara
bersyarat dan pembuatan Membership terjadi dalam transaksi yang sama. Helper
kode member dibagi bersama flow operator; advisory transaction lock melindungi
alokasi MEM-xxx. Tidak ada benefit/tier/poin kedua.

Jika operator membuat member sementara pending, Membership existing tetap
authoritative; ADMIN dapat acknowledge approval tanpa membuat ulang membership.
Reject tidak boleh mencabut benefit tersebut (409). Nonaktif tidak otomatis
direaktivasi oleh customer/approval. Detail mapping dan API: README-INSTALASI.md.

## Hasil pengujian

| Pengujian | Hasil |
| --- | --- |
| Non-member melihat status sendiri; login CUSTOMER wajib | PASS |
| Ajukan tanpa formulir / identitas dari JWT | PASS |
| Dua pengajuan bersamaan / duplicate / unique index aktual | PASS |
| Body identitas/diskon injection | PASS, 400 |
| ADMIN melihat daftar tanpa hash/kontak customer | PASS |
| ADMIN approve membuat Membership existing 10% | PASS |
| ADMIN reject kembali NON_MEMBER dan dapat ajukan ulang | PASS |
| STAFF approve/reject/list | PASS, 403 |
| CUSTOMER akses ADMIN / JWT operator pada customer | PASS, 401 |
| Customer mencoba membaca permohonan/customer lain | PASS, ID query tidak mengganti identitas; detail tidak tersedia |
| Dua ADMIN approve bersamaan | PASS, 200/409, satu Membership |
| Approve versus reject bersamaan | PASS, satu keputusan konsisten |
| Approval versus pendaftaran STAFF existing | PASS, satu Membership |
| Rollback fault injection pembuatan membership | PASS, keputusan kembali pending |
| DIBLOKIR | PASS, pengajuan/login ditolak, approval 409; ADMIN dapat reject |
| STAFF create / ADMIN update / STAFF update ditolak | PASS, kontrak operator existing |
| INACTIVE dan reaktivasi ADMIN existing | PASS |
| Diskon operator non-10 tetap berlaku (fixture 15%) | PASS, sesuai keputusan pengguna |
| Pesanan non-member/10%, backend authoritative | PASS, fixture 100.000 → 90.000; body diskon tidak mengubah hasil |
| Nominal pesanan historis setelah perubahan membership | PASS, tidak berubah |
| TypeScript backend strict / build backend | PASS |
| TypeScript/build client React | PASS |
| Prisma validation / migration status | PASS, schema valid dan DB up to date |
| Regresi F2 fondasi customer | PASS, 24 kelompok |
| Regresi F2 reset password | PASS, 11 kelompok |
| Regresi API publik + proteksi operator | PASS |
| Cleanup seluruh fixture F3/F2 | PASS |
| Seluruh data existing setelah migration dan semua tes | PASS, sidik 12 model identik dengan manifest backup sebelum migration |
| Fixture tabel permohonan F3 tersisa | PASS, 0 |
| Dua file dilindungi | PASS, sidik file tetap sama; tidak masuk stage/ZIP |
| Visual/browser/device Project 5 | BELUM DIJALANKAN, source host belum tersedia |
| Booking customer / DP 50% / F4-F6 | DI LUAR SCOPE, tidak diimplementasikan |

Suite `test-membership-f3.mjs` memiliki 12 kelompok PASS + cleanup. Pengujian
HTTP menggunakan loopback server dan akun dummy dengan credential acak. Suite
dijalankan berurutan; hanya fixture proses masing-masing yang dibersihkan.
Prisma/pg mengeluarkan deprecation warning pada query pesanan existing;
build Vite mengeluarkan warning annotation Zod dan bundle >500 kB. Semua exit
code pengujian/build final 0; tidak mengganti dependency untuk warning tersebut.

## File dan distribusi

Daftar lengkap 15 file baru/berubah tersedia dalam README-INSTALASI.md. ZIP
`Stage 2/BARBERBARBAR-F3-MEMBERSHIP.zip` hanya memuat whitelist file tersebut dengan
prefix `barberbarbar/`. Setiap entry dibaca kembali dan dibandingkan SHA-256
dengan file source; tidak ada node_modules/.git/.env/dump/token atau dua file
lokal dilindungi. ZIP bukan bagian commit. Source F3 sudah diterapkan di working
tree, sehingga workspace ini tidak memerlukan replace ulang.

## Batas praktis

- Master PRD/handover dan source Project 5 belum tersedia; kesesuaian penuh terhadap
  dokumen tersebut serta integrasi UI host belum dapat diverifikasi.
- Customer React siap integrasi menerima token dari props dan menggunakan same-origin
  API/proxy host; belum ada halaman/login Project 5 baru.
- F4/F6 perlu memakai kontrak Membership authoritative dan snapshot pada booking;
  DP dihitung sesudah diskon ketika tahap tersebut diimplementasikan.
- Tidak ada push/merge; source operator dan Project 4 di luar file daftar paket
  tidak diubah. Dua file dilindungi tetap dirty seperti sebelum pekerjaan.
