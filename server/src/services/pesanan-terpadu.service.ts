import basisData from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";
import { ambilBookingPembayaran, bacaRingkasanPembayaran } from "./pembayaran-booking.service.js";
import { z } from "zod";
const tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(s + "T00:00:00Z"); return s >= "0001-01-01" && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
export const skemaDaftarTerpadu = z.object({
  jenis: z.enum(["SEMUA", "BOOKING", "WALK_IN"]).default("SEMUA"),
  periode: z.enum(["HARI_INI", "MENDATANG", "SEMUA", "RENTANG", "RIWAYAT"]).default("HARI_INI"), mulai: tanggal.optional(), selesai: tanggal.optional(),
  status: z.enum(["SEMUA", "WAITING", "AWAITING_DP", "PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW"]).default("SEMUA"),
  pembayaran: z.enum(["SEMUA", "PAID", "UNPAID"]).default("SEMUA"), cari: z.string().trim().max(100).default(""),
  halaman: z.coerce.number().int().min(1).max(100000).default(1), batas: z.coerce.number().int().min(1).max(50).default(20),
  ringkasan: z.enum(["true", "false"]).default("false"),
}).strict().refine(d => d.periode !== "RENTANG" || !!d.mulai && !!d.selesai && d.mulai <= d.selesai, { message: "Rentang tanggal tidak valid" });
type Filter = z.infer<typeof skemaDaftarTerpadu>;
export const hariWib = (w: Date) => new Date(w.getTime() + 7 * 3600000).toISOString().slice(0, 10);
export const awalWib = (hari: string) => new Date(hari + "T00:00:00+07:00");
type Baris = { jenis: "BOOKING" | "WALK_IN"; id: number; bookingId: number | null; pesananId: number | null;
  nomor: string; nomorPesanan: string | null; pelanggan: string; barber: string | null; jadwal: Date; checkIn: Date | null;
  status: string; statusPembayaran: string; total: number; nomorInvoice: string | null };
