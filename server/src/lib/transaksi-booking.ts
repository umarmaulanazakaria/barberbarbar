import type { Prisma } from "../generated/prisma/client.js";
export const kunciJadwalBooking = async (transaksi: Prisma.TransactionClient) => {
  await transaksi.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  await transaksi.$queryRaw`SELECT pg_advisory_xact_lock(7354, 1)::text`;
};
