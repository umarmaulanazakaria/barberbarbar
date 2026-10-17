import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import basisData from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { transaksiProfil, simpanProfilDalamTransaksi, skemaProfil, KesalahanProfil } from "./profil-pelanggan.service.js";
import { buatMembershipDalamTransaksi } from "./membership.service.js";
import { gerbangQris, skemaStatusQris, lengkapiGambarQris, urlQrisAman, KesalahanChargeQris } from "../lib/qris-midtrans.js";
import { gerbangMidtrans, merchantSandbox, verifikasiSignatureMidtrans } from "../lib/midtrans.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";
import { normalisasiHpWalkIn } from "../schemas/walkin-dashboard.schema.js";

const gagal = (pesan: string, status = 409): never => { throw new KesalahanProfil(status, pesan); };
export const skemaPenjualan = z.object({ profilId: z.number().int().positive().optional(), profilBaru: skemaProfil.optional(), membershipId: z.number().int().positive().optional(), berlakuSampaiDiharapkan: z.string().datetime({ offset: true }).nullable().optional(),
  metode: z.enum(["CASH", "TRANSFER", "QRIS"]), kunci: z.uuid(), hargaDiharapkan: z.number().int().positive().max(2147483647), diterima: z.literal(true).optional(), jumlahDiterima: z.number().int().positive().max(2147483647).optional(), referensi: z.string().trim().min(3).max(200).optional(),
}).strict().refine(d => [!!d.profilId, !!d.profilBaru, !!d.membershipId].filter(Boolean).length === 1)
  .refine(d => !d.membershipId || d.berlakuSampaiDiharapkan !== undefined)
  .refine(d => d.metode === "QRIS" ? d.diterima === undefined && d.jumlahDiterima === undefined && d.referensi === undefined : d.diterima && !!d.jumlahDiterima && (d.metode !== "TRANSFER" || !!d.referensi));
