# Simulasi reset password customer (F2)

Endpoint publik:

- `POST /auth/customer/forgot-password`: body `{ "email": "customer@example.com" }`.
- `POST /auth/customer/reset-password`: body `{ "token": "token-hex-64-karakter", "password": "password-baru" }`.

Forgot-password mengembalikan status 200, pesan umum dan flag global
`pengirimanTersedia` yang sama untuk email terdaftar maupun tidak. Token tidak
masuk response atau log server. Pengiriman nyata belum tersedia: belum ada
provider/credential atau adapter produksi yang disetujui. Kontrak transport,
template HTML/teks, pembatasan pekerjaan dan pengujian mock sudah tersedia di
`email-reset-pelanggan.service.ts`. Token baru diterbitkan bila transport tersedia.
Token asli dihasilkan oleh service internal dan hanya hash SHA-256
disimpan, berlaku 30 menit. Reset memakai bcrypt cost 12 dan transaksi dengan
lock akun, klaim token, perubahan password, serta pembatalan token lain.
`digunakanPada` non-null berarti token sudah dikonsumsi atau dibatalkan.

Dari folder `server`, gunakan dependency yang sudah tersedia:

```powershell
npm.cmd run build
node scripts/test-reset-password-pelanggan.mjs
```

Script memakai DATABASE_URL lokal yang sudah dikonfigurasi, membuat account
dummy unik dengan domain `example.invalid`, menjalankan Express di port acak
loopback, dan membersihkan hanya data yang dibuatnya. Tidak ada migration atau
reset database. Jangan hentikan proses secara paksa agar cleanup dapat selesai.
Hash password operator existing hanya dibaca untuk pemeriksaan, tidak diubah.

Untuk menghasilkan token dummy yang dapat dicoba manual:

```powershell
node scripts/test-reset-password-pelanggan.mjs --token-local
```

Mode ini membutuhkan terminal interaktif, menampilkan token serta credential
dummy hanya pada terminal developer, lalu menunggu Enter sebelum menghapusnya.
Jangan merekam terminal, mengarahkan output ke file, atau menyimpan token ke Git.
Tidak menerima email account existing. Mode pengujian otomatis tidak mencetak
token/password. Jalankan kembali build setelah perubahan source.

Reset password mencabut seluruh JWT customer lama melalui sidik kredensial
HMAC yang diperiksa terhadap hash password saat ini. JWT customer sebelum
perubahan sidik juga ditolak dan memerlukan login ulang; JWT ADMIN/STAFF tetap.
Rate limit customer berlaku per IP per 15 menit: login/register 20 percobaan,
forgot 10, reset 30. Counter lokal satu proses; deployment multi-instance
memerlukan limiter bersama. PATCH profil dibatasi 20 percobaan per 15 menit;
identitas/password memerlukan passwordSaatIni, mencabut sesi/token reset lama.
Integrasi pengiriman masih diperlukan sebelum akses reset customer sungguhan.
Lihat [penutupan acceptance](../../docs/FINAL-ACCEPTANCE-CLOSURE.md).

## Persiapan delivery tanpa credential

Isi hanya secara manual di `server/.env` setelah provider disetujui:

```dotenv
EMAIL_RESET_FROM="noreply@example.com"
CUSTOMER_PASSWORD_RESET_URL="barberbarbar-customer://reset-password"
```

Contoh alamat bukan credential aktif. Mengisi dua variabel ini **belum**
mengaktifkan email: `gerbangEmailReset.kirim` default null. Pilih SMTP atau
provider HTTP terlebih dahulu; jangan memasang paket atau mengarang key.
SMTP yang diusulkan: `npm.cmd install nodemailer@10.1.1` (types sudah tersedia),
**hanya setelah persetujuan**. Variabel SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS
dan kebijakan TLS dipersiapkan bersama adapter setelah pilihan provider jelas;
jangan mengisi atau mengirim credential melalui chat/source.

Transport berjalan di luar respons HTTP untuk menghindari bocornya akun dari
latensi provider; respons tidak menyatakan email terkirim. Batas 20 pekerjaan
bersamaan, dedup alamat 60 detik, 1.000 sidik alamat, timeout 15 detik dengan
AbortSignal. Adapter wajib menghormati sinyal abort dan tidak mencetak pesan.
Token pengiriman gagal dicabut tanpa mengubah akun/token lain. Tidak ada retry
otomatis. Pekerjaan masih di memori, tidak durable saat restart; pelanggan perlu
mengajukan ulang bila proses terhenti. Ini masih batas kesiapan delivery.

Link native memakai fragment token, bukan query HTTP. Jangan meneruskan link
ke analytics/log. Custom scheme perlu native/development build; untuk rilis
publik, pertimbangkan domain HTTPS milik merchant dengan Android App Links
terverifikasi untuk menghindari aplikasi lain mengklaim custom scheme.

Pengujian mandiri transport mock (akun dummy, disarankan DATABASE_URL terisolasi):

```powershell
node scripts/test-penutupan-akun.mjs
```

Delivery inbox dan deep link Android nyata tetap DEFERRED sampai provider,
alamat uji milik pemilik, dan perangkat/build tersedia.
