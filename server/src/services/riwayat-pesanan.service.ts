import { z } from "zod";
import basisData from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";
import { ambilBookingPembayaran, bacaRingkasanPembayaran } from "./pembayaran-booking.service.js";

const tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(s + "T00:00:00Z");
  return s >= "0001-01-01" && s <= "9998-12-31" && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
export const skemaRiwayatPesanan = z.object({
  jenis: z.enum(["SEMUA", "BOOKING", "WALK_IN"]).default("SEMUA"),
  periode: z.enum(["HARI_INI", "TUJUH_HARI", "TIGA_PULUH_HARI", "RENTANG"]).default("TIGA_PULUH_HARI"),
  mulai: tanggal.optional(), selesai: tanggal.optional(),
  status: z.enum(["SEMUA", "COMPLETED", "CANCELLED", "EXPIRED"]).default("SEMUA"),
  cari: z.string().trim().max(100).default(""),
  halaman: z.coerce.number().int().min(1).max(100000).default(1),
  batas: z.coerce.number().int().min(20).max(20).default(20),
}).strict().refine(f => f.periode !== "RENTANG" || !!f.mulai && !!f.selesai && f.mulai <= f.selesai,
  { message: "Rentang tanggal tidak valid" });
export const skemaDetailRiwayat = z.object({ jenis: z.enum(["BOOKING", "WALK_IN"]), id: z.coerce.number().int().positive().max(2147483647) });
type FilterRiwayat = z.infer<typeof skemaRiwayatPesanan>;
type BarisRiwayat = { jenis: "BOOKING" | "WALK_IN"; id: number; nomor: string; pelanggan: string; jadwal: Date;
  penutupan: Date | null; sumberPenutupan: string | null; statusBackend: string; statusAkhir: "COMPLETED" | "CANCELLED" | "EXPIRED" };

// Closure saja. Pembayaran/updatedAt tidak pernah menjadi sumber waktu penutupan.
const kandidatRiwayat = Prisma.sql`WITH kandidat AS (
  SELECT 'BOOKING'::text AS jenis, b.id, b."nomorBooking" AS nomor, COALESCE(t.nama,c.nama) AS pelanggan,
    COALESCE(t."nomorTelepon",c."nomorTelepon") AS telepon, b."mulaiPada" AS jadwal, b.status::text AS "statusBackend",
    CASE WHEN b.status='COMPLETED' THEN 'COMPLETED'
      WHEN b.status='CANCELLED' AND r.aksi IN ('TIMEOUT_DP','TIMEOUT_CONFIRMATION','TIMEOUT_RESCHEDULE') THEN 'EXPIRED'
      ELSE 'CANCELLED' END AS "statusAkhir",
    COALESCE(CASE WHEN b.status='COMPLETED' THEN b."layananSelesaiPada" WHEN b.status='CANCELLED' THEN b."dibatalkanPada"
      WHEN b.status='REJECTED' THEN b."ditolakPada" END,r.waktu) AS penutupan,
    CASE WHEN b.status='COMPLETED' AND b."layananSelesaiPada" IS NOT NULL THEN 'layananSelesaiPada'
      WHEN b.status='CANCELLED' AND b."dibatalkanPada" IS NOT NULL THEN 'dibatalkanPada'
      WHEN b.status='REJECTED' AND b."ditolakPada" IS NOT NULL THEN 'ditolakPada'
      WHEN r.waktu IS NOT NULL THEN 'RiwayatBooking' END AS "sumberPenutupan"
  FROM "Booking" b JOIN "Pelanggan" c ON c.id=b."pelangganId" LEFT JOIN "AksesBookingTamu" t ON t."bookingId"=b.id
  LEFT JOIN LATERAL (SELECT h.aksi,h."dibuatPada" AS waktu FROM "RiwayatBooking" h
    WHERE h."bookingId"=b.id AND h."statusSetelah"=b.status AND h."statusSebelum"<>h."statusSetelah"
    ORDER BY h."dibuatPada" DESC,h.id DESC LIMIT 1) r ON true
  WHERE b.status IN ('COMPLETED','CANCELLED','REJECTED','NO_SHOW')
  UNION ALL
  SELECT 'WALK_IN',p.id,p."nomorPesanan",COALESCE(f.nama,c.nama,'Pelanggan Anonim'),COALESCE(f."nomorTelepon",c."nomorTelepon"),p."checkInTime" AT TIME ZONE 'UTC',p.status::text,
    p.status::text,r.waktu,CASE WHEN r.waktu IS NOT NULL THEN 'RiwayatStatusPesanan' END
  FROM "Pesanan" p LEFT JOIN "Pelanggan" c ON c.id=p."pelangganId" LEFT JOIN "ProfilPelanggan" f ON f.id=p."profilPelangganId"
  LEFT JOIN LATERAL (SELECT h."diubahPada" AT TIME ZONE 'UTC' AS waktu FROM "RiwayatStatusPesanan" h
    WHERE h."pesananId"=p.id AND h.status=p.status ORDER BY h."diubahPada" DESC,h.id DESC LIMIT 1) r ON true
  WHERE p.status IN ('COMPLETED','CANCELLED') AND NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."pesananId"=p.id)
)`;
const kolomDaftar = Prisma.sql`jenis,id,nomor,pelanggan,jadwal,penutupan,"sumberPenutupan","statusBackend","statusAkhir"`;
const transaksiBaca = <T>(baca: (tx: Prisma.TransactionClient) => Promise<T>) => basisData.$transaction(async tx => {
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  return baca(tx);
}, { isolationLevel: "RepeatableRead", timeout: 15000 });

