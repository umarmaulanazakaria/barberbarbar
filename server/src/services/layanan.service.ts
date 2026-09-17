import basisData from "../lib/prisma.js";
export const ambilSemuaLayanan = async () =>
  basisData.layanan.findMany({ orderBy: { nama: "asc" } });
export const ambilLayananBerdasarkanId = async (id: number) =>
  basisData.layanan.findUnique({ where: { id } });
export const tambahLayanan = async (data: {
  nama: string;
  durasiMenit: number;
  harga: number;
  aktif?: boolean | undefined;
}) =>
  basisData.layanan.create({
    data: {
      nama: data.nama,
      durasiMenit: data.durasiMenit,
      harga: data.harga,
      aktif: data.aktif ?? true,
    },
  });
export const ubahLayanan = async (
  id: number,
  data: {
    nama?: string | undefined;
    durasiMenit?: number | undefined;
    harga?: number | undefined;
    aktif?: boolean | undefined;
  },
) => {
  const ada = await basisData.layanan.findUnique({ where: { id } });
  if (!ada) return null;
  return basisData.layanan.update({
    where: { id },
    data: {
      ...(data.nama !== undefined && { nama: data.nama }),
      ...(data.durasiMenit !== undefined && { durasiMenit: data.durasiMenit }),
      ...(data.harga !== undefined && { harga: data.harga }),
      ...(data.aktif !== undefined && { aktif: data.aktif }),
    },
  });
};
export const hapusLayanan = async (id: number) => {
  const data = await basisData.layanan.findUnique({
    where: { id },
    include: { _count: { select: { itemPesanan: true } } },
  });
  if (!data) return { berhasil: false, alasan: "TIDAK_DITEMUKAN" } as const;
  if (data._count.itemPesanan > 0)
    return { berhasil: false, alasan: "PUNYA_RIWAYAT" } as const;
  await basisData.layanan.delete({ where: { id } });
  return { berhasil: true } as const;
};
