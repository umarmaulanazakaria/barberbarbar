import type { Prisma } from "../generated/prisma/client.js";
import { zonaBooking } from "./jadwal-booking.js";

export const nomorMemberTerbit = (kode: string) => /^(TEMP|PENDING)-/.test(kode) ? null : kode;
export async function terbitkanNomorMember(tx: Prisma.TransactionClient, id: number, aktivasiPada: Date) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(7353, 1)::text`;
  const m = await tx.membership.findUniqueOrThrow({ where: { id }, include: { pelanggan: { include: { profil: true } } } });
  if (nomorMemberTerbit(m.memberCode)) return m.memberCode; // Termasuk nomor legacy: permanen.
  const hp = (m.pelanggan.profil?.nomorTelepon ?? "").replace(/\D/g, "");
  if (hp.length < 4) throw Error("Profil Member belum memiliki nomor HP yang valid.");
  const bagian = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: zonaBooking, day: "2-digit", month: "2-digit" }).formatToParts(aktivasiPada).map(p => [p.type, p.value]));
  const dasar = `${bagian.day}${bagian.month}${hp.slice(-4)}`;
  let nomor = dasar, urutan = 0;
  while (await tx.membership.findUnique({ where: { memberCode: nomor }, select: { id: true } })) nomor = dasar + String(++urutan).padStart(2, "0");
  await tx.membership.update({ where: { id }, data: { memberCode: nomor } });
  return nomor;
}
