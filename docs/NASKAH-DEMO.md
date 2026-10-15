# Naskah demonstrasi

Durasi berikut adalah **target naskah**, belum diukur dalam presentasi nyata. Gunakan data dummy dan credential privat. Jangan menampilkan environment, password, JWT, token reset atau URL Snap. Persiapkan layar sebelum merekam.

## Versi ringkas — sekitar 5 menit

| Target | Ucapan dan tindakan |
|---|---|
| 0:00–0:40 | “BARBER BARBAR adalah sistem manajemen dan booking barbershop untuk pembelajaran Fullstack dan demo lokal. Masalahnya adalah pencatatan pemesanan, layanan dan pembayaran yang terpisah.” |
| 0:40–1:10 | “Web Management, Mobile Staff dan Customer mengakses satu backend Express/PostgreSQL. Backend menentukan hak akses dan tagihan.” Tampilkan diagram. |
| 1:10–2:00 | Customer: katalog → login dummy yang sudah disiapkan → dua layanan/qty → cari barber → jadwal → booking. “Status awal Menunggu Konfirmasi.” |
| 2:00–2:40 | Web: buka booking, periksa detail dan konfirmasi. “Perubahan memicu realtime, Customer mengambil status terbaru.” |
| 2:40–3:30 | Staff: fixture dengan DP sah → check-in → barber final → mulai → selesai. “Layanan memerlukan prasyarat pembayaran.” |
| 3:30–4:25 | Tampilkan sisa tagihan dan invoice fixture lunas. “Nominal berasal dari database. Provider mock pada tes dibedakan dari Sandbox nyata. Tidak membuat pembayaran baru hanya untuk laporan.” |
| 4:25–5:00 | Tunjukkan reconnect/refetch dan hasil tes. “Email nyata dan refund historis belum terbukti; laporan perangkat berbeda dari bukti otomatis.” |

## Versi lengkap — sekitar 10–15 menit

1. **0:00–1:00, pembukaan dan masalah.** Perkenalkan tujuan akademik dan peran customer, staf, admin. Jelaskan kebutuhan menyatukan booking, layanan dan pembayaran.
2. **1:00–2:00, solusi dan arsitektur.** Tampilkan diagram. Jelaskan REST untuk data, Prisma untuk PostgreSQL, JWT untuk batas akses, dan satu backend bagi tiga aplikasi.
3. **2:00–4:00, Customer.** Katalog tanpa login, registrasi/login dummy, dua layanan/qty, searchable dropdown, tanggal/jam dan booking pending. Harga authoritative server. Membership opsional: pengajuan 10% memerlukan ADMIN.
4. **4:00–5:30, Web.** Login sebelum rekaman; cari booking, periksa jadwal/detail, konfirmasi. Tunjukkan status Customer berubah tanpa refresh manual. Keputusan membership/refund dibatasi ADMIN.
5. **5:30–7:00, DP.** Hanya jika transaksi baru telah diotorisasi, buka checkout Sandbox dan ikuti simulator resmi sampai backend terverifikasi. Jika tidak, pakai bukti sah yang tersedia atau harness MOCK dan sebutkan jenisnya. Jangan memalsukan DP pada database aplikasi.
6. **7:00–9:00, Staff.** Check-in sesudah DP sah, barber final, mulai layanan/pesanan. Ubah item bila relevan, lalu COMPLETED. Perlihatkan status Customer.
7. **9:00–11:00, pembayaran.** Tagihan setelah perubahan item, pelunasan setelah COMPLETED, balance nol dan satu invoice. Harness Web memakai kasir dummy; jangan menyebut itu checkout online Android nyata. Buka riwayat Customer.
8. **11:00–12:00, realtime.** Putus-sambung koneksi dummy, kembali aktif dan periksa refetch. Tanpa HP tunjukkan tes reconnect, bukan berpura-pura melakukan tindakan native.
9. **12:00–13:00, pengujian.** Bedakan HTTP/database, Web aktual, adapter mobile, Hermes, Sandbox historis dan laporan pengguna pada acceptance.
10. **13:00–15:00, penutup/tanya jawab.** Jelaskan kontribusi implementasi, keterbatasan dan penggunaan lokal. Tidak perlu hosting atau Production payment untuk menjelaskan arsitektur. Pengajuan refund tidak sama dengan dana kembali.

Jika HP tidak tersedia, ganti bagian native dengan hasil SDK/adapter dan screenshot pengguna yang benar-benar ada. Saat ini repository belum memiliki screenshot native terverifikasi. Jangan membuat gambar pengganti. [Acceptance](DEMO-ACCEPTANCE.md) menjadi acuan klaim.
