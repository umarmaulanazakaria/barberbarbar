# Integrasi Socket.IO dan Midtrans pada tiga aplikasi aktif

Validasi: 16 Oktober 2026. Source asli, backend/database pusat existing, pembayaran otomatis menggunakan provider MOCK. Tidak ada provider Sandbox nyata baru, migration, database baru, push, merge, PR atau deploy.

## Audit tujuh materi

| Materi | Project 3: backend/Admin | Project 4: Staff | Project 5: Customer Web |
|---|---|---|---|
| 1. Setup backend Socket.IO | Sudah sesuai: satu `createServer(app)` dan `pasangRealtime` | Klien JWT operator existing | Sebelumnya belum kompatibel dengan sesi guest; sekarang tersedia |
| 2. Event setelah commit | Sudah sesuai: trigger transaksi dan PostgreSQL LISTEN/NOTIFY | Subscriber/refetch existing | Subscriber guest ditambahkan; tidak menulis status lokal dari event |
| 3. Klien React Customer | Otorisasi sesi/room guest ditambahkan | Tidak perlu diubah | Sebelumnya belum ada; sekarang Socket.IO, cleanup, reconnect dan fallback |
| 4. Setup Midtrans | Sudah sesuai: credential server, Sandbox, SDK existing | Tidak menjadi pemroses provider | Memakai kontrak backend existing; tidak membawa Server Key |
| 5. Membuat Snap | Sudah sesuai: harga, DP/deadline/balance dan idempotency dari DB | Memakai API existing | Meminta token; tidak mengirim nominal dari form |
| 6. Membuka Snap | Backend mengirim konfigurasi/token yang diperlukan | Mekanisme Expo existing dipertahankan; `window.snap` tidak relevan | Sudah sesuai: popup dan callback hanya memeriksa REST |
| 7. Webhook dan event payment | Sudah sesuai: signature, GET Status provider, nominal/identitas dan kredit idempotent | Refetch payment existing | `payment.changed` kini langsung meminta data authoritative |

Source kunci: `server/src/server.ts`, `server/src/realtime/{server,autentikasi,autentikasi-tamu}.ts`, migration existing `20261014143000_tambah_sinyal_realtime_transaksional`, `server/src/services/{guest-booking,midtrans-booking,tracking-booking}.service.ts`, `client/src/lib/sinkronisasi-realtime.ts`, Staff `src/komponen/RealtimeOperator.tsx` dan `src/layanan/sinyalRealtime.ts`, Web `src/layanan/{guest,snap,realtime}.ts` serta `src/komponen/BookingTamu.tsx`.

## Implementasi dan otorisasi

Customer menghubungkan socket hanya sesudah REST berhasil membaca booking. Auth JavaScript hanya `{tipe: "TAMU"}`: tidak memuat ID booking, kode tracking atau token sesi. Cookie `bb_guest_session` tetap HttpOnly. Server memerlukan Origin guest yang diizinkan, flag guest aktif, cookie valid, sesi belum expired, masa akses booking valid dan versi sesi sama dengan versi akses saat ini.

Room `booking:<id>` ditentukan dari sesi database. Guest tidak masuk room operator/catalog dan tidak boleh menjalankan `booking.subscribe` atau `room.join`, termasuk ketika ID target diketahui. JWT operator dan CUSTOMER historis tetap memakai jalur verifikasi existing. Origin JWT operator dan `GUEST_WEB_ORIGINS` digabung hanya pada konfigurasi transport; autentikasi guest tetap membatasi Origin guest sendiri. Tidak memakai wildcard CORS; credentials diaktifkan.

Sesi diperiksa ulang sebelum setiap event dan secara periodik setiap satu detik. Sesi revoked/expired diputus; pemulihan ADMIN memakai alur tracking existing, menghasilkan sesi baru yang sah. Tidak ada token autentikasi guest yang dibaca JavaScript atau ditempatkan di URL/query socket/log. Browser yang membuka katalog tanpa sesi tidak membuat koneksi guest.

