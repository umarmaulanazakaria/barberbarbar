import type { Prisma } from "../generated/prisma/client.js";

export const penyimpananPembayaranSiap = async (tx: Prisma.TransactionClient) => {
  const hasil = await tx.$queryRaw<{ siap: boolean }[]>`SELECT to_regclass('public."PembayaranOperasional"') IS NOT NULL AS siap`;
  return hasil[0]?.siap === true;
};
export const pembayaranOperasionalPending = async (tx: Prisma.TransactionClient, pesananId: number, kecualiId?: number) =>
  await penyimpananPembayaranSiap(tx) && await tx.pembayaranOperasional.count({ where: { pesananId, status: "PENDING", ...(kecualiId === undefined ? {} : { id: { not: kecualiId } }) } }) > 0;
