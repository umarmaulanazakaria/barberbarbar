import basisData from "../lib/prisma.js";

export const ambilLayananPublik = async () =>
  basisData.layanan.findMany({
    where: { aktif: true },
    select: { id: true, nama: true, harga: true, durasiMenit: true },
    orderBy: { nama: "asc" },
  });

export const ambilBarberPublik = async () =>
  basisData.barber.findMany({
    where: { aktif: true },
    select: { id: true, nama: true },
    orderBy: { nama: "asc" },
  });