async function pembayaranRiwayat(tx: Prisma.TransactionClient, jenis: string, id: number, sekarang: Date) {
  if (jenis === "BOOKING") {
    const r = await bacaRingkasanPembayaran(tx, await ambilBookingPembayaran(tx, id), sekarang);
    return { total: r.total, jumlahDibayar: r.jumlahDibayar, balance: r.balance, statusPembayaran: r.statusPembayaran,
      invoice: r.invoice ? { nomorInvoice: r.invoice.nomorInvoice, dibuatPada: r.invoice.dibuatPada, total: r.invoice.total } : null };
  }
  const p = await tx.pesanan.findUniqueOrThrow({ where: { id }, select: { total: true, statusPembayaran: true,
    pembayaran: { select: { nomorInvoice: true, jumlahDiterima: true, kembalian: true, dibayarPada: true } } } });
  const uang = p.pembayaran, sah = p.statusPembayaran === "PAID" && uang !== null && uang.kembalian >= 0 && uang.jumlahDiterima - uang.kembalian >= p.total;
  const jumlahDibayar = sah ? uang!.jumlahDiterima - uang!.kembalian : 0;
  return { total: p.total, jumlahDibayar, balance: Math.max(0, p.total - jumlahDibayar),
    statusPembayaran: sah ? "PAID" : p.statusPembayaran === "PAID" ? "PAYMENT_REVIEW" : "UNPAID",
    invoice: sah ? { nomorInvoice: uang!.nomorInvoice, dibuatPada: uang!.dibayarPada, total: p.total } : null };
}