export const daftarPesananTerpadu = (f: Filter) => basisData.$transaction(async tx => {
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  const sekarang = await waktuDatabaseBooking(tx), hariIni = hariWib(sekarang), awal = awalWib(hariIni), akhir = new Date(awal.getTime() + 86400000);
  const dari = f.periode === "MENDATANG" ? akhir : f.periode === "HARI_INI" ? awal : f.periode === "RENTANG" ? awalWib(f.mulai!) : null;
  const sampai = f.periode === "HARI_INI" ? akhir : f.periode === "RENTANG" ? new Date(awalWib(f.selesai!).getTime() + 86400000) : f.periode === "RIWAYAT" ? awal : null;
  const rentang = (kolom: Prisma.Sql) => Prisma.sql`${dari ? Prisma.sql`AND ${kolom} >= ${dari}` : Prisma.empty} ${sampai ? Prisma.sql`AND ${kolom} < ${sampai}` : Prisma.empty}`;
  // Kredit sah sama dengan ringkasan existing; refund tidak dihitung sebagai pembayaran baru.
  const kandidat = Prisma.sql`WITH kandidat AS (
    SELECT 'BOOKING'::text AS jenis, b.id, b.id AS "bookingId", b."pesananId", b."nomorBooking" AS nomor,
      p."nomorPesanan", c.nama AS pelanggan, br.nama AS barber, b."mulaiPada" AS jadwal, b."checkInPada" AS "checkIn",
      b.status::text AS status, COALESCE(p.total,b.total)::int AS total,
      (b.status::text NOT IN ('CANCELLED','REJECTED','NO_SHOW') AND uang.jumlah > 0 AND uang.net >= COALESCE(p.total,b.total)) AS lunas, i."nomorInvoice"
    FROM "Booking" b JOIN "Pelanggan" c ON c.id=b."pelangganId" LEFT JOIN "Pesanan" p ON p.id=b."pesananId"
    LEFT JOIN "Barber" br ON br.id=COALESCE(b."barberFinalId",b."barberDisetujuiId",b."barberPilihanId") LEFT JOIN "InvoiceBooking" i ON i."bookingId"=b.id
    CROSS JOIN LATERAL (SELECT count(*) AS jumlah, COALESCE(sum(CASE WHEN t.tujuan='REFUND' THEN -t.nominal ELSE t.nominal END),0) AS net
      FROM "TransaksiPembayaranBooking" t LEFT JOIN "BuktiProviderBooking" e ON e."transaksiId"=t.id
      WHERE t."bookingId"=b.id AND t.status='SUCCEEDED' AND
       ((t.kanal='KASIR' AND t.tujuan='PELUNASAN' AND t."jumlahDiterima" IS NOT NULL AND t.kembalian IS NOT NULL)
        OR (t.kanal='MIDTRANS' AND e."referensiProvider"=t."referensiProvider" AND e.nominal=t.nominal AND e."mataUang"='IDR'))) uang
    WHERE true ${rentang(Prisma.sql`b."mulaiPada"`)}
    UNION ALL
    SELECT 'WALK_IN', p.id, NULL::int, p.id, p."nomorPesanan", p."nomorPesanan", COALESCE(f.nama,c.nama,'Pelanggan Anonim'), br.nama,
      p."checkInTime" AT TIME ZONE 'UTC', p."checkInTime" AT TIME ZONE 'UTC', p.status::text, p.total, p."statusPembayaran"='PAID', i."nomorInvoice"
    FROM "Pesanan" p LEFT JOIN "Pelanggan" c ON c.id=p."pelangganId" LEFT JOIN "ProfilPelanggan" f ON f.id=p."profilPelangganId" LEFT JOIN "Barber" br ON br.id=p."barberId" LEFT JOIN "Pembayaran" i ON i."pesananId"=p.id
    WHERE NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."pesananId"=p.id) ${rentang(Prisma.sql`(p."checkInTime" AT TIME ZONE 'UTC')`)}
  ), tersaring AS (SELECT * FROM kandidat WHERE true
    ${f.jenis !== "SEMUA" ? Prisma.sql`AND jenis=${f.jenis}` : Prisma.empty}
    ${f.periode === "MENDATANG" ? Prisma.sql`AND jenis='BOOKING' AND status IN ('AWAITING_DP','PENDING_CONFIRMATION','CONFIRMED','CHECKED_IN','IN_SERVICE')
      AND NOT EXISTS (SELECT 1 FROM "Booking" x WHERE x.id="bookingId" AND x.status='AWAITING_DP' AND (x."deadlineDp" IS NULL OR x."deadlineDp"<=${sekarang}))` : Prisma.empty}
    ${f.periode === "MENDATANG" ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM "Booking" x WHERE x.id="bookingId" AND x.status='PENDING_CONFIRMATION' AND
      COALESCE((SELECT r."dibuatPada" FROM "RiwayatBooking" r WHERE r."bookingId"=x.id AND r.aksi='RESCHEDULE' ORDER BY r.id DESC LIMIT 1),x."dibuatPada") + interval '30 minutes' <= ${sekarang})` : Prisma.empty}
    ${f.periode === "MENDATANG" ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM "Booking" x WHERE x.id="bookingId" AND x.status='CONFIRMED' AND (x."deadlineDp" IS NULL OR x."deadlineDp"<=${sekarang}) AND
      (SELECT COALESCE(sum(t.nominal),0) FROM "TransaksiPembayaranBooking" t JOIN "BuktiProviderBooking" e ON e."transaksiId"=t.id
       WHERE t."bookingId"=x.id AND t.status='SUCCEEDED' AND t.kanal='MIDTRANS' AND t.tujuan='DP' AND e."referensiProvider"=t."referensiProvider" AND e.nominal=t.nominal AND e."mataUang"='IDR'
        AND t."dibayarPada"<=t."deadlinePada" AND (t."roundKonfirmasiPada"=CASE WHEN x."sumberBooking"='TAMU' THEN x."dibuatPada" ELSE x."dikonfirmasiPada" END OR t."roundKonfirmasiPada"=x."dpDibawaDariRound")) < x."nominalDp")` : Prisma.empty}
    ${f.status !== "SEMUA" ? Prisma.sql`AND status=${f.status}` : Prisma.empty}
    ${f.pembayaran === "PAID" ? Prisma.sql`AND lunas` : f.pembayaran === "UNPAID" ? Prisma.sql`AND NOT lunas AND status NOT IN ('CANCELLED','REJECTED','NO_SHOW')` : Prisma.empty}
    ${f.cari ? Prisma.sql`AND (nomor ILIKE ${"%" + f.cari + "%"} OR "nomorPesanan" ILIKE ${"%" + f.cari + "%"} OR pelanggan ILIKE ${"%" + f.cari + "%"})` : Prisma.empty}
  )`;
  const [hitung] = await tx.$queryRaw<{ jumlah: bigint }[]>(Prisma.sql`${kandidat} SELECT count(*) AS jumlah FROM tersaring`);
  const baris = await tx.$queryRaw<(Omit<Baris, "statusPembayaran"> & { lunas: boolean })[]>(Prisma.sql`${kandidat} SELECT * FROM tersaring ORDER BY jadwal ${f.periode === "MENDATANG" ? Prisma.sql`ASC` : Prisma.sql`DESC`}, jenis ASC, id DESC LIMIT ${f.batas} OFFSET ${(f.halaman - 1) * f.batas}`);
  const data: Baris[] = [];
  for (const b of baris) {
    const { lunas, ...rincian } = b;
    const ringkas = b.bookingId === null ? null : await bacaRingkasanPembayaran(tx, await ambilBookingPembayaran(tx, b.bookingId), sekarang);
    data.push({ ...rincian, statusPembayaran: ringkas?.statusPembayaran ?? (lunas ? "PAID" : "UNPAID") });
  }
  // Domain metrik tetap receipt kasir final existing. Tidak menjumlah receipt dan ledger booking dua kali.
  const metrik = f.ringkasan === "true" ? {
    waiting: await tx.pesanan.count({ where: { status: "WAITING" } }), inService: await tx.pesanan.count({ where: { status: "IN_SERVICE" } }),
    completedUnpaid: await tx.pesanan.count({ where: { status: "COMPLETED", statusPembayaran: "UNPAID" } }),
    paidToday: await tx.pembayaran.count({ where: { dibayarPada: { gte: awal, lt: akhir } } }),
    revenueToday: (await tx.pembayaran.findMany({ where: { dibayarPada: { gte: awal, lt: akhir } }, select: { pesanan: { select: { total: true } } } })).reduce((n,p) => n + p.pesanan.total, 0),
    pelanggan: await tx.pelanggan.count({ where: { status: "AKTIF" } }), barberAktif: await tx.barber.count({ where: { aktif: true } }), layananAktif: await tx.layanan.count({ where: { aktif: true } }),
  } : undefined;
  return { data, total: Number(hitung!.jumlah), halaman: f.halaman, batas: f.batas, hariIni, serverTime: sekarang.toISOString(), metrik };
}, { isolationLevel: "RepeatableRead", timeout: 15000 });
