> Dokumen historis dipindahkan dari `barberbarbar/TEMUAN-LANJUTAN.md`. Hasil dan path bukti mencatat waktu audit; panduan aktif ada di README utama dan laporan cleanup. Arsip privat kini berada di luar Stage 2.

# Temuan untuk finalisasi berikutnya

Dokumen ini snapshot temuan akhir F13. Status revalidasi, penutupan timeout
browser dan blocker release terbaru ada di [F14-AUDIT.md](audit/F14-AUDIT.md) serta
[RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md); row historis di bawah dipertahankan.

| ID | Temuan | Bukti / tindakan berikutnya |
|---|---|---|
| OPEN-01 | Android Staff/Customer belum diuji | ADB/AVD kosong; jalankan panduan fisik, native SecureStore/restart/keyboard/tab/back/scroll/realtime |
| OPEN-02 | Checkout Sandbox dari Customer App belum terbukti | Perlu HP+ExpoGo, tunnel webhook aktif dan simulasi DP/pelunasan melalui WebBrowser; MOCK tidak cukup |
| OPEN-03 | Refund historisRp2.000 belum final | GetStatus resmi settlement tanpa refund; sumber lokal hilang. Merchant konfirmasi dashboard/support, jangan retry/rekonstruksi otomatis |
| OPEN-04 | Forgot-password belum delivery | Token hash/expiry/once/JWT revoke PASS; belum ada email/WhatsApp. Pilih provider, konfigurasi credential lokal, delivery retry/observability tanpa token log, uji inbox nyata |
| OPEN-05 | Perubahan identitas dan change-password terautentikasi belum ada | PATCH me hanya nama/alamat; perlu PRD/keputusan email/phone unique + verifikasi password + revoke sesi; jangan membuka field tanpa desain keamanan |
| OPEN-06 | Reschedule Customer hanya jadwal/barber | Backend mendukung items; UI belum menyediakan edit service/qty. Klarifikasi requirement PRD lalu uji kenaikan/penurunan/DPdifference/slot |
| OPEN-07 | Advisory backend Prisma runtime-bundled | Deepmerge-ts/mysql2 transitive; app memakai PostgreSQL, exploitability langsung belum terbukti. Jangan downgrade Prisma otomatis; review package tree/upgrade compatible dengan generate/build/regresi |
| OPEN-08 | Advisory React Router6 | Moderate openredirect/SSR deserialize; app CSR BrowserRouter/internal URLs, tidak hydrate SSR. Jangan menganggap bebas risiko; evaluasi Router7 secara terpisah |
| OPEN-09 | Advisory Expo/RN tooling | Braces/node-forge/uuid; npm omit-dev tetap memuat tooling. Reachability native/build perlu triage; jangan mengikuti saran downgrade Expo44 secara otomatis |
| OPEN-10 | Timeout konfirmasi browser intermittent | Satu run setelah WEB-BOOKING timeout; run sebelumnya dan ulangnya10grup PASS tanpa perubahan source UI. Belum root-cause, jangan mengklaim stabil dari retry saja; simpan observasi dan perlu soak/dialog race investigation |
| OPEN-11 | Master PRD v2.0 lengkap tidak tersedia | Audit mengikuti prompt dan source; perlu dokumen untuk menutup gap produk tanpa menebak |
| OPEN-12 | NOTIFY bukan durable replay | REST/refetch/reconnect/fallback diuji; pantau event loss/latency dan multi-instance operasional sebelum rilis |

BUG-01 batas reschedule server, BUG-02 alasan penolakan customer, dan BUG-03
log error mentah diperbaiki
minimal dan diuji regresi. Finalisasi tidak melakukan redesign, migration atau
perubahan autentikasi operator. Tidak merge main atau mengklaim Production-ready.