export const daftarRiwayatPesanan = (filter: FilterRiwayat, waktuUji?: Date) => transaksiBaca(async tx => {
  const sekarang = waktuUji ?? await waktuDatabaseBooking(tx), hariIni = new Date(sekarang.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const awalHari = new Date(hariIni + "T00:00:00+07:00");
  const dari = filter.periode === "RENTANG" ? new Date(filter.mulai! + "T00:00:00+07:00") : new Date(awalHari.getTime() - (filter.periode === "TUJUH_HARI" ? 6 : filter.periode === "TIGA_PULUH_HARI" ? 29 : 0) * 86400000);
  const sampai = filter.periode === "RENTANG" ? new Date(new Date(filter.selesai! + "T00:00:00+07:00").getTime() + 86400000) : new Date(awalHari.getTime() + 86400000);
  const digit = filter.cari.replace(/\D/g, "").replace(/^62/, "0");
  const cari = "%" + filter.cari.replace(/[\\%_]/g, "\\$&") + "%";
  const kandidat = Prisma.sql`${kandidatRiwayat}, cocok AS (SELECT * FROM kandidat WHERE true
    ${filter.jenis === "SEMUA" ? Prisma.empty : Prisma.sql`AND jenis=${filter.jenis}`}
    ${filter.status === "SEMUA" ? Prisma.empty : Prisma.sql`AND "statusAkhir"=${filter.status}`}
    ${filter.cari ? Prisma.sql`AND (pelanggan ILIKE ${cari} OR nomor ILIKE ${cari}
      ${digit.length >= 3 ? Prisma.sql`OR regexp_replace(regexp_replace(telepon,'[^0-9]','','g'),'^62','0') LIKE ${"%" + digit + "%"}` : Prisma.empty})` : Prisma.empty}
    ), tersaring AS (SELECT * FROM cocok WHERE penutupan >= ${dari} AND penutupan < ${sampai})`;
  const [hitung] = await tx.$queryRaw<{ total: bigint; tanpaWaktu: bigint }[]>(Prisma.sql`${kandidat}
    SELECT (SELECT count(*) FROM tersaring) AS total,(SELECT count(*) FROM cocok WHERE penutupan IS NULL) AS "tanpaWaktu"`);
  const total = Number(hitung!.total), totalHalaman = Math.max(1, Math.ceil(total / 20)), halaman = Math.min(filter.halaman, totalHalaman);
  const baris = await tx.$queryRaw<BarisRiwayat[]>(Prisma.sql`${kandidat} SELECT ${kolomDaftar} FROM tersaring
    ORDER BY penutupan DESC,jenis ASC,id DESC LIMIT 20 OFFSET ${(halaman - 1) * 20}`);
  const data = [];
  for (const b of baris) data.push({ ...b, statusPembayaran: (await pembayaranRiwayat(tx, b.jenis, b.id, sekarang)).statusPembayaran });
  return { data, total, halaman, batas: 20, totalHalaman, tanpaWaktuPenutupan: Number(hitung!.tanpaWaktu), hariIni, serverTime: sekarang.toISOString() };
});

export const detailRiwayatPesanan = (jenis: "BOOKING" | "WALK_IN", id: number) => transaksiBaca(async tx => {
  const [arsip] = await tx.$queryRaw<BarisRiwayat[]>(Prisma.sql`${kandidatRiwayat} SELECT ${kolomDaftar} FROM kandidat WHERE jenis=${jenis} AND id=${id}`);
  if (!arsip) return null; // Tidak menyediakan drawer arsip untuk pesanan aktif.
  const sekarang = await waktuDatabaseBooking(tx), pembayaran = await pembayaranRiwayat(tx, jenis, id, sekarang);
  if (jenis === "BOOKING") {
    const b = await tx.booking.findUniqueOrThrow({ where: { id }, select: {
      pelanggan: { select: { nomorTelepon: true } }, aksesTamu: { select: { nomorTelepon: true } },
      barberFinal: { select: { nama: true } }, catatan: true, alasanPenolakan: true,
      items: { select: { namaLayanan: true, harga: true, qty: true, subtotal: true } },
      pesanan: { select: { barber: { select: { nama: true } }, items: { select: { namaLayanan: true, harga: true, qty: true, subtotal: true } } } },
      riwayat: { select: { id: true, aksi: true, statusSebelum: true, statusSetelah: true, dibuatPada: true }, orderBy: [{ dibuatPada: "asc" }, { id: "asc" }] },
    } });
    return { ...arsip, nomorTelepon: b.aksesTamu?.nomorTelepon ?? b.pelanggan.nomorTelepon, barber: b.barberFinal?.nama ?? b.pesanan?.barber?.nama ?? null,
      items: b.pesanan?.items ?? b.items, catatan: b.catatan, alasan: b.alasanPenolakan, pembayaran,
      riwayat: b.riwayat.map(h => ({ id: h.id, aksi: h.aksi, sebelum: h.statusSebelum, setelah: h.statusSetelah, waktu: h.dibuatPada })) };
  }
  const p = await tx.pesanan.findUniqueOrThrow({ where: { id }, select: {
    pelanggan: { select: { nomorTelepon: true } }, barber: { select: { nama: true } }, catatan: true,
    items: { select: { namaLayanan: true, harga: true, qty: true, subtotal: true } },
    riwayatStatus: { select: { id: true, status: true, diubahPada: true }, orderBy: [{ diubahPada: "asc" }, { id: "asc" }] },
  } });
  return { ...arsip, nomorTelepon: p.pelanggan?.nomorTelepon??"", barber: p.barber?.nama ?? null, items: p.items, catatan: p.catatan, alasan: null, pembayaran,
    riwayat: p.riwayatStatus.map(h => ({ id: h.id, aksi: h.status, sebelum: null, setelah: h.status, waktu: h.diubahPada })) };
});
