# Rencana terbatas: Walk-in Dashboard

Status: **DISETUJUI dan DITERAPKAN** pada 17 Oktober 2026, setelah pengujian fixture.
Persetujuan eksplisit pengguna: ?Setujui migration terbatas dan backup?.
Migration: `20261017120000_pelanggan_opsional_dan_idempotensi_walkin`.
Pemeriksaan awal kedua database: nol migration tertunda/gagal sebelum migration ini dibuat.
Fixture migration + Prisma validate/generate PASS. Backup utama dibuat 08:35:04 UTC,
arsip custom-format 148.196 byte, checksum SHA-256
`19f78ba3ed43d8384abe20f0549dc33472b280f60fdc66055812068dd986abb9`.
Lokasi privat: `%LOCALAPPDATA%/BARBERBARBAR/database-backups/e2e-2026-10-17T08-35-04-306Z`.
Checksum, daftar isi, pembacaan penuh pg_restore tanpa restore, dan snapshot diverifikasi.
Snapshot 22 model domain identik sebelum/sesudah penerapan utama; tabel teknis baru kosong,
nullable terverifikasi YES. Tidak ada reset, penghapusan record existing, atau transaksi provider.
Rincian pengujian dan bukti ada di `../docs/ui/TAMBAH-WALKIN-DASHBOARD-FINAL.md`.

Catatan berikut adalah hasil audit **sebelum** perubahan:
Audit read-only 17 Oktober 2026: kolom `Pelanggan.nomorTelepon` bertipe text,
NOT NULL, unique; 22 pelanggan existing, nol nilai NULL.

## Kebutuhan yang terbukti

1. `schema.prisma`: nomorTelepon adalah `String @unique`.
2. `skemaTambahPelanggan` dan service pelanggan mewajibkan telepon.
   Nomor kosong tidak dapat dipenuhi tanpa mengarang nomor atau perubahan schema.
3. `POST /orders` mendukung multi-layanan, barber nullable, WAITING/UNPAID dan
   histori resmi, tetapi belum punya idempotensi pembuatan, snapshot harga yang
   harus cocok, atau transaksi gabungan pelanggan baru + pesanan.
4. Staff `LayarPelanggan.tsx:92` dan `LayarBuatPesanan.tsx:146` memanggil
   `pelanggan.nomorTelepon.toLowerCase()`. Mengirim NULL tanpa adapter akan merusak
   Staff. Source Staff tidak akan diubah.

## Perubahan yang diajukan untuk satu migration non-destruktif

```sql
ALTER TABLE "Pelanggan" ALTER COLUMN "nomorTelepon" DROP NOT NULL;

CREATE TABLE "PermintaanWalkIn" (
  "id" SERIAL PRIMARY KEY,
  "penggunaId" INTEGER NOT NULL REFERENCES "Pengguna"("id") ON DELETE RESTRICT,
  "kunci" VARCHAR(128) NOT NULL,
  "sidikPermintaan" CHAR(64) NOT NULL,
  "pesananId" INTEGER NOT NULL UNIQUE REFERENCES "Pesanan"("id") ON DELETE RESTRICT,
  "dibuatPada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("penggunaId", "kunci")
);
```

Nama constraint/index migration final akan mengikuti Prisma. Unique telepon
existing tetap dipertahankan; beberapa pelanggan tanpa telepon disimpan sebagai
NULL, bukan nomor palsu atau string kosong yang dipaksakan ke kolom unique.
Tidak mengubah satu pun nilai telepon existing. Relasi Prisma tambahan hanya
mewakili FK tabel teknis baru; tidak mengubah data/aturan tabel finansial.

Tabel teknis menyimpan kunci, SHA256 request, operator dan relasi order; tidak
menyimpan nama/telepon/body request/credential. Satu record hanya dibuat bersama
pesanan sukses dalam transaksi yang sama. Kunci sama+payload sama mengembalikan
order yang sama; payload berbeda ditolak. Tabel ini bukan ledger/kasir baru.

## Source dan kompatibilitas

- Prisma: nomorTelepon menjadi `String? @unique`, tambah model PermintaanWalkIn.
- Pelanggan: adapter DTO operator mempertahankan string untuk nomor yang absen
  (`""` pada respons legacy), agar pencarian Staff existing tetap aman.
  Database tetap NULL. API registrasi/login customer tetap mewajibkan telepon
  valid dan tidak membuat akun login untuk pelanggan Walk-in tanpa telepon.
- Pesanan: ekstrak core pembuatan official ke helper transaksi; endpoint legacy
  tetap memakai helper yang sama, kontrak dan aturan finansial dipertahankan.
- Endpoint additive `POST /orders/walk-in`: transaksi pelanggan/order/idempotensi,
  validasi harga katalog dan membership resmi, barber aktif/penugasan valid,
  satu WAITING/UNPAID beserta histori. `GET /orders/walk-in/requests/:kunci`
  untuk memeriksa hasil request yang responsnya terputus, hanya operator pemilik.
- UI drawer memakai katalog/pelanggan/barber existing; tidak membuat kasir kedua.
  Tidak menyunting Customer Web, Mobile Staff, atau file Prisma historis.

## Urutan eksekusi setelah disetujui

1. Periksa migration status dan schema aktual; hentikan jika ada pending migration
   lain atau drift yang tidak termasuk rencana.
2. Implementasi dan uji migration/source pada DB fixture terisolasi existing
   terlebih dahulu; cleanup hanya ID suite. Tidak reset atau drop database.
3. Buat backup custom-format dan snapshot database utama di lokasi backup privat
   existing; verifikasi checksum, `pg_restore --list` dan pembacaan arsip ke stdout
   yang dibuang, tanpa restore ke database. Verifikasi snapshot tetap cocok.
4. Terapkan hanya migration ini pada database utama. Jangan menjalankan migration
   lain yang belum disetujui. Periksa ulang seluruh record/relasi/harga/ledger
   existing melalui snapshot; perubahan yang diizinkan hanya schema dan metadata
   migration. Tidak membuat fixture pada database utama.
5. Jika validasi migration gagal, rollback transaksi DDL sebelum commit bila
   belum tersimpan. Jangan reset/restore massal atau menghapus record pengguna.
   Mengembalikan NOT NULL hanya aman jika belum ada nilai NULL; jangan memaksanya
   setelah pelanggan tanpa telepon mulai dipakai.
6. TypeScript/build, tes integrasi terisolasi, browser utama baca-saja dan
   screenshot; commit lokal terbatas. Tanpa push/merge/transaksi provider.

Backup dan snapshot tidak disimpan dalam repository/ZIP publik, tidak mencetak
nilai credential atau data pelanggan. Bila ada perubahan data oleh pengguna
selama pemeriksaan, jangan menghapusnya; buat baseline baru/ulang verifikasi.
