import basisData from "../lib/prisma.js";
import { buatMembershipDalamTransaksi, kunciPelangganMembership } from "./membership.service.js";

const kolomPermohonan = {
  id: true, status: true, dibuatPada: true, diputuskanPada: true, catatanKeputusan: true,
} as const;

export const statusMembershipPelanggan = async (pelangganId: number) => {
  const [membership, permohonan] = await basisData.$transaction([
    basisData.membership.findUnique({ where: { pelangganId }, select: {
      id: true, memberCode: true, isActive: true, discountPercent: true, joinedAt: true,
    } }),
    basisData.permohonanMembership.findFirst({ where: { pelangganId },
      select: kolomPermohonan, orderBy: { id: "desc" } }),
  ], { isolationLevel: "RepeatableRead" });
  const status = membership ? (membership.isActive ? "ACTIVE" : "INACTIVE") :
    permohonan?.status === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : "NON_MEMBER";
  return { status, dapatMengajukan: status === "NON_MEMBER", diskonPersen: membership?.isActive ? membership.discountPercent : 0,
    membership, permohonan };
};

export const ajukanMembershipPelanggan = async (pelangganId: number) =>
  basisData.$transaction(async transaksi => {
    await kunciPelangganMembership(transaksi, pelangganId);
    const pelanggan = await transaksi.pelanggan.findUnique({ where: { id: pelangganId }, include: { membership: true } });
    if (!pelanggan || pelanggan.status !== "AKTIF") return null;
    if (pelanggan.membership) return null; // Termasuk INACTIVE; reaktivasi hanya ADMIN.
    if (await transaksi.permohonanMembership.findFirst({ where: { pelangganId, status: "PENDING_APPROVAL" } })) return null;
    return transaksi.permohonanMembership.create({ data: { pelangganId }, select: kolomPermohonan });
  });

export const daftarPermohonanMembership = async () => basisData.permohonanMembership.findMany({
  select: { ...kolomPermohonan, pelanggan: { select: { id: true, nama: true, status: true } },
    diputuskanOleh: { select: { id: true, name: true } } },
  orderBy: { id: "desc" },
});

export const putuskanPermohonanMembership = async (
  id: number, idAdmin: number, disetujui: boolean, catatanKeputusan?: string,
) => basisData.$transaction(async transaksi => {
  const awal = await transaksi.permohonanMembership.findUnique({ where: { id }, select: { pelangganId: true } });
  if (!awal) return "TIDAK_DITEMUKAN" as const;
  await kunciPelangganMembership(transaksi, awal.pelangganId);
  const permohonan = await transaksi.permohonanMembership.findUnique({ where: { id }, include: {
    pelanggan: { include: { membership: true, akunPelanggan: { select: { id: true } } } },
  } });
  if (!permohonan || permohonan.status !== "PENDING_APPROVAL") return "KONFLIK" as const;
  const pelanggan = permohonan.pelanggan;
  if (disetujui && (pelanggan.status !== "AKTIF" || !pelanggan.akunPelanggan || pelanggan.membership?.isActive === false)) {
    return "KONFLIK" as const;
  }
  // Operator mungkin telah mendaftarkan member lewat flow existing. Benefit itu
  // tetap authoritative; rejection tidak boleh mencabut membership operator.
  if (!disetujui && pelanggan.membership) return "KONFLIK" as const;
  const klaim = await transaksi.permohonanMembership.updateMany({
    where: { id, status: "PENDING_APPROVAL" },
    data: { status: disetujui ? "APPROVED" : "REJECTED", diputuskanOlehId: idAdmin,
      diputuskanPada: new Date(), catatanKeputusan: catatanKeputusan ?? null },
  });
  if (klaim.count !== 1) return "KONFLIK" as const;
  if (disetujui && !pelanggan.membership) {
    await buatMembershipDalamTransaksi(transaksi, { pelangganId: pelanggan.id, discountPercent: 10, isActive: true });
  }
  return "BERHASIL" as const;
});
