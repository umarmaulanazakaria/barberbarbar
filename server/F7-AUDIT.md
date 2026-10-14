# Audit F7 — Midtrans & Refund (PARSIAL)

14 Oktober 2026 · branch feature/project5-integration · baseline
44c4be8bfcf0e9600c7d47d2d763fd8820e34655. Master PRD v2.0 lengkap tidak ditemukan;
implementasi memakai prompt F7 pengguna, F5/F6-AUDIT dan source aktual.

**F7 belum selesai penuh.** 12 kelompok mock/integrasi lokal PASS. Percobaan Snap
Sandbox nyata FAIL: HTTP500 dari SDK/provider, direspons endpoint503; tidak
mengakui pembayaran berhasil. Sudah dicoba di dalam dan di luar sandbox eksekusi.
Tidak ada Snap URL berhasil diperoleh untuk pembayaran manual. Settlement,
webhook pembayaran nyata dan refund provider end-to-end DEFERRED karena ini.
Tidak menyimpulkan key salah dari HTTP500 atau mengungkap nilai credential.

## Environment, dependency dan exposure

Empat variabel MIDTRANS terisi; MIDTRANS_IS_PRODUCTION tepat false. Verifikasi
hanya menghasilkan boolean/nama, tidak menampilkan nilai key. PORT3000 berasal
dari konfigurasi dengan default source3000. Runtime menolak mode selain false,
memakai SDK resmi Snap (bukan BI SNAP), endpoint Sandbox dan timeout15detik.
@types1.4.0 belum mendeklarasikan CoreApi.transaction; interface lokal typed
menjembatani API SDK1.4.3 yang benar-benar diperiksa. Tidak memakai any baru.

Package persiapan midtrans-client1.4.3/@types1.4.0 dimasukkan pada commit F7.
Tidak ada dependency baru selain kedua package yang telah disetujui pengguna.

Audit awal16 temuan:5 moderate,9 high,2 critical (package terdampak, bukan16 CVE
unik). Express5.2.1→proxy-addr2.0.7 menyebabkan critical yang sama dihitung pada
dua package. Patch kompatibel2.0.8 diterapkan via npm update proxy-addr tanpa
upgrade major/force. Source tidak mengaktifkan trust proxy, sehingga jalur subnet
berisiko juga tidak dipakai. Advisory resmi:
https://github.com/advisories/GHSA-jqcg-44mw-7w3h .

Audit akhir14 package:5 moderate,9 high,**0 critical**. --omit=dev masih9 package
(5 moderate,4 high) akibat peerOptional prisma dari @prisma/client. Ini bukan klaim
semua dependency bebas kerentanan. Rantai yang diperiksa dengan npm explain:

| Rantai | Ruang lingkup aktual / tindak lanjut |
|---|---|
| Prisma→@prisma/config→deepmerge-ts7.1.5 | CLI/config tepercaya; fix upstream8.0.0 mayor tidak dipaksakan |
| Prisma→@prisma/dev→streams-local→ajv→fast-uri3.1.7 | Tooling dev; patch3.1.8 tersedia dalam range; belum diterapkan |
| Prisma→mysql2 pinned3.15.3 | Konektor tooling; aplikasi memakai PostgreSQL/PrismaPg, tidak koneksi MySQL |
| ESLint→minimatch→brace-expansion5.0.9 | Tooling lint, bukan payload HTTP; patch5.0.12 tersedia, belum diterapkan |
| SDK→axios/lodash dan dependency baru | Tidak tercantum dalam temuan audit akhir |

Tidak ada endpoint yang menjalankan CLI Prisma/ESLint, membaca konfigurasi dari
payload user atau membuat koneksi MySQL. Risiko sisa belum dihapus; upgrade mayor/
override pinned membutuhkan review dan persetujuan terpisah. Tidak menjalankan
npm audit fix --force atau mengubah versi Prisma untuk menyembunyikan temuan.

