import { randomUUID } from "node:crypto";
import basisData from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";

const formatKodeMembership = (nomor: number) => `MEM-${String(nomor).padStart(3, "0")}`;

export const ambilSemuaMembership = async () => {
  return basisData.membership.findMany({
    include: { pelanggan: true },
    orderBy: { joinedAt: "desc" },
  });
};

export const ambilMembershipBerdasarkanId = async (id: number) => {
  return basisData.membership.findUnique({
    where: { id },
    include: { pelanggan: true },
  });
};

// Digunakan flow operator dan approval customer: satu sumber benefit/kode member.
export const buatMembershipDalamTransaksi = async (
  transaksi: Prisma.TransactionClient,
  data: { pelangganId: number; discountPercent?: number | undefined; isActive?: boolean | undefined },
) => {
  await transaksi.$queryRaw`SELECT pg_advisory_xact_lock(7353, 1)::text`;
  const dibuat = await transaksi.membership.create({ data: {
    pelangganId: data.pelangganId, memberCode: `TEMP-${randomUUID()}`,
    discountPercent: data.discountPercent ?? 10, isActive: data.isActive ?? true,
  } });
  let nomorKode = dibuat.id;
  let memberCode = formatKodeMembership(nomorKode);
  while (await transaksi.membership.findUnique({ where: { memberCode } })) {
    memberCode = formatKodeMembership(++nomorKode);
  }
  return transaksi.membership.update({ where: { id: dibuat.id }, data: { memberCode }, include: { pelanggan: true } });
};

export const kunciPelangganMembership = (transaksi: Prisma.TransactionClient, id: number) =>
  transaksi.$queryRaw<Array<{ id: number }>>`SELECT "id" FROM "Pelanggan" WHERE "id" = ${id} FOR UPDATE`;

export const tambahMembership = async (data: {
  pelangganId: number; discountPercent?: number | undefined; isActive?: boolean | undefined;
}) => basisData.$transaction(async transaksi => {
  await kunciPelangganMembership(transaksi, data.pelangganId);
  const pelanggan = await transaksi.pelanggan.findUnique({ where: { id: data.pelangganId }, include: { membership: true } });
  if (!pelanggan) return { berhasil: false, alasan: "PELANGGAN_TIDAK_DITEMUKAN" } as const;
  if (pelanggan.status === "DIBLOKIR") return { berhasil: false, alasan: "PELANGGAN_DIBLOKIR" } as const;
  if (pelanggan.membership) return { berhasil: false, alasan: "SUDAH_MEMBER" } as const;
  const membership = await buatMembershipDalamTransaksi(transaksi, data);
  return { berhasil: true, data: membership } as const;
});

export const ubahMembership = async (
  id: number,
  data: {
    discountPercent?: number | undefined;
    isActive?: boolean | undefined;
  },
) => {
  const membership = await basisData.membership.findUnique({ where: { id } });
  if (!membership) return { berhasil: false, alasan: "TIDAK_DITEMUKAN" } as const;

  const diperbarui = await basisData.membership.update({
    where: { id },
    data: {
      ...(data.discountPercent !== undefined && { discountPercent: data.discountPercent }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: { pelanggan: true },
  });

  return { berhasil: true, data: diperbarui } as const;
};

export const hapusMembership = async (id: number) => {
  const membership = await basisData.membership.findUnique({ where: { id } });
  if (!membership) return null;
  return basisData.membership.delete({ where: { id } });
};
