# Remediasi keamanan dependensi — 18 Oktober 2026

Remediasi kompatibel telah diterapkan pada feature branch existing. Hasil ini melanjutkan [audit sistem](AUDIT-SISTEM-TERKINI.md), tanpa menghapus snapshot historis. **Remediasi parsial; belum memenuhi gerbang nol advisory atau penerimaan Production.** Desain dan workflow final tidak diubah.

## Hasil aktual

| Target | Sebelum M/H | Sesudah M/H | Total sebelum → sesudah |
| --- | --- | --- | --- |
| Backend |1/4|0/0|5 → 0|
| Admin Web |2/0|2/0|2 → 2|
| Staff Mobile |7/37|0/37|44 → 37|
| Customer Web |0/0|0/0|0 → 0|
| Total |10/41|2/37|51 → 39|

Critical nol sebelum/sesudah. Angka tersebut adalah package reports npm, bukan 51kerentanan independen. Deduplikasi via.source menunjukkan 8 akar advisory unik sebelum dan 4 sesudah. Audit lengkap dan --omit=dev menghasilkan jumlah sama pada setiap target. Prisma optional peer dan toolchain Expo tetap berada pada graph production npm; karena itu klasifikasi risiko ditentukan juga dari source, jalur pemakaian dan artifact, bukan semata atribut devDependency. [Bukti terstruktur](REMEDIASI-KEAMANAN.json) memuat kedua audit, jalur nodes/via, perubahan lockfile dan verifikasi. Tidak ada advisory baru pada hasil sesudah.

## Perubahan Backend

Prisma, @prisma/client dan @prisma/adapter-pg diperbarui bersama 7.10.0 → 7.10.1. Patch resmi parent membawa @prisma/config 7.10.1, deepmerge-ts 7.1.5 → 8.0.2 dan mysql2 3.15.3 →3.24.4. Tidak memakai override pada backend atau meng-upgrade major Prisma. Major transitive deepmerge diperbarui oleh deklarasi resmi parent, bukan dipaksakan terpisah. Paket sqlstring/seq-queue/denque lama diganti upstream mysql2; tidak menghapus dependency aplikasi demi menurunkan audit. Seluruh perubahan lockfile dicatat pada bukti JSON.

