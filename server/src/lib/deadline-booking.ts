import type { Prisma } from "../generated/prisma/client.js";

export const menitKonfirmasi = 30;
export const menitNoShow = 15;

// Epoch dari database tidak bergantung pada timezone/clock komputer aplikasi.
export const waktuDatabaseBooking = async (tx: Prisma.TransactionClient) => {
  const [hasil] = await tx.$queryRaw<{ milidetik: number }[]>`
    SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::float8 AS milidetik`;
  if (!hasil || !Number.isFinite(hasil.milidetik)) throw new Error("WAKTU_DATABASE_INVALID");
  return new Date(hasil.milidetik);
};

// Deadline durable dari kejadian persisten, bukan diperbaruiPada yang dapat
// berubah saat operator/payment bekerja. Riwayat terakhir adalah versi aktif.
export const batasKonfirmasiBooking = async (tx: Prisma.TransactionClient, booking: { id: number; dibuatPada: Date }) => {
  const reschedule = await tx.riwayatBooking.findFirst({ where: { bookingId: booking.id, aksi: "RESCHEDULE" },
    orderBy: { id: "desc" }, select: { id: true, dibuatPada: true } });
  const awal = reschedule?.dibuatPada ?? booking.dibuatPada;
  return { deadline: new Date(awal.getTime() + menitKonfirmasi * 60_000), versi: reschedule?.id ?? 0 };
};
