import { slotLayananMenit } from "../lib/slot-layanan.js";
import basisData from "../lib/prisma.js";

export const ambilLayananPublik = async () =>
  (await basisData.layanan.findMany({
    where: { aktif: true },
    select: { id: true, nama: true, harga: true, durasiMenit: true },
    orderBy: { nama: "asc" },
  })).map(l => ({ ...l, slotBookingMenit: slotLayananMenit }));

export const ambilBarberPublik = async () =>
  basisData.barber.findMany({
    where: { aktif: true },
    select: { id: true, nama: true },
    orderBy: { nama: "asc" },
  });
