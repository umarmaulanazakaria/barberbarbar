> Dokumen historis dipindahkan dari `barberbarbar/PULL-REQUEST.md`. Hasil dan path bukti mencatat waktu audit; panduan aktif ada di README utama dan laporan cleanup. Arsip privat kini berada di luar Stage 2.

# Integrasikan aplikasi customer, operasional booking dan pembayaran terverifikasi

Draft teks PR ke main, belum merge/deploy. Feature branch menghubungkan katalog
publik, akun/membership Customer, booking dan operasi Staff dengan backend
existing. Harga dan benefit disnapshot server; DP/provider, pelunasan kasir,
refund, invoice, scheduler dan realtime memakai transaksi/otorisasi pusat.
Kasir walk-in serta kontrak operator tetap kompatibel.

Perbaikan finalisasi: draf Customer tidak hilang saat refetch (repo Customer),
dialog Web dapat dipakai keyboard/screen reader, status busy dapat diamati,
dan log fatal/shutdown server tidak mencetak error mentah. Harness browser
menunggu HTTP/UI Web selesai, terpisah dari notifikasi Customer yang bisa tiba
lebih dahulu; riwayat kegagalan intermittent dipertahankan pada laporan.

Validasi: lihat F14-AUDIT.md, matriks revalidasi dan HASIL-REGRESI.json. Backend
TS/build/Prisma, auth/RBAC/race, kasir, ledger/refund MOCK, scheduler, Socket,
Web build/integration/browser serta SDK/Android export kedua app dicatat
terpisah dari device/provider nyata. Fixture terisolasi dan snapshot baru
dibandingkan setelah cleanup. Perubahan Prisma lokal historis tidak ikut PR.

Risiko/blocker: Android UI, checkout Sandbox dari Customer, refund historis
Rp2.000 final, delivery email, PRD/gap identitas, high advisory transitive dan
stabilitas browser sesuai batas laporan. Bukan Production-ready. Tidak ada
upgrade major/dependency baru pada finalisasi, tidak ada migration baru.
Migration existing pada feature branch perlu ditinjau terhadap target:
customer/link/membership/booking/ledger/invoice/refund, trigger NOTIFY dan
barberId walk-in nullable dengan CHECK. Jangan reset/seed target.

Simulasi merge-tree awal terhadap origin/main bersih; hasil perlu dicek ulang
setelah ada perubahan main. Merge/deployment memerlukan izin terpisah.
Urutan: backend/schema staging → Web → Staff → Customer, kemudian acceptance
perangkat/provider dan release gate. Lihat RELEASE-CHECKLIST.md.