Event guest: **`booking.changed`, `order.changed`, `payment.changed`, `realtime.ready`**. Untuk booking/payment, ID event existing adalah booking ID; untuk order, relasi Pesanan ke booking diperiksa server. Payload hanya `id`, `aksi`, `versi`, `waktu`, `refetch`; tidak memuat kontak, kode, cookie, nominal atau Snap token. Event lama/berulang hanya menyebabkan refetch; tidak dapat mengkredit pembayaran.

Trigger PostgreSQL existing mengirim NOTIFY hanya setelah COMMIT; rollback tidak menghasilkan event sukses. Tidak menambahkan emit manual yang dapat mendahului transaksi. Pengantaran event bersifat asynchronous, tidak menjamin event tiba sebelum respons HTTP. Jika listener database pulih, `realtime.ready` memicu refetch untuk mengejar perubahan yang terlewat.

## Lifecycle klien dan fallback

Customer menggunakan satu koneksi untuk booking yang sedang dilihat, bukan per re-render. Listener didaftarkan sekali, dilepas saat keluar/akses hilang, dan socket diputus pada cleanup. Event serentak digabung selama 150 ms. Connect/reconnect dan `realtime.ready` mengambil REST terbaru. Tidak pernah menetapkan CONFIRMED/PAID atau membuat invoice dari event/callback popup.

Browser guest memakai WebSocket agar handshake menyertakan Origin melalui proxy same-origin. Uji awal menemukan GET handshake polling browser tidak membawa Origin; pemeriksaan Origin tidak dilonggarkan. Vite menambahkan proxy `/socket.io` dengan `ws:true` ke target yang sama dengan `/api`. Server/proxy deployment harus mengizinkan upgrade WebSocket. Bila WebSocket tidak tersedia, fallback **REST polling 10 detik** tetap berjalan; foreground/online recovery dan sync provider pending yang dibatasi tetap dipertahankan.

Pencabutan akses membersihkan data, kode dan pengesahan invoice. Respons REST lama diabaikan menurut urutan request; versi akses lokal mencegah respons kode/invoice yang terlambat menampilkan ulang data setelah pencabutan terdeteksi. Halaman invoice yang sudah terbuka sebelum PAID meminta pengesahan endpoint final ketika invoice muncul dari pembacaan REST berikutnya.

## Midtrans yang dipertahankan

SDK/config/backend dan endpoint pembayaran tidak digandakan. Guest tetap tanpa akun/barber; backend menghitung DP 50%, batas 15 menit dan balance pelunasan. Callback Snap success/pending/error/close hanya memicu pemeriksaan; penutupan popup bukan status gagal/lunas. Webhook tetap memverifikasi signature, transaksi, merchant, nominal, status provider dan bukti pembayaran. Settlement terlambat, deadline, refund review ADMIN, replay dan invoice idempotent mengikuti aturan existing.

## Hasil pengujian

Semua mutasi memakai database fixture lokal existing `bb_guest_20261016_<8hex>`, berbeda dari database operasional. Runner memeriksa target; suite baru mewajibkan 24 model kosong dan memverifikasi cleanup 24 model. Tidak membuat database baru atau menjalankan migration. Data aplikasi utama tidak dijadikan fixture, dihapus atau dikembalikan ke snapshot lama.