Ngrok3.35.0 awalnya tidak mempunyai config default. Pengguna menyatakan siap;
ngrok config check lalu valid, sesi autentikasi/tunnel berhasil. Inspector disabled.
URL pada saat audit: https://trifle-unviable-levitator.ngrok-free.dev . POST kosong
ke /midtrans/notifications melalui tunnel menghasilkan400, sama dengan localhost.
Ini PASS transport/rejection, bukan bukti webhook pembayaran provider sah.
URL sementara; panduan dashboard ada di F7-SANDBOX.md.
Backend/tunnel khusus smoke test dihentikan setelah pemeriksaan; ulangi ngrok
dan perbarui URL dashboard pada pengujian berikutnya.

## Database, backup dan data existing

Backup sebelum migration utama:
backup-database/f7-2026-10-14T11-19-43-013Z/database.dump,99767byte, SHA256
ddf71427685ac7af5c56f62b323a878aba5dbdbfe36ad44752452af8e5085766.

Backup ulang sebelum perubahan predicate index:
backup-database/f7-2026-10-14T11-41-19-040Z/database.dump,112872byte, SHA256
033c6827d8c89e063064a2e4e031620a485b3aa5abdca68c1da47d7019e0646c.
Keduanya di luar Git/ZIP, pg_dump custom, pg_restore --list dan pembacaan penuh
tanpa restore lulus. SHA256 serta snapshot row kembali diverifikasi sesudah suite.

Migration16 total, up-to-date:

- 20261014112500_tambah_midtrans_refund_f7: kolom nullable metadata provider,
  attestation GetStatus, round DP dibawa; enum NO_SHOW/status refund; tabel
  PercobaanSnapBooking/PermohonanRefundBooking, FK/unique/CHECK, trigger kredit
  SUCCEEDED immutable. Dibuat SQL-only via migrate diff karena migrate dev
  --create-only menolak sesi non-interaktif. SQL ditinjau sebelum deploy.
- 20261014114000_rekonsiliasi_kredit_dp_terlambat_f7: mengganti predicate index
  satu active DP menjadi satu PENDING per round dan satu PENDING pelunasan online.
  DROP INDEX hanya mengganti index, tidak menghapus row/history. Beberapa kredit
  provider nyata yang datang setelah expire harus tetap direkam untuk refund;
  tidak boleh ditolak constraint hanya karena intent lain sedang pending.

Tidak ada reset/drop tabel/schema, migration data, backfill atau edit pelanggan
existing. Snapshot22 model identik sesudah seluruh fixture dibersihkan; tabel
Booking/ledger/evidence/Snap/refund/invoice kosong. Sequence fixture bergerak
normal. Semua17 Pembayaran existing dan akun/password tetap identik.

File dilindungi tetap SHA256:

- server/src/lib/prisma.ts: d524d6701a23a32c66c42711102af799cad1d2425b13f47d85d81d987bc1672a
- Project4 src/layar/LayarTambahPelanggan.tsx: 522ad8a3a03bd429b240519f2898bd4a45b88434eb941ab7904b3ae341cda941

.env ignored/untracked; tidak masuk stage/commit/ZIP. SDK error disanitasi menjadi
kode HTTP/diagnosis umum; tidak meneruskan objek auth/response mentah ke log.
Snap token hanya disimpan private attempt dan dikirim kepada owner pada response
no-store; tidak masuk DTO booking/refund atau file paket. Suite mock memakai key
acak sendiri, tidak credential merchant nyata. Suite Sandbox hanya dummy acak.

## Implementasi dan kontrak

CUSTOMER JWT / own booking:

- POST /customer/bookings/:id/payments/dp — {kunciIdempotensi}, nominal snapshot,
  CONFIRMED/before deadline, satu attempt reserved, token/redirect owner-only.
- POST /customer/bookings/:id/payments/online-settlement — {kunciIdempotensi},
  hanya COMPLETED+DP sah, amount balance; online pending menahan kasir.
- POST /customer/payments/:id/sync — {}, GetStatus resmi own-scope.
- GET /customer/refunds — daftar sendiri, tanpa response provider mentah/token.
- POST /customer/bookings/:id/cancel — {}, sebelum service; >=1jam refund DP100%
  pending ADMIN; <1jam hangus. Pending DP dibayar setelah cancel direkonsiliasi.
