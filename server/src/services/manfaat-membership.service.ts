import type { Prisma } from "../generated/prisma/client.js";
import { KesalahanProfil } from "./profil-pelanggan.service.js";
import { gunakanWaktuMembership, statusMembership } from "../lib/status-membership.js";

export const memberLayak = async (tx: Prisma.TransactionClient, kode: string, jadwal: Date) => {
  await gunakanWaktuMembership(tx);
  const m = await tx.membership.findUnique({ where: { memberCode: kode.trim().toUpperCase() }, include: { pelanggan: { include: { profil: true } }, penjualan: { select: { status: true } } } });
  if (!m || statusMembership(m, jadwal) !== "AKTIF") throw new KesalahanProfil(409, "Nomor Member tidak dapat digunakan pada jadwal pelayanan ini.");
  return m;
};
type Item = { layananId: number; namaLayanan: string; harga: number; qty: number; durasiMenit: number; subtotal: number };
export const terapkanManfaat = async <T extends Item>(tx: Prisma.TransactionClient, items: T[], kode: string, jadwal: Date) => {
  const member = await memberLayak(tx, kode, jadwal), paket = await tx.pengaturanMembership.findUnique({ where: { id: 1 } });
  if (!paket?.layananGratisId) throw new KesalahanProfil(503, "Admin belum menetapkan layanan paket Membership.");
  // Harga sudah berasal dari katalog/tarif backend (termasuk promo jika ada).
  const harga = items.map(i => { const nilai = i.layananId === paket.layananGratisId ? 0 : i.harga - Math.floor(i.harga / 10); return { ...i, harga: nilai, subtotal: nilai * i.qty }; });
  return { member, items: harga, gratis: items.some(i => i.layananId === paket.layananGratisId),
    snapshot: { membershipId: member.id, nomorMember: member.memberCode, layananGratisId: paket.layananGratisId, berlakuSampai: member.berlakuSampai!.toISOString(), items: items.map((i, n) => ({ layananId: i.layananId, hargaReguler: i.harga, hargaMember: harga[n]!.harga, qty: i.qty })) } };
};
export const catatPenggunaan = async (tx: Prisma.TransactionClient, pesananId: number, selesaiPada: Date, bookingId?: number) => {
  const p = await tx.pesanan.findUniqueOrThrow({ where: { id: pesananId } });
  if (!p.membershipBerbayarId || !p.snapshotManfaat || p.status !== "COMPLETED") return;
  await tx.penggunaanMembership.upsert({ where: { pesananId }, create: { membershipId: p.membershipBerbayarId, pesananId, bookingId: bookingId ?? null, selesaiPada, rincian: p.snapshotManfaat }, update: {} });
  if (p.total === 0 && bookingId === undefined) await tx.pesanan.update({ where: { id: p.id }, data: { statusPembayaran: "PAID", invoiceManfaat: p.invoiceManfaat ?? `INV-MEMBER-${p.id}` } });
};
