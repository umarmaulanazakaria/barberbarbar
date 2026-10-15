> Dokumen historis dipindahkan dari `barberbarbar/PANDUAN-DEMO.md`. Hasil dan path bukti mencatat waktu audit; panduan aktif ada di README utama dan laporan cleanup. Arsip privat kini berada di luar Stage 2.

# Panduan demonstrasi

Tujuan demo: menunjukkan Web Management dan integrasi backend dengan Staff/
Customer secara jujur. Siapkan hanya fixture dummy dan credential lokal penguji.
Lihat README-FINAL untuk startup dan README-PENGUJIAN-ANDROID untuk device.
Jangan menampilkan env, terminal credential, token, data asli atau URL Snap.

| Urutan | Yang ditunjukkan | Bukti / batas |
|---|---|---|
| 1 | Diagram peran tiga app, satu API/PostgreSQL, role ADMIN/STAFF/CUSTOMER | README-FINAL, tanpa credential |
| 2 | Katalog publik, Customer register/login dan pengaitan ADMIN | Jika tanpa HP, nyatakan bukti API/adapter dan tampilkan laporan, jangan mengaku tap native |
| 3 | Customer booking multiservice/qty/barber null; Web/Staff menerima sinyal | Fixture sendiri; harga/DP dari backend |
| 4 | Web confirm/reject wajib alasan; status Customer diperbarui | Browser nyata, atau lihat harness test yang memakai provider MOCK |
| 5 | Membership request dan ADMIN approve; STAFF tidak boleh memutuskan | Snapshot diskon booking tetap |
| 6 | DP sah, check-in awal, assignment barber final, IN_SERVICE | Untuk native gunakan Sandbox sah; MOCK hanya pada harness dan wajib disebut |
| 7 | Edit layanan/qty, COMPLETED, pelunasan, PAID/balance0/invoice final | Bukti DB/ledger sekali, bukan callback frontend |
| 8 | Timeline/refund PROCESSING belum berarti uang kembali | Refund lama Rp2.000 belum memiliki bukti final; jangan retry saat demo |
| 9 | Disconnect/reconnect/refetch, logout, isolasi dua customer | Native UI tetap memerlukan HP |
| 10 | Hasil regresi, matriks, blocker release dan PR review | Tidak menyebut Production-ready atau merge main |

Harness otomatis untuk demonstrasi browser terukur, dari client:

```powershell
$env:BB_AUDIT_OUTPUT_DIR='finalization/demo-lokal'
node scripts/test-e2e-browser.mjs
```

Tutup backend/Vite manual pada3000/5173 terlebih dahulu. Harness membuat dan
membersihkan fixture sendiri, tidak menahan halaman sebagai app demo, serta
memakai provider MOCK. Jangan menjalankannya paralel dengan tes DB atau demo
manual. Simpan hasil audit resmi terpisah dari hasil demo baru.

Jika HP belum ada, tampilkan Web dan laporan hasil API/SDK sebagai bukti
terbatas. Untuk scheduler tunjukkan tes runtime dan riwayat fixture; jangan
mengubah jam komputer/database atau memajukan deadline data pelanggan asli.
Recovery email belum tersedia: jelaskan fondasi token aman dan blocker delivery.
