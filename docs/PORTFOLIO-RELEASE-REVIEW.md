# Review portofolio dan branch

15 Oktober 2026. Target akademik dan demonstrasi lokal, **DEMO READY WITH LIMITATIONS**, bukan Production. Tidak merge main, force push, menulis ulang history, mengubah default branch atau membuat ZIP baru. [Acceptance](DEMO-ACCEPTANCE.md) menjadi acuan hasil pengujian, bukan laporan historis saja.

## Audit awal Git aktual

Setelah fetch dan pemeriksaan `ls-remote --symref`:

| Repo | Feature HEAD awal | Remote main/default | Main-only / feature-only |
|---|---|---|---|
| Web/backend | b2438eb | main ed37007; default main | 1 / 4 |
| Staff | 283aeda | main 5e0db67; default main | 0 / 7 |
| Customer | f8f79d4 | main belum ada; default feature/project5-integration | tidak ada base main |

Project 3 `ed37007` adalah merge PR #1 yang sudah dilakukan sebelumnya oleh pemilik, bukan oleh pekerjaan ini. Main lokal Project 3 masih 4fa33c1; audit memakai **origin/main terbaru**, tidak main lokal yang tertinggal. Feature tidak di-rebase. Simulasi `git merge-tree --write-tree HEAD origin/main` untuk Project 3 dan Staff exit0 tanpa konflik. Ini bukan merge/checkout dan harus diperiksa ulang jika main berubah.

Selisih Project 3 saat audit awal 77 file berfokus pada perbaikan bahasa/UX, payment status dan proxy/launcher, recovery/profil, tes serta laporan. Staff 41 file mencakup booking/realtime, payment/status, nullable barber contract, tes dan dokumentasi. Hitungan akhir bertambah dengan dokumen/screenshot/pengamanan seed tugas ini. Daftar lengkap: `git diff --name-status origin/main...HEAD`. Daftar signifikan dan teks PR tersedia di [PR Web/backend](PULL-REQUEST.md) dan repository Staff `docs/PULL-REQUEST.md`.

## Rencana main Customer — belum dieksekusi

Pendekatan aman yang disarankan setelah persetujuan pemilik: jadikan commit feature yang sudah direview sebagai baseline main, **tanpa commit palsu, orphan, reset atau salin ulang source**. Ini mempertahankan seluruh ancestry; PR pertama ke main akan kosong karena tip sama. Perubahan selanjutnya baru menghasilkan selisih PR. Jangan mencari selisih dengan memalsukan sejarah.

Prosedur konkret, **hanya setelah persetujuan terpisah**:

1. Pastikan feature sudah dipush, status bersih, fetch, periksa `git ls-remote --heads origin main` masih kosong.
2. Catat SHA feature yang disetujui, tinjau hasil tes dan backup. Publikasikan SHA tersebut dengan `git push origin <SHA-YANG-DISETUJUI>:refs/heads/main` (tanpa force). Jika main sudah muncul atau push ditolak, berhenti dan audit ulang.
3. Di GitHub Settings repository, pemilik mengganti default branch menjadi main dan mengatur aturan review sesuai kebutuhan.
4. Fetch, verifikasi SHA main dan ancestry. Pertahankan feature dan history existing. PR berikutnya hanya berisi perubahan baru.

Alternatif memilih ancestor lama sebagai base perlu keputusan eksplisit karena menentukan apa yang direview sebagai PR awal. Tidak dilakukan otomatis. Ketiga repository GitHub terkonfirmasi dapat diakses melalui Git remote; tidak membuat PR/merge atau mengubah pengaturan remote dalam tugas ini.

## Keamanan demo

