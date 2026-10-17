import { z } from "zod";
import basisData from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { kunciJadwalBooking } from "../lib/transaksi-booking.js";
import { normalisasiHpWalkIn } from "../schemas/walkin-dashboard.schema.js";

export class KesalahanProfil extends Error {
  constructor(public status: number, pesan: string, public kandidat: unknown[] = []) { super(pesan); }
}
export const skemaProfil = z.object({ nama: z.string().trim().min(1).max(100),
  nomorTelepon: z.string().trim().max(30).regex(/^[+0-9\s().-]+$/).transform(normalisasiHpWalkIn).refine(v => /^08[0-9]{8,11}$/.test(v)),
  email: z.union([z.email(), z.literal("")]).optional().transform(v => v?.toLowerCase() || null),
  catatan: z.string().trim().max(2000).optional().transform(v => v || null), konfirmasiDuplikat: z.boolean().optional(),
}).strict();
type DataProfil = z.infer<typeof skemaProfil>;
export const transaksiProfil = <T>(kerja: (tx: Prisma.TransactionClient) => Promise<T>) => basisData.$transaction(async tx => {
  await kunciJadwalBooking(tx); return kerja(tx);
}, { timeout: 20000, maxWait: 20000 });
export const kandidatDuplikat = (tx: Prisma.TransactionClient, hp: string, email?: string | null, kecuali?: number) => tx.profilPelanggan.findMany({
  where: { ...(kecuali ? { id: { not: kecuali } } : {}), OR: [{ nomorTelepon: hp }, ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : [])] },
  select: { id: true, nama: true, nomorTelepon: true, email: true, diarsipkanPada: true }, orderBy: { id: "asc" }, take: 20,
});
export const simpanProfilDalamTransaksi = async (tx: Prisma.TransactionClient, data: DataProfil, penggunaId: number, id?: number) => {
  const lama = id ? await tx.profilPelanggan.findUnique({ where: { id } }) : null;
  if (id && !lama) throw new KesalahanProfil(404, "Profil tidak ditemukan");
  const kandidat = await kandidatDuplikat(tx, data.nomorTelepon, data.email, id);
  if (kandidat.length && !data.konfirmasiDuplikat) throw new KesalahanProfil(409, "Nomor HP atau email cocok dengan profil lain. Pilih profil existing atau konfirmasi membuat profil terpisah.", kandidat);
  // Kontak profil bukan kredensial akun; jangan mengubah nomor login historis.
  const pelanggan = lama ? null : await tx.pelanggan.create({ data: { nama: data.nama, nomorTelepon: null } });
  const isi = { nama: data.nama, nomorTelepon: data.nomorTelepon, email: data.email, catatan: data.catatan };
  const profil = lama ? await tx.profilPelanggan.update({ where: { id: lama.id }, data: isi }) : await tx.profilPelanggan.create({ data: { ...isi, pelangganId: pelanggan!.id } });
  await tx.riwayatProfilPelanggan.create({ data: { profilId: profil.id, penggunaId, aksi: lama ? "UBAH_PROFIL" : "TAMBAH_PROFIL",
    rincian: { sebelum: lama ? { nama: lama.nama, nomorTelepon: lama.nomorTelepon, email: lama.email, catatan: lama.catatan } : null, sesudah: isi, duplikatDikonfirmasi: data.konfirmasiDuplikat === true } } });
  await tx.$queryRaw`SELECT pg_notify('barberbarbar_realtime',json_build_object('jenis','customer.changed','id',${profil.pelangganId}::integer,'aksi','PROFILE_CHANGED','pelangganId',${profil.pelangganId}::integer,'operator','ALL','versi',txid_current()::text,'waktu',CURRENT_TIMESTAMP::text,'refetch',true)::text)::text`;
  return profil;
};
export const ubahArsipProfil = (id: number, penggunaId: number, arsipkan: boolean) => transaksiProfil(async tx => {
  const p = await tx.profilPelanggan.findUnique({ where: { id } });
  if (!p) throw new KesalahanProfil(404, "Profil tidak ditemukan");
  if (arsipkan && (await tx.pesanan.count({ where: { profilPelangganId: id, status: { in: ["WAITING", "IN_SERVICE"] } } }) ||
    await tx.booking.count({ where: { profilPelangganId: id, status: { in: ["AWAITING_DP", "PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] } } }))) throw new KesalahanProfil(409, "Profil masih memiliki Booking atau Walk-in aktif");
  if (!!p.diarsipkanPada === arsipkan) return p;
  const hasil = await tx.profilPelanggan.update({ where: { id }, data: { diarsipkanPada: arsipkan ? new Date() : null } });
  await tx.riwayatProfilPelanggan.create({ data: { profilId: id, penggunaId, aksi: arsipkan ? "ARSIPKAN" : "PULIHKAN" } });
  await tx.$queryRaw`SELECT pg_notify('barberbarbar_realtime',json_build_object('jenis','customer.changed','id',${p.pelangganId}::integer,'aksi','PROFILE_ARCHIVE_CHANGED','pelangganId',${p.pelangganId}::integer,'operator','ALL','versi',txid_current()::text,'waktu',CURRENT_TIMESTAMP::text,'refetch',true)::text)::text`;
  return hasil;
});
const statistik = async (tx: Prisma.TransactionClient, ids: number[]) => {
  if (!ids.length) return new Map<number, { jumlahKunjungan: number; kunjunganTerakhir: Date | null; totalBelanja: number }>();
  const rows = await tx.$queryRaw<{ id: number; jumlah: number; terakhir: Date | null; belanja: string }[]>(Prisma.sql`
    WITH kunjungan AS (
      SELECT b."profilPelangganId" id,COALESCE(b."layananSelesaiPada",(SELECT MAX(r."dibuatPada") FROM "RiwayatBooking" r WHERE r."bookingId"=b.id AND r."statusSetelah"='COMPLETED' AND r."statusSebelum"<>'COMPLETED')) selesai,
        GREATEST(0,COALESCE((SELECT SUM(CASE WHEN t.tujuan='REFUND' THEN -t.nominal ELSE t.nominal END)
        FROM "TransaksiPembayaranBooking" t LEFT JOIN "BuktiProviderBooking" e ON e."transaksiId"=t.id
        WHERE t."bookingId"=b.id AND t.status='SUCCEEDED' AND ((t.kanal='KASIR' AND t.tujuan='PELUNASAN' AND t."jumlahDiterima" IS NOT NULL AND t.kembalian IS NOT NULL)
        OR (t.kanal='MIDTRANS' AND e."referensiProvider"=t."referensiProvider" AND e.nominal=t.nominal AND e."mataUang"='IDR'))),0)) belanja
      FROM "Booking" b WHERE b.status='COMPLETED' AND b."profilPelangganId" IN (${Prisma.join(ids)})
      UNION ALL SELECT p."profilPelangganId",(SELECT MAX(r."diubahPada") AT TIME ZONE 'UTC' FROM "RiwayatStatusPesanan" r WHERE r."pesananId"=p.id AND r.status='COMPLETED'),
        CASE WHEN p."statusPembayaran"='PAID' AND i.id IS NOT NULL AND i."jumlahDiterima">=0 AND i.kembalian>=0 AND i."jumlahDiterima"-i.kembalian=p.total THEN i."jumlahDiterima"-i.kembalian ELSE 0 END
      FROM "Pesanan" p LEFT JOIN "Pembayaran" i ON i."pesananId"=p.id WHERE p.status='COMPLETED' AND p."profilPelangganId" IN (${Prisma.join(ids)}) AND NOT EXISTS(SELECT 1 FROM "Booking" b WHERE b."pesananId"=p.id)
    ) SELECT id,COUNT(*)::int jumlah,MAX(selesai) terakhir,SUM(belanja)::text belanja FROM kunjungan GROUP BY id`);
  return new Map(rows.map(r => { const uang = Number(r.belanja); if (!Number.isSafeInteger(uang)) throw new KesalahanProfil(503, "Statistik melebihi batas representasi"); return [r.id, { jumlahKunjungan: r.jumlah, kunjunganTerakhir: r.terakhir, totalBelanja: uang }] as const; }));
};
export const skemaCariProfil = z.object({ cari: z.string().trim().max(100).default(""), arsip: z.enum(["AKTIF", "ARSIP", "SEMUA"]).default("AKTIF"), halaman: z.coerce.number().int().min(1).max(100000).default(1) }).strict();
export const daftarProfil = (filter: z.infer<typeof skemaCariProfil>) => basisData.$transaction(async tx => {
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  const hp = normalisasiHpWalkIn(filter.cari);
  const where: Prisma.ProfilPelangganWhereInput = { ...(filter.arsip === "SEMUA" ? {} : { diarsipkanPada: filter.arsip === "ARSIP" ? { not: null } : null }),
    ...(filter.cari ? { OR: [{ nama: { contains: filter.cari, mode: "insensitive" } }, { nomorTelepon: { contains: hp } }] } : {}) };
  const total = await tx.profilPelanggan.count({ where }), halaman = Math.min(filter.halaman, Math.max(1, Math.ceil(total / 20)));
  const daftar = await tx.profilPelanggan.findMany({ where, orderBy: [{ nama: "asc" }, { id: "asc" }], skip: (halaman - 1) * 20, take: 20 });
  const angka = await statistik(tx, daftar.map(p => p.id));
  return { data: daftar.map(p => ({ ...p, ...(angka.get(p.id) ?? { jumlahKunjungan: 0, kunjunganTerakhir: null, totalBelanja: 0 }) })), total, halaman, batas: 20 };
}, { isolationLevel: "RepeatableRead", timeout: 20000 });
export const detailProfil = (id: number) => basisData.$transaction(async tx => {
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  const profil = await tx.profilPelanggan.findUnique({ where: { id }, include: { riwayat: { orderBy: { id: "desc" }, take: 100 } } });
  if (!profil) throw new KesalahanProfil(404, "Profil tidak ditemukan");
  const angka = (await statistik(tx, [id])).get(id) ?? { jumlahKunjungan: 0, kunjunganTerakhir: null, totalBelanja: 0 };
  const booking = await tx.booking.findMany({ where: { profilPelangganId: id }, select: { id: true, nomorBooking: true, status: true, mulaiPada: true, total: true, riwayat: { select: { aksi: true }, orderBy: { id: "desc" }, take: 1 } }, orderBy: { mulaiPada: "desc" } });
  const walkin = await tx.pesanan.findMany({ where: { profilPelangganId: id, booking: null }, select: { id: true, nomorPesanan: true, status: true, statusPembayaran: true, checkInTime: true, total: true }, orderBy: { checkInTime: "desc" } });
  return { profil, ...angka, riwayatPesanan: [...booking.map(b => ({ id: b.id, jenis: "BOOKING", nomor: b.nomorBooking, status: b.status, waktu: b.mulaiPada, total: b.total, alasan: b.riwayat[0]?.aksi })),
    ...walkin.map(p => ({ id: p.id, jenis: "WALK_IN", nomor: p.nomorPesanan, status: p.status, waktu: p.checkInTime, total: p.total, statusPembayaran: p.statusPembayaran }))].sort((a, b) => b.waktu.getTime() - a.waktu.getTime()) };
}, { isolationLevel: "RepeatableRead", timeout: 20000 });
export const konteksProfilBooking = (id: number, cari = "") => transaksiProfil(async tx => {
  const b = await tx.booking.findUnique({ where: { id }, include: { aksesTamu: true, pelanggan: true, profilPelanggan: true } });
  if (!b) throw new KesalahanProfil(404, "Booking tidak ditemukan");
  const hp = normalisasiHpWalkIn(b.aksesTamu?.nomorTelepon ?? b.pelanggan.nomorTelepon ?? ""), nama = b.aksesTamu?.nama ?? b.pelanggan.nama;
  const tokenNama = nama.toLocaleLowerCase().split(/\s+/).filter(v => v.length >= 3);
  const where: Prisma.ProfilPelangganWhereInput = cari ? { OR: [{ nama: { contains: cari, mode: "insensitive" } }, { nomorTelepon: { contains: normalisasiHpWalkIn(cari) } }] } :
    { OR: [...(hp ? [{ nomorTelepon: hp }] : []), ...tokenNama.map(v => ({ nama: { contains: v, mode: "insensitive" as const } }))] };
  const kandidat = await tx.profilPelanggan.findMany({ where, orderBy: { nama: "asc" }, take: 20 });
  return { profil: b.profilPelanggan, dapatDiubah: !["COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW"].includes(b.status), kandidat: kandidat.map(p => ({ ...p, kecocokanHp: p.nomorTelepon === hp, kemiripanNama: tokenNama.some(v => p.nama.toLocaleLowerCase().split(/\s+/).includes(v)) })).sort((a, c) => Number(c.kecocokanHp) - Number(a.kecocokanHp) || Number(c.kemiripanNama) - Number(a.kemiripanNama)) };
});
export const tautkanProfilBooking = (id: number, profilId: number | null, penggunaId: number) => transaksiProfil(async tx => {
  const b = await tx.booking.findUnique({ where: { id } });
  if (!b) throw new KesalahanProfil(404, "Booking tidak ditemukan");
  if (["COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW"].includes(b.status)) throw new KesalahanProfil(409, "Hubungan hanya dapat diubah sebelum pelayanan selesai");
  const profil = profilId ? await tx.profilPelanggan.findUnique({ where: { id: profilId } }) : null;
  if (profilId && (!profil || profil.diarsipkanPada)) throw new KesalahanProfil(409, "Pilih profil aktif; pemulihan hanya oleh Admin");
  if (b.profilPelangganId === profilId) return b;
  await tx.booking.update({ where: { id }, data: { profilPelangganId: profilId } });
  if (b.pesananId) await tx.pesanan.update({ where: { id: b.pesananId }, data: { profilPelangganId: profilId } });
  await tx.riwayatBooking.create({ data: { bookingId: id, penggunaId, aksi: "UBAH_HUBUNGAN_PROFIL", statusSebelum: b.status, statusSetelah: b.status,
    rincian: { profilSebelumnya: b.profilPelangganId, profilBaru: profilId } } });
  for (const p of [...new Set([b.profilPelangganId, profilId])]) if (p) await tx.riwayatProfilPelanggan.create({ data: { profilId: p, penggunaId, aksi: "UBAH_HUBUNGAN_BOOKING", rincian: { bookingId: id, profilSebelumnya: b.profilPelangganId, profilBaru: profilId } } });
  return { profilId };
});
