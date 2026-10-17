# Rencana additive pembayaran operasional

Status 17 Oktober 2026: disetujui pengguna dan diterapkan setelah fixture PASS.
Migration: `20261017140000_pembayaran_operasional`.
Backup utama privat: `%LOCALAPPDATA%/BARBERBARBAR/database-backups/e2e-2026-10-17T11-27-42-446Z`,
152.512 byte; SHA-256 `0843b8ab363abfb05e9c5c138111e563e2780a37df90472c2806b0cb763e37e8`.
Checksum, daftar/pembacaan penuh pg_restore tanpa restore, serta snapshot 22 model
existing identik sebelum/sesudah. Tabel baru kosong saat penerapan utama.

Hasil audit sebelum perubahan: Persetujuan Walk-in sebelumnya hanya
mencakup nullable telepon dan PermintaanWalkIn; tidak mencakup penyimpanan QRIS.

Temuan: Pembayaran legacy hanya kuitansi final, tanpa reservasi provider,
idempotensi per request, audit referensi transfer/operator, atau penyimpanan QRIS.
TransaksiPembayaranBooking wajib bookingId, sehingga tidak dapat dipakai untuk
Walk-in tanpa mengarang Booking. DP/Snap/ledger Booking existing dipertahankan.

Rencana satu migration additive: satu tabel PembayaranOperasional dengan FK ke
Pesanan dan Pengguna, optional FK unik ke TransaksiPembayaranBooking serta
Pembayaran final. Kolom: UUID id/kunci idempotensi, fingerprint SHA256 request,
metode CASH/TRANSFER/QRIS, status PENDING/SUCCEEDED/FAILED/EXPIRED, nominal dari
DB, uang diterima/kembalian, referensi transfer, provider order/transaction ID
unik, URL QRIS resmi, expiry, fase request provider (CREATING/UNCERTAIN/READY),
status/bukti hash verifikasi, waktu pembuatan/pembayaran/verifikasi.

Constraint: nominal positif, metode dibatasi tiga pilihan, FK RESTRICT,
unique kunci, unique identitas provider dan satu transaksi PENDING per Pesanan
(partial unique index). Tidak mengubah record, kolom, atau enum existing.
Relasi Prisma ditambahkan tanpa mengubah kontrak API lama.

Ledger Booking tetap sumber kredit Booking; sidecar menautkan transaksi dan
invoice existing, tidak menghitung pembayaran dua kali. Walk-in tetap memakai
Pembayaran final existing; sidecar menyimpan reservasi/audit/bukti provider.
Pending QRIS menghalangi pembayaran kasir dan edit item legacy secara atomik.
Booking Snap existing dilarang mengambil alih intent QRIS inline yang aktif.
Webhook baru memverifikasi signature dan Get Status, lalu memakai finalisasi
Booking existing atau membuat kuitansi Walk-in dalam transaksi terkunci.

Urutan: schema/SQL review; migration + integrasi pada fixture existing terisolasi;
backup utama privat pg_dump, checksum dan pg_restore tanpa restore, snapshot
terverifikasi; cek tidak ada migration lain tertunda; terapkan hanya migration
ini; verifikasi record domain existing identik. Tidak reset/drop/Production.
Jangan menerapkan pada utama sebelum persetujuan pengguna. Provider Sandbox
nyata diuji dengan fixture yang diberi identitas khusus; pembayaran manual oleh
pengguna jika perlu. Tidak pernah mencetak key/token atau mengubah credential.
