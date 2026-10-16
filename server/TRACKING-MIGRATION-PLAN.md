# Rencana aktivasi tracking booking tamu

16 Oktober 2026. Rencana ini sudah disetujui dan diterapkan satu kali pada database lokal. Jangan menjalankan ulang SQL secara manual. Hasil aktual tersedia di `../docs/audit/DASHBOARD-TRACKING-BOOKING.md`.

Migration additive `20261016160000_tambahkan_tracking_booking`:

- AksesBookingTamu: trackingHash nullable unik (SHA-256), trackingTerenkripsi nullable (AES-256-GCM dengan AAD bookingId/versi), versiAkses default1.
- SesiBookingTamu: hash sesi256bit, relasi akses booking, versi, sumber sementara/tracking, waktu kedaluwarsa. Tidak menyimpan sesi plaintext di DB.
- Constraint format/hash/versi dan FK Restrict; tidak menghapus atau memperbarui booking, pelanggan, pembayaran, ledger, invoice atau row legacy.
- SQL dalam transaksi dengan lock_timeout5detik. Tidak mengulang migration sebelumnya.

Kode baru memakai randomBytes16 =128bit, format BB diikuti8 kelompok masing-masing4 digit heksadesimal. Kode bukan nomor referensi booking. Kode hanya diterbitkan setelah ringkasan ledger existing membuktikan DP sah dan booking sudah melalui konfirmasi. Webhook keuangan tidak diubah. Penerbitan lazy di bawah row lock; refresh/replay hanya membaca kode aktif yang sama.

Kode dicari lewat POST body, kemudian diganti sesi HttpOnly/SameSite=Lax; Secure wajib HTTPS/Production. Cookie lokal tidak Secure pada HTTP localhost. Origin browser baru dibatasi origin Customer Web yang dikonfigurasi. Token, kode, dan Snap token tidak diletakkan pada URL baru. Sesi checkout24jam (dibatasi expiry akses existing); sesi tracking8jam. Semua sesi dicabut melalui versi saat ADMIN menerbitkan pengganti setelah verifikasi identitas manual. Penggantian juga mencabut token tautan legacy untuk booking tersebut, dengan audit tanpa kode.

Kunci AES independen32byte diperlukan: BOOKING_TRACKING_ENCRYPTION_KEY (base64). Usulan: buat aman secara lokal dan tambahkan hanya variabel baru ke server/.env setelah persetujuan, tanpa mencetak nilai, menimpa variabel lain, atau memasukkannya ke Git/backup source. Kunci perlu dicadangkan secara privat untuk pemulihan database; mengganti/menghilangkannya membuat kode terenkripsi tidak dapat ditampilkan kembali sampai recovery ADMIN.

Sebelum penerapan utama: backup database terbaru pg_dump custom, checksum, pg_restore --list serta dekompresi, snapshot semua row existing (UTC). Uji migration dan suite pada database fixture khusus yang sudah tersedia terlebih dahulu. Sesudah penerapan: pastikan row existing tetap sama ketika kolom baru dikecualikan dan semua migration selesai. Akses lama tetap berlaku hingga expiry/recovery; tidak ada backfill kode massal. Aktivasi lokal/backend restart terkontrol memakai source asli setelah build.

Persetujuan yang diminta: menerapkan tepat migration additive ini setelah backup/tes lolos; membuat serta menambahkan satu kunci enkripsi lokal baru tanpa mengubah credential existing. Tidak mencakup transaksi provider baru, push, merge, reset DB atau Production. Jika preflight gagal, jangan menerapkan migration utama.
