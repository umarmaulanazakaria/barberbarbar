import type { Prisma } from "../generated/prisma/client.js";

export type StatusMembership = "AKTIF" | "KEDALUWARSA" | "BELUM_AKTIF" | "MENUNGGU_PEMBAYARAN";
type DataStatus = {
  isActive: boolean; berlakuMulai: Date | null; berlakuSampai: Date | null;
  pelanggan: { status: string; profil: { diarsipkanPada: Date | null } | null };
  penjualan: { status: string }[];
};
// Tanggal yang dibaca adapter Prisma harus memakai sesi UTC, seperti flow aktivasi/Booking.
export const gunakanWaktuMembership = (tx: Prisma.TransactionClient) => tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
export function statusMembership(m: DataStatus, pada: Date): StatusMembership {
  if (!m.penjualan.some(p => p.status === "SUCCEEDED")) return m.penjualan.some(p => p.status === "PENDING") ? "MENUNGGU_PEMBAYARAN" : "BELUM_AKTIF";
  if (!m.berlakuMulai || !m.berlakuSampai || m.berlakuMulai > pada) return "BELUM_AKTIF";
  if (m.berlakuSampai <= pada) return "KEDALUWARSA";
  return m.isActive && m.pelanggan.status === "AKTIF" && !m.pelanggan.profil?.diarsipkanPada ? "AKTIF" : "BELUM_AKTIF";
}
export function filterStatusMembership(status: string, pada: Date): Prisma.MembershipWhereInput {
  const terbayar: Prisma.MembershipWhereInput = { penjualan: { some: { status: "SUCCEEDED" } } };
  const aktif: Prisma.MembershipWhereInput = { AND: [terbayar, { isActive: true, berlakuMulai: { lte: pada }, berlakuSampai: { gt: pada },
    pelanggan: { status: "AKTIF", OR: [{ profil: null }, { profil: { diarsipkanPada: null } }] } }] };
  const kedaluwarsa: Prisma.MembershipWhereInput = { AND: [terbayar, { berlakuMulai: { lte: pada }, berlakuSampai: { lte: pada } }] };
  const menunggu: Prisma.MembershipWhereInput = { penjualan: { none: { status: "SUCCEEDED" }, some: { status: "PENDING" } } };
  return status === "AKTIF" ? aktif : status === "KEDALUWARSA" ? kedaluwarsa : status === "MENUNGGU_PEMBAYARAN" ? menunggu : status === "BELUM_AKTIF" ? { NOT: { OR: [aktif, kedaluwarsa, menunggu] } } : {};
}