- POST /customer/bookings/:id/reschedule — flow consent existing, opsional items
  tervalidasi untuk perubahan layanan eksplisit, price backend/snapshot diskon
  tetap. Pending payment/refund menahan perubahan. Paid DP dibawa dari round asal,
  confirm ulang diperlukan, selisih overpaid membuat request. Kenaikan yang DP
  existing tidak cukup ditolak; tidak diam-diam membuat DP pengganti.

POST /midtrans/notifications tidak memakai JWT karena provider; signature SHA512
constant-time lalu GetStatus resmi. Merchant/order/transaction/amount/IDR/purpose
dan relasi diperiksa. Callback frontend tidak mempunyai endpoint paid writer.
Pending/challenge tidak kredit; capture credit_card hanya fraud accept; settlement
kredit satu kali; expire/deny/cancel/failure tidak paid. Kredit SUCCEEDED tidak
mundur, pending lama tidak menghidupkan terminal failed/expired. Genuine late
payment tetap dicatat; DP lewat deadline tidak memberi hak service dan membuat
refund request. DP double setelah rekonsiliasi membuat refund request kelebihan DP.

ADMIN-only /refund-requests: GET /; POST /:id/approve, /:id/reject (catatan wajib);
POST /:id/retry ({}). STAFF403, CUSTOMER401. Service juga mengecek role ADMIN DB,
tidak hanya claim JWT. Satu keputusan, reservasi per source dan refund_key tetap
F7-REFUND-{id}. Response provider disimpan sebagai kode/fingerprint aman, bukan
payload PII mentah. Debit hanya saat GetStatus menampilkan refund online sesuai
key/amount dan bank_confirmed_at. HTTP200 refund request saja belum SUCCEEDED.

Metode supported mengacu dokumentasi:
https://docs.midtrans.com/reference/refund-transaction . Refund perlu Settlement;
capture belum refundable lewat Refund API. Window/provider activation dapat
membatasi. ShopeePay/OVO partial tidak didukung. Bank transfer dan sumber kasir
UNSUPPORTED, tidak memanggil Midtrans atau mengaku sukses. Kebijakan pembayaran
kembali manual beserta bukti/approval belum tersedia; keputusan pengguna diperlukan
untuk menambah prosedur manual di fase berikutnya. Retry memakai key sama; setelah
batas retry7hari tidak otomatis mengganti key dan berisiko refund ganda.

## F5 dan kasir existing

DP sah harus mempunyai evidence MIDTRANS_STATUS_V1, nominal/reference cocok,
waktu sesuai deadline/round (atau carried round) dan net DP setelah refund cukup.
Fixture evidence F6 tanpa attestation tidak membuka pelayanan F5.

Code check-in awal, barber final, start IN_SERVICE, nested Pesanan/items/audit,
perubahan layanan IN_SERVICE dan completion terkait sudah terintegrasi. ADMIN/
STAFF yang bertindak; consent pilihan barber/slot/barber aktif/customer AKTIF
tetap diperiksa. DP tidak otomatis start; start concurrent hanya satu Pesanan.
COMPLETED menulis deadline pelunasan1jam dan status Pesanan, belum PAID otomatis.
Service turun mempertahankan paid dan membuat request refund; snapshot reservasi
tetap, hanya item Pesanan diubah. Pending refund menahan edit ulang.

Manual NO_SHOW operator hanya CONFIRMED dan waktu sudah mulai, tanpa Pesanan;
DP hangus tanpa refund/sisa pelunasan. Terminal cancel/reject/no-show menghentikan
kewajiban pelunasan dan tidak membuat invoice palsu. Scheduler otomatis tetap F8.
Kasir walk-in/API Project4 tidak berubah. Legacy status/item mutation linked
Booking ditolak agar tidak bypass lifecycle/pembayaran. Invoice bridge F6 tetap
satu Pembayaran legacy sebagai artefak, tidak dikredit dua kali.