Tiga akar tertutup: [recursive merge deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [downgrade auth plugin mysql2](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), dan [decompression bomb mysql2](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3). Lima package reports hilang, termasuk 4 High. PostgreSQL aplikasi memakai PrismaPg/pg; mysql2 berada pada CLI/Studio dependency, bukan adapter database aplikasi. deepmerge dipanggil loader konfigurasi Prisma. Risiko toolchain tetap relevan meski sebelumnya tidak ditemukan jalur input customer menuju kedua library.

Prisma Client dihasilkan ulang memakai 7.10.1. validate/build/integrasi lulus. Tidak mengubah schema/migration, tidak menjalankan migrate deploy, reset atau seed. migrate status read-only tetap 26 migration sinkron. src/lib/prisma.ts staged historis tidak disentuh atau masuk commit.

## Perubahan Staff dan bukti override

Expo 57.0.29 → 57.0.30, tetap SDK 57 dan React Native 0.86.3/React 19.2.3. Patch memakai CLI 57.0.31 dan Babel preset 57.0.16, beserta dependency transitif dalam range parent. Native dependency/date picker/navigation/SecureStore tidak diganti. Paket root lain tidak di-upgrade.

Jalur Moderate: expo → @expo/config-plugins → xcode 3.0.1 → uuid 7.0.3. xcode stable 3.0.1 masih meminta ^7.0.3; tidak ada patch parent stable yang menghilangkan advisory. Override hanya xcode.uuid=11.1.1. Tidak menambahkan uuid sebagai dependency langsung atau override global.

Kompatibilitas diperiksa sebelum dan sesudah pemasangan: source xcode hanya menggunakan CommonJS uuid.v4(), tanpa API lama lain; versi11 menyediakan kontrak tersebut. Tes tersimpan scripts/test-kompatibilitas-keamanan.cjs membuktikan versi resolusi dari konsumen xcode, bounds check v3/v5/v6 pada buffer pendek, 10.000 ID 24 hex unik, addPbxGroup serta write/parse roundtrip fixture PBX. Expo config/autolinking/export juga lulus. Ini pembuktian kontrak yang dipakai, bukan klaim seluruh Xcode/iOS build telah diuji. Override perlu diperiksa ulang jika parent berubah.

[Advisory uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq) berhubungan dengan v3/v5/v6 ber-buffer, sedangkan xcode saat ini memakai v4. Dengan demikian tidak ditemukan jalur eksploitasi flaw tersebut melalui panggilan xcode saat ini, tetapi dependency terdampak tetap diganti dengan versi resmi berpagar buffer. Satu akar Moderate tertutup dan 7 package reports propagasi hilang. **Tidak ada High Staff yang diklaim tertutup.**

## Sisa Staff: dua akar High, 37 package reports

| Akar/jalur | Keterjangkauan aktual dan mitigasi | Alasan belum dipatch |
| --- | --- | --- |
| braces 3.0.3 ← micromatch 4.0.8 ← metro-file-map/Metro ← Expo/RN | Rekursi pola glob pada toolchain watcher/build. Pola proyek diaudit, bukan input pelanggan/API. Gunakan konfigurasi/repository/plugin yang tepercaya; jangan memproses glob tak tepercaya atau mengekspos Metro ke Internet. Tidak membuat klaim bebas DoS. | [Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) menyatakan patched version belum ada; registry stable terakhir 3.0.3. |
| node-forge 1.4.0 ← @expo/code-signing-certificates dan ExpoCLI iOS code signing | Library benar dipakai untuk verifikasi certificate/signature pada perkakas; bukan sekadar false positive. Risiko signature forgery terutama saat memverifikasi material RSA terdampak/tidak tepercaya. Jangan menganggap verifikasi ini bukti aman bagi material eksternal; batasi key/certificate/plugin pada sumber tepercaya dan tinjau signing/update sebelum deployment. App saat ini tidak mendeklarasikan expo-updates/custom code signing. | [Advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) menyatakan belum ada patched version; registry stable terakhir 1.4.0. |

37 laporan High adalah propagasi dua akar tersebut melalui Expo, Metro, React Native, navigation, safe-area, screens, SecureStore dan paket lain; bukan 37 cacat independen pada komponen UI. Tidak menghapus dependency penting, memakai downgrade tak aman, prerelease, patch kriptografi buatan sendiri, atau override pengganti yang tidak kompatibel.

Source map export Android produksi berisi 975 source: tidak terdapat node-forge/braces/micromatch/xcode/uuid. Ini bukti bahwa modul tersebut tidak masuk artifact Android yang diuji, bukan bukti bahwa toolchain aman, iOS teruji atau semua deployment bebas risiko. Tindak lanjut: pantau rilis resmi kedua paket/parent, patch saat tersedia, ulangi config/autolinking/export dan pemeriksaan perangkat. Upgrade SDK major tidak otomatis menjamin perbaikan kedua akar ini.

## Admin: MEMERLUKAN KEPUTUSAN

react-router-dom/react-router6.30.6 adalah stable terakhir major 6 yang tersedia saat pemeriksaan; dua package reports tetap dari dua akar Moderate. [Open redirect backslash](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) dan [SSR hydration constructor injection](https://github.com/advisories/GHSA-337j-9hxr-rhxg) memerlukan versi >=7.18.0. Kandidat stable registry 7.18.4; tidak dipasang karena perpindahan major routing harus menjadi keputusan terpisah dengan rencana regresi.

Source memakai BrowserRouter+createRoot SPA, bukan StaticRouter/SSR/hydrateRoot/deserializeErrors. Link/navigate yang ditemukan memakai jalur internal tetap atau prefix internal+ID; login menuju path internal, bukan returnURL bebas kiriman pengguna. Tidak ditemukan input customer diteruskan sebagai target URL navigasi bebas atau data hydration SSR. Ini mengurangi keterjangkauan saat ini, bukan menghapus advisory runtime. Pertahankan pembatasan target internal, jangan menambahkan SSR/target URL tak tepercaya sebelum patch. Seluruh11rute Admin diuji smoke dengan API read-only; bukan pembuktian semua payload eksploitasi.

Tidak memaksa router 7 ke dalam react-router-dom 6 atau mempatch internals paket manual. Rencana terpisah: persetujuan major 7.18.4, review panduan migrasi/future flags, tes auth/redirect/nested route/Back/refresh serta fitur Admin dan API sebelum publish. Expo SDK/Prisma major tidak diperlukan untuk patch yang sudah diterapkan.

## Verifikasi sesudah

| Pemeriksaan | Hasil dan batas |
| --- | --- |
| Backend TS/build | PASS pada working tree dan snapshot HEAD dengan patch dependency |
| Prisma generate/validate/status | PASS; Client 7.10.1, 26 migration sinkron; tanpa perubahan DB |
| Integrasi 14 suite | PASS; PostgreSQL fixture existing terisolasi, provider mock/stub; cleanup seluruh suite lulus |
| GET operator/publik | PASS 28 probe; koneksi database utama dipaksa read-only |
| Admin TS/build | PASS working tree dan snapshot |
| Admin routing/REST | PASS 11 halaman termasuk Detail; Chrome existing, API read-only, mutasi diblokir, 0 error browser/API |
| Staff TS | PASS working tree dan snapshot |
| Expo install --check | PASS Dependencies are up to date |
| Autolinking verify/resolve Android | PASS; 11 modul Expo resolved, tanpa konflik verifikasi |
| Android/Hermes/source map | PASS 997 modul; tidak ada lima paket terkait pada975 source |
| Metro | PASS startup offline, /status 200 dan dev bundle 200(1.158 modul); proses uji dihentikan |
| API lokal | PASS public/services 200; bukan pembuktian LAN/HP |
| Customer audit | Tetap 0 all/omit-dev; package/lock tidak berubah sehingga build tidak diulang |
| Device/iOS/printer/provider nyata | BELUM TERVERIFIKASI pada remediasi; tidak mengklaim PASS dari export/mock |

Regresi mencakup login/role/reset, publik, Dashboard/Riwayat, Booking Reguler/Member, verifikasi fisik, Walk-in anonim/Member, pembayaran Tunai/Transfer/QRIS stub, webhook/replay/ledger/invoice dan Socket.IO. Tidak membuat transaksi Midtrans nyata atau fixture pada data operasional. Peringatan existing pg concurrent-query/deprecation dan ukuran bundle Admin tetap tercatat, bukan diatasi dengan perubahan tidak relevan.

## Git dan batas rilis

Branch Backend/Staff tetap feature/project5-integration; Customer tetap feat/project5-react-web-mobile-first. WIP 13 file Backend+folder screenshot, 4 file Staff dan 18 file Customer serta diff staged Prisma diverifikasi hash/index sebelum commit. Pengujian snapshot tidak memasukkan WIP. Commit/push hanya allowlist remediasi, tanpa force/merge/main/default-branch/history change. Hasil SHA remote dilaporkan setelah push.

**Kesimpulan:** patch yang aman telah diterapkan dan lulus verifikasi teknis. Nol advisory hanya pada Backend/Customer; Staff dan Admin belum bebas advisory. Penerimaan penuh/Production tetap belum dinyatakan siap. Keputusan tersisa terutama upgrade React Router major; dua akar Staff menunggu patch resmi yang kompatibel.
