import type { Prisma } from "../generated/prisma/client.js";

// Metadata kartu saja; status, filter, urutan dan uang tetap berasal dari proyeksi resmi.
export async function metadataOperasional(tx: Prisma.TransactionClient, baris: { jenis: string; id: number }[]) {
  const booking = await tx.booking.findMany({ where: { id: { in: baris.filter(b => b.jenis === "BOOKING").map(b => b.id) } }, select: {
      id: true, memberBebasDp: true, items: { select: { namaLayanan: true } },
      barberFinal: { select: { nama: true } }, barberDisetujui: { select: { nama: true } }, barberPilihan: { select: { nama: true } },
      pesanan: { select: { barber: { select: { nama: true } }, items: { select: { namaLayanan: true } } } },
    } });
  const walkin = await tx.pesanan.findMany({ where: { id: { in: baris.filter(b => b.jenis === "WALK_IN").map(b => b.id) } }, select: {
      id: true, membershipBerbayarId: true, barber: { select: { nama: true } }, items: { select: { namaLayanan: true } },
    } });
  const hasil = new Map<string, { barber: string | null; layanan: string[]; member: boolean }>();
  for (const b of booking) hasil.set(`BOOKING:${b.id}`, { barber: b.barberFinal?.nama ?? b.pesanan?.barber?.nama ?? b.barberDisetujui?.nama ?? b.barberPilihan?.nama ?? null, layanan: (b.pesanan?.items ?? b.items).map(i => i.namaLayanan), member: b.memberBebasDp });
  for (const p of walkin) hasil.set(`WALK_IN:${p.id}`, { barber: p.barber?.nama ?? null, layanan: p.items.map(i => i.namaLayanan), member: p.membershipBerbayarId !== null });
  return hasil;
}