**F5 code terhubung dan PASS mock; F5 belum diklaim end-to-end provider nyata.**

## Hasil pengujian

| Kelompok | Hasil aktual |
|---|---|
| Snap DP member/non-member, ownership, key, concurrent/reservation | PASS MOCK |
| Signature palsu, nominal/transaction mismatch, pending/challenge | PASS MOCK |
| Webhook settlement duplicate/concurrent/out-of-order | PASS MOCK |
| Early check-in/start/barber/Pesanan sekali, service naik, online settlement | PASS MOCK |
| Cash ditahan saat online pending; final invoice tunggal | PASS MOCK |
| Cancel>=1jam ADMIN approval/race/refund failed/retry/bank-confirmed | PASS MOCK |
| Cancel<1jam/NO_SHOW, tanpa refund/sisa pelunasan | PASS MOCK |
| Paid reject automatic request dan keputusan reject final | PASS MOCK |
| Service turun paid utuh, excess request, edit aktif ditahan | PASS MOCK |
| Bank transfer/sumber manual UNSUPPORTED tanpa provider call | PASS MOCK |
| Paid reschedule/items/confirm ulang/carried DP/refund selisih | PASS MOCK |
| Expire terminal, late genuine/double DP, satu refund request | PASS MOCK |
| Webhook allocation failure rollback ledger/evidence; retry | PASS MOCK |
| Snap UNCERTAIN, deadline, Production fail-closed, sync IDOR | PASS MOCK |
| Suite test-midtrans-f7.mjs | PASS:12 kelompok dan cleanup |
| Snap create provider Sandbox | FAIL:HTTP500, endpoint503; tidak paid |
| Settlement/pelunasan online/webhook/refund provider nyata | DEFERRED karena Snap create gagal |
| Ngrok auth/transport + empty webhook reject | PASS transport (HTTP400), bukan payment proof |
| F2 fondasi / reset / public | PASS:24/11/4 checks utama |
| F3/F4/F5/F6 | PASS:12/15/11/8 kelompok |
| TypeScript strict noEmit/noUnused, backend build | PASS |
| Prisma validate/status dan Git diff check | PASS |
| Snapshot22 model / SHA backup / file dilindungi | PASS |
| UI/device Project4/5 | DEFERRED; kontrak HTTP Project4 saja diuji |

Test F5 diperbarui hanya untuk malformed empty items menghasilkan400, bukan
409 gate lama. Pesan historis F5/F6 suite tentang fase tidak dijadikan klaim
status F7. Warning pg concurrent existing masih muncul, exit suite0.

## Batas dan tindak lanjut

- F7 PARSIAL: penyebab HTTP500 Sandbox harus diselesaikan, lalu uji provider nyata
  DP→webhook→service→pelunasan serta refund supported/bank-confirmed dan retry.
  Belum mengklaim transport GetStatus/shape response aktual lulus Sandbox.
- Snap network outcome tak pasti dipertahankan UNCERTAIN/reserved, tanpa create
  ulang. Reconcile via status; jika provider belum mengenali order/token hilang,
  penanganan operator/expiry masih diperlukan. Tidak menebak failed lalu membuat
  charge baru. Tidak menyediakan bypass/manual paid untuk mengatasi ini.
- Refund gagal/provider unconfirmed tetap FAILED/PROCESSING, key tetap; manual
  refund cash/non-supported membutuhkan policy/bukti terpisah, bukan sukses palsu.
- F8: scheduler timeout/NO_SHOW/OVERDUE, notifikasi/reconcile berkala; GET overdue
  dan NO_SHOW operator sudah ada, tidak block customer.
- Tidak ada perubahan UI/socket/Production. Tidak ada instalasi/upgrade mayor baru.

Bagian aman diuji lalu commit/push sesuai instruksi saat faktor eksternal
menghambat. Hash commit/push/HEAD-upstream dilaporkan pada hasil akhir. ZIP berisi
whitelist file lengkap termasuk README/F7-SANDBOX, tanpa secret/token aktual/dump/
file dilindungi. Checksum setiap entry diverifikasi terhadap source.