- `.env` asli, dump/snapshot, log, node_modules/dist dan credential tidak ikut publikasi. Scanner rilis membandingkan file perubahan terhadap credential proses dan data pribadi pada snapshot; batasnya exact match dan pola token, bukan audit forensik seluruh history. Screenshot ditinjau visual terpisah karena scanner teks tidak membaca piksel.
- Seed lama memuat password contoh dan mencetak login. Source kini meminta password privat 12–72 byte, izin eksplisit dan database loopback `bb_demo_*`; tidak memperbarui akun operator existing atau mencetak credential. Tes membuktikan penolakan, hash login, idempotensi dan cleanup. Tidak menjalankan seed pada data aplikasi. History lama tidak diubah; **jangan memakai credential contoh historis**. Jika pernah dipakai untuk akun nyata, pemilik perlu menggantinya melalui alur akun sah; tugas ini tidak mengubah password existing.
- Scan awal perubahan juga mencocokkan identitas seed lama dengan snapshot aplikasi. Identitas seed/dokumentasi kemudian diganti dengan dummy khusus; tes seed dan scan diulang. Hasil akhir 25 file: nol kecocokan secret/data existing, nol environment asli tracked. Ini tidak menghapus catatan historis atau menjadikan scan teks sebagai pemeriksaan isi gambar; kelima gambar ditinjau visual.
- JWT operator/CUSTOMER, pembatasan pemilik/role, limiter, room Socket.IO, nominal server, signature/status provider dan idempotensi tetap diuji. Tidak membuka seluruh backend lewat ngrok.
- Ngrok existing terverifikasi HTTPS menuju loopback3001. Hanya route webhook POST JSON diteruskan. Jangan meneruskan Metro, Vite, database atau agent4040 ke Internet. Tutup tunnel saat tidak diperlukan setelah memastikan tidak mengganggu pembayaran yang sedang diproses.

## Dependency terbaru — tanpa perubahan paket

Audit read-only penuh dan `--omit=dev` memberikan jumlah yang sama:

| Workspace | Critical | High | Moderate |
|---|---:|---:|---:|
| Backend | 0 | 4 | 0 |
| Web | 0 | 0 | 2 |
| Staff | 0 | 15 | 7 |
| Customer | 0 | 16 | 7 |

Ini 51 entri paket/propagasi, bukan 51 exploit unik; delapan advisory pada run ini. React Router adalah dependency runtime Web: jalur redirect/SSR perlu diperhatikan, source memakai CSR dan path internal. Prisma deepmerge-ts/mysql2 adalah CLI/config terpasang meski audit omit-dev tetap menandainya; aplikasi memakai PostgreSQL, tidak mengaktifkan MySQL tak tepercaya. Expo node-forge/braces/uuid berada di tooling sertifikat/Metro/native generator, bukan alasan menghapus temuan. Gunakan input/build tepercaya dan LAN privat, bukan jaringan publik. Detail versi/jalur/perbaikan ada pada [audit sebelumnya](FINAL-ACCEPTANCE-CLOSURE.md#security-advisory-aktual); hasil terbaru disimpan pada [bukti demo](demo/VERIFIKASI.json).

Sebagian membutuhkan perubahan major di luar range parent dan sebagian belum memiliki patch aman yang terdokumentasi pada audit. Tidak menjalankan `audit fix --force`, downgrade Prisma/Expo, install atau override tanpa izin. Tidak ditemukan bukti jalur exploit langsung tambahan pada alur demo yang diuji; ini bukan jaminan bebas kerentanan. Risiko membatasi penggunaan ke demo lokal terkontrol, bukan rekomendasi Production.

## Perubahan dan publikasi

README tiga repo diperbarui untuk identitas portofolio, panduan/naskah/acceptance/review dikonsolidasikan, lima screenshot Web aktual ditambahkan, capture opt-in memakai harness existing, serta seed existing diamankan dan diuji. Tidak merombak fitur atau UI yang disetujui. P4/P5 hanya dokumentasi pada tugas ini.

Commit menggunakan judul Bahasa Indonesia tanpa nomor fase/prefix, explicit paths. Prisma staged historis dan format lokal Staff tetap di luar commit. Identitas commit/push akhir tersedia melalui `git log -1` pada feature masing-masing dan laporan akhir tugas; jangan menyematkan hash commit dokumen ke dalam dirinya sendiri. Verifikasi akhir mensyaratkan upstream 0 ahead/behind, P3 hanya Prisma staged, Staff hanya booking.ts unstaged, Customer bersih. Tidak merge atau membuat main Customer tanpa izin.