| Skenario | Hasil aktual |
|---|---|
| A: guest create → Admin/Staff | PASS: socket operator menerima setelah commit; browser Admin aktual menampilkan booking guest tanpa reload |
| B: DP → webhook → Customer/Admin | PASS: provider MOCK, callback sukses palsu tetap belum terverifikasi; settlement resmi fixture memicu REST CONFIRMED/tracking dan pembaruan Admin |
| C: Staff check-in/barber/start/complete | PASS: API operator dan service existing; UI Customer mengikuti event; adapter Staff/realtime existing lulus |
| D: pelunasan → PAID → invoice | PASS: saldo nol, dua kredit, satu invoice, Admin menampilkan Pembayaran Berhasil; halaman invoice yang dibuka sebelum PAID berubah otomatis setelah pengesahan backend |
| E: socket putus/fallback/reconnect | PASS: transport fixture ditolak sementara, REST 10 detik tetap mengikuti COMPLETED; dua reconnect kembali refetch dan satu guest aktif |
| F: isolasi/expiry/revocation/recovery | PASS: A tidak menerima booking B, subscribe ID/room ditolak, cookie/Origin/auth invalid ditolak, sesi expired/rotasi ADMIN memutus socket lama, sesi pemulihan sah terhubung |
| G: duplikasi/kegagalan transaksi | PASS: rollback tanpa event; duplicate webhook tanpa kredit/invoice ganda; kunci double-submit dan retry tetap; navigasi melepaskan koneksi; event hanya refetch |
| Tujuh suite regresi | PASS: guest realtime 11 kelompok, realtime existing 23, Midtrans MOCK 17, guest 12, tracking 13, Staff 10, browser Admin lintas aplikasi 11 |
| Browser tambahan | PASS: realtime Customer/Admin, tracking/legacy existing, 14 tes UI existing, satu suite delapan viewport dan satu suite timeout/double-submit; total 18 kasus |
| TypeScript/build | PASS: backend, Admin dan Customer Web; Staff compiler existing; kandidat commit parsial Customer diperiksa tanpa menimpa source |
| Prisma validate | PASS; schema/migration tidak diubah |
| Dependency Web | PASS: instalasi `socket.io-client@4.8.4` disetujui pengguna; npm melaporkan nol vulnerability saat instalasi |
| Runtime utama | PASS read-only: handshake backend 3000 menerima Origin localhost5175 dan credentials=true; bukan pengujian pembayaran/data customer utama |
| Provider nyata/HP fisik/lint | NOT RUN: tidak melakukan transaksi nyata, tidak mengklaim Android UI; lint Web belum dikonfigurasi |

Untuk membuktikan refetch dari socket, polling 10 detik sengaja ditahan pada fase realtime browser; polling kemudian diaktifkan untuk fase gangguan transport. Assertion awal yang memakai label status lama dan settlement sebelum Snap selesai dikoreksi pada test, tanpa mengubah teks/alur bisnis aplikasi. Kegagalan handshake awal ditangani pada transport klien dengan mempertahankan Origin ketat. Regresi akhir lulus.

Peringatan nonfatal existing: deprecation query pg, anotasi Zod/Rollup dan ukuran chunk Admin. Tidak melakukan upgrade dependency lain.

## File dan Git

Project 3: `src/realtime/server.ts` pada server, modul baru `autentikasi-tamu.ts`, script baru `test-realtime-tamu.mjs`, fixture `serve-guest-browser.mjs`, README dan dokumentasi ini serta pembaruan rujukan sinkronisasi pada `CUSTOMER-WEB-UTAMA.md`.

Customer Web: package/lock, modul baru `src/layanan/realtime.ts`, hook/refetch/guard akses di `BookingTamu.tsx`, proxy `vite.config.ts`, konfigurasi/suite realtime baru, pengecualian suite pada konfigurasi default, stub transport pada suite kontrak HTTP dan README. Staff serta Native arsip tidak diubah.

Working source pengguna dipertahankan, termasuk Prisma staged, dashboard/F10, Staff `booking.ts`, Native arsip, format `guest.ts` serta seluruh perubahan historis Customer Web. `BookingTamu.tsx` dan Vite di-commit dengan patch parsial berbasis HEAD; pemformatan historis tidak dimasukkan. Pembalikan patch fitur di memori menghasilkan hash baseline BookingTamu yang sama. Semua environment asli tetap identik.

Jalankan server suite baru melalui runner fixture yang mengisi DATABASE_URL khusus test, bukan environment aplikasi utama. Browser realtime memerlukan fixture backend3185, Vite Customer5186 dan Vite Admin5188. Endpoint `__fixture` hanya berada dalam script test yang menolak database di luar namespace fixture; tidak didaftarkan pada aplikasi/backend publik.

Rujukan protokol: [Socket.IO CORS dan credentials](https://socket.io/docs/v4/handling-cors/), [opsi klien/reconnect](https://socket.io/docs/v4/client-options/). Hasil di atas berasal dari source dan pengujian lokal, bukan hanya dokumentasi provider.