const dtoPenjualan = { id: true, membershipId: true, nominal: true, metode: true, status: true, urlQris: true, kedaluwarsaPada: true, statusProvider: true, dibuatPada: true, dibayarPada: true, periodeMulai: true, periodeSampai: true, jumlahDiterima: true, referensi: true } as const;
export const paketMembership = () => basisData.pengaturanMembership.findUniqueOrThrow({ where: { id: 1 } });
export const ubahPaketMembership = (harga: number, layananGratisId: number, penggunaId: number) => transaksiProfil(async tx => {
  if (!await tx.layanan.findFirst({ where: { id: layananGratisId, aktif: true } })) return gagal("Pilih layanan paket yang aktif.");
  const lama = await tx.pengaturanMembership.findUniqueOrThrow({ where: { id: 1 } });
  if (lama.layananGratisId && lama.layananGratisId !== layananGratisId && await tx.penjualanMembership.count()) return gagal("Identitas layanan paket sudah terkunci oleh riwayat penjualan. Harga paket berikutnya tetap dapat diubah.");
  const hasil = await tx.pengaturanMembership.update({ where: { id: 1 }, data: { harga, layananGratisId, diubahPada: await waktuDatabaseBooking(tx) } });
  await tx.$executeRaw`INSERT INTO "AuditPaketMembership"("penggunaId",sebelum,sesudah) VALUES(${penggunaId},${JSON.stringify(lama)}::jsonb,${JSON.stringify(hasil)}::jsonb)`;
  return hasil;
});
const tambahTahun = (tanggal: Date) => { const d = new Date(tanggal), hari = d.getUTCDate(); d.setUTCDate(1); d.setUTCFullYear(d.getUTCFullYear() + 1); d.setUTCDate(Math.min(hari, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate())); return d; };
const aktivasi = async (tx: Prisma.TransactionClient, id: number, pada: Date, bukti?: Prisma.InputJsonObject) => {
  const jual = await tx.penjualanMembership.findUniqueOrThrow({ where: { id } });
  if (jual.status === "SUCCEEDED") return;
  const m = await tx.membership.findUniqueOrThrow({ where: { id: jual.membershipId } });
  const awal = m.berlakuSampai && m.berlakuSampai > pada ? m.berlakuSampai : pada, akhir = tambahTahun(awal);
  const klaim = await tx.penjualanMembership.updateMany({ where: { id, status: { not: "SUCCEEDED" } }, data: { status: "SUCCEEDED", dibayarPada: pada, periodeMulai: awal, periodeSampai: akhir, ...(bukti ? { buktiProvider: bukti } : {}) } });
  if (klaim.count !== 1) return;
  await tx.membership.update({ where: { id: m.id }, data: { isActive: true, discountPercent: 10, berlakuMulai: m.berlakuSampai && m.berlakuSampai > pada ? m.berlakuMulai ?? pada : pada, berlakuSampai: akhir } });
};
export const jualMembership = async (data: z.infer<typeof skemaPenjualan>, penggunaId: number) => {
  if (data.metode === "QRIS") merchantSandbox();
  const sidik = createHash("sha256").update(JSON.stringify({ ...data, penggunaId })).digest("hex");
  const awal = await transaksiProfil(async tx => {
    const lama = await tx.penjualanMembership.findUnique({ where: { kunci: data.kunci } });
    if (lama) { if (lama.sidik !== sidik) return gagal("Kunci penjualan dipakai untuk data berbeda."); return { id: lama.id, baru: false, order: lama.providerOrderId, nominal: lama.nominal }; }
    const paket = await tx.pengaturanMembership.findUniqueOrThrow({ where: { id: 1 } });
    if (!paket.layananGratisId || !await tx.layanan.findFirst({ where: { id: paket.layananGratisId, aktif: true } })) return gagal("Tetapkan layanan Haircut + Wash paket melalui Pengaturan Membership sebelum menjual.");
    if (paket.harga !== data.hargaDiharapkan) return gagal("Harga paket berubah. Muat ulang sebelum menerima pembayaran.");
    const profil = data.profilBaru ? await simpanProfilDalamTransaksi(tx, data.profilBaru, penggunaId) : data.profilId ? await tx.profilPelanggan.findUnique({ where: { id: data.profilId } }) : null;
    if (!data.membershipId && (!profil || profil.diarsipkanPada || !profil.nomorTelepon)) return gagal("Pilih profil aktif dengan nama dan nomor HP lengkap.");
    let m = data.membershipId ? await tx.membership.findUnique({ where: { id: data.membershipId } }) : await tx.membership.findUnique({ where: { pelangganId: profil!.pelangganId } });
    if (data.membershipId && !m) return gagal("Member tidak ditemukan.", 404);
    if (!m) m = await buatMembershipDalamTransaksi(tx, { pelangganId: profil!.pelangganId, isActive: false });
    if (data.membershipId && (m.berlakuSampai?.getTime() ?? null) !== (data.berlakuSampaiDiharapkan ? new Date(data.berlakuSampaiDiharapkan).getTime() : null)) return gagal("Periode member sudah berubah. Periksa pembayaran atau perpanjangan oleh Admin lain sebelum mengirim kembali.");
    if (!data.membershipId && await tx.penjualanMembership.count({ where: { membershipId: m.id, status: "SUCCEEDED" } })) return gagal("Pelanggan sudah memiliki Nomor Member. Gunakan Perpanjang dari Detail Membership agar transaksi tidak tercatat ganda.");
    const pemilik = await tx.pelanggan.findUniqueOrThrow({ where: { id: m.pelangganId }, include: { profil: true } });
    if (pemilik.status !== "AKTIF" || !pemilik.profil?.nomorTelepon || pemilik.profil.diarsipkanPada) return gagal("Lengkapi atau pulihkan profil pelanggan sebelum menjual membership.");
    const pending = await tx.penjualanMembership.findFirst({ where: { membershipId: m.id, status: "PENDING" } });
    if (pending) return gagal(`Pembayaran #${pending.id} masih pending. Buka detail member dan periksa transaksi tersebut; jangan membuat pembayaran baru.`);
    if (data.metode !== "QRIS" && (data.jumlahDiterima! < paket.harga || data.metode === "TRANSFER" && data.jumlahDiterima !== paket.harga)) return gagal("Jumlah penerimaan tidak sesuai harga paket.", 400);
    const order = data.metode === "QRIS" ? `BBMEM-${randomUUID()}` : null;
    const dibuat = await tx.penjualanMembership.create({ data: { membershipId: m.id, penggunaId, kunci: data.kunci, sidik, nominal: paket.harga, metode: data.metode, jumlahDiterima: data.jumlahDiterima ?? null, referensi: data.referensi ?? null, providerOrderId: order, statusProvider: order ? "CREATING" : null } });
    if (!order) await aktivasi(tx, dibuat.id, await waktuDatabaseBooking(tx));
    return { id: dibuat.id, baru: !!order, order, nominal: paket.harga };
  });
  if (awal.baru) {
    try { const respons = await lengkapiGambarQris(skemaStatusQris.parse(await gerbangQris.buat(awal.order!, awal.nominal))); await simpanStatusMembership(awal.id, respons, false); }
    catch (e) { await transaksiProfil(async tx => { await tx.penjualanMembership.updateMany({ where: { id: awal.id, status: "PENDING", statusProvider: "CREATING" }, data: { statusProvider: e instanceof KesalahanChargeQris && e.pastiDitolak ? "REJECTED" : "UNCERTAIN", ...(e instanceof KesalahanChargeQris && e.pastiDitolak ? { status: "FAILED" } : {}) } }); }); }
  }
  return basisData.penjualanMembership.findUniqueOrThrow({ where: { id: awal.id }, select: dtoPenjualan });
};
const simpanStatusMembership = (id: number, p: z.infer<typeof skemaStatusQris>, terverifikasi: boolean) => transaksiProfil(async tx => {
  const t = await tx.penjualanMembership.findUniqueOrThrow({ where: { id } });
  if (p.order_id !== t.providerOrderId || p.merchant_id !== merchantSandbox() || Number(p.gross_amount) !== t.nominal || p.payment_type !== "qris" || p.currency && p.currency !== "IDR" || t.providerTransactionId && t.providerTransactionId !== p.transaction_id) return gagal("Bukti provider tidak sesuai transaksi Membership.");
  if (t.status === "SUCCEEDED") return; // Tidak menurunkan settlement oleh notifikasi lama.
  const url = p.actions?.find(a => a.method === "GET" && urlQrisAman(a.url))?.url;
  const tanggal = (v: string) => { if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) return gagal("Waktu provider tidak valid."); const d = new Date(v.replace(" ", "T") + "+07:00"); if (!Number.isFinite(d.getTime())) return gagal("Waktu provider tidak valid."); return d; };
  await tx.penjualanMembership.update({ where: { id }, data: { providerTransactionId: p.transaction_id, statusProvider: p.transaction_status, ...(url ? { urlQris: url } : {}), ...(p.expiry_time ? { kedaluwarsaPada: tanggal(p.expiry_time) } : {}) } });
  if (!terverifikasi) return;
  if (p.transaction_status === "settlement" && p.status_code === "200" && (!p.fraud_status || p.fraud_status === "accept")) {
    if (!p.settlement_time) return gagal("Settlement provider belum memuat waktu pembayaran.");
    await aktivasi(tx, id, tanggal(p.settlement_time), { metodeVerifikasi: "MIDTRANS_STATUS_V1", orderId: p.order_id, transactionId: p.transaction_id, nominal: t.nominal, mataUang: "IDR", status: "settlement", diperiksaPada: (await waktuDatabaseBooking(tx)).toISOString() });
  } else if (["deny", "cancel", "expire", "failure"].includes(p.transaction_status)) await tx.penjualanMembership.update({ where: { id }, data: { status: "FAILED" } });
});
export const sinkronMembership = async (id: number) => {
  const t = await basisData.penjualanMembership.findUniqueOrThrow({ where: { id } });
  if (!t.providerOrderId) return basisData.penjualanMembership.findUniqueOrThrow({ where: { id }, select: dtoPenjualan });
  const p = await lengkapiGambarQris(skemaStatusQris.parse(await gerbangMidtrans.status(t.providerOrderId)), t.urlQris);
  await simpanStatusMembership(id, p, true);
  return basisData.penjualanMembership.findUniqueOrThrow({ where: { id }, select: dtoPenjualan });
};
export const notifikasiMembership = async (body: unknown) => {
  const p = z.object({ order_id: z.string().max(128), status_code: z.string(), gross_amount: z.string(), signature_key: z.string() }).passthrough().parse(body);
  if (!verifikasiSignatureMidtrans(p)) return gagal("Signature tidak valid.", 403);
  const t = await basisData.penjualanMembership.findUnique({ where: { providerOrderId: p.order_id } });
  if (!t) return gagal("Transaksi Membership tidak ditemukan.", 404);
  await sinkronMembership(t.id); return { diterima: true };
};
export const daftarMember = (cari: string, status: string, halaman: number) => basisData.$transaction(async tx => {
  const sekarang = await waktuDatabaseBooking(tx), hp = normalisasiHpWalkIn(cari);
  const where: Prisma.MembershipWhereInput = { ...(cari ? { OR: [{ memberCode: { contains: cari.toUpperCase() } }, { pelanggan: { profil: { nama: { contains: cari, mode: "insensitive" } } } }, { pelanggan: { profil: { nomorTelepon: { contains: hp } } } }] } : {}),
    ...(status === "AKTIF" ? { isActive: true, berlakuSampai: { gt: sekarang }, berlakuMulai: { lte: sekarang } } : status === "KEDALUWARSA" ? { OR: [{ berlakuSampai: null }, { berlakuSampai: { lte: sekarang } }, { isActive: false }] } : {}) };
  // AND menjaga filter pencarian dan status tetap diterapkan bersamaan.
  const pencarian: Prisma.MembershipWhereInput = cari ? { OR: [{ memberCode: { contains: cari.toUpperCase() } }, { pelanggan: { profil: { nama: { contains: cari, mode: "insensitive" } } } }, { pelanggan: { profil: { nomorTelepon: { contains: hp } } } }] } : {};
  const filter = { AND: [where, pencarian] }, total = await tx.membership.count({ where: filter }), page = Math.min(halaman, Math.max(1, Math.ceil(total / 20)));
  const daftar = await tx.membership.findMany({ where: filter, include: { pelanggan: { include: { profil: true } } }, orderBy: { id: "desc" }, skip: (page - 1) * 20, take: 20 });
  return { data: daftar.map(m => ({ id: m.id, nomorMember: m.memberCode, nama: m.pelanggan.profil?.nama ?? m.pelanggan.nama, nomorTelepon: m.pelanggan.profil?.nomorTelepon ?? m.pelanggan.nomorTelepon, berlakuSampai: m.berlakuSampai, status: m.isActive && m.berlakuMulai && m.berlakuMulai <= sekarang && m.berlakuSampai && m.berlakuSampai > sekarang ? "AKTIF" : "KEDALUWARSA" })), total, halaman: page };
});
export const detailMember = async (id: number) => {
  const m = await basisData.membership.findUnique({ where: { id }, include: { pelanggan: { include: { profil: true } }, penjualan: { select: dtoPenjualan, orderBy: { id: "desc" } }, penggunaan: { orderBy: { id: "desc" } } } });
  if (!m) return gagal("Member tidak ditemukan.", 404);
  return { id: m.id, nomorMember: m.memberCode, nama: m.pelanggan.profil?.nama ?? m.pelanggan.nama, nomorTelepon: m.pelanggan.profil?.nomorTelepon ?? m.pelanggan.nomorTelepon, berlakuMulai: m.berlakuMulai, berlakuSampai: m.berlakuSampai, isActive: m.isActive, penjualan: m.penjualan, penggunaan: m.penggunaan };
};
