# Simulasi reset password customer (F2)

Endpoint publik:

- `POST /auth/customer/forgot-password`: body `{ "email": "customer@example.com" }`.
- `POST /auth/customer/reset-password`: body `{ "token": "token-hex-64-karakter", "password": "password-baru" }`.

Forgot-password mengembalikan status 200 dan pesan umum yang sama untuk email
terdaftar maupun tidak. Token tidak masuk response atau log server. Pengiriman
email belum tersedia: endpoint ini baru fondasi, belum dapat dipakai customer
sungguhan. Token asli dihasilkan oleh service internal dan hanya hash SHA-256
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

Sesi JWT customer yang telah diterbitkan tetap mengikuti perilaku autentikasi
existing; fitur ini tidak menambahkan revocation JWT. Rate limit dan integrasi
pengiriman perlu disiapkan sebelum akses reset untuk customer sungguhan.
