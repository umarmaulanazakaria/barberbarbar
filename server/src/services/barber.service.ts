import basisData from "../lib/prisma.js";

export const ambilSemuaBarber = async () =>
  basisData.barber.findMany({ orderBy: { nama: "asc" } });
export const ambilBarberBerdasarkanId = async (id: number) =>
  basisData.barber.findUnique({ where: { id } });

export const tambahBarber = async (dataBarber: {
  nama: string;
  nomorTelepon?: string | undefined;
  aktif?: boolean | undefined;
}) => {
  if (dataBarber.nomorTelepon) {
    const sama = await basisData.barber.findUnique({
      where: { nomorTelepon: dataBarber.nomorTelepon },
    });
    if (sama)
      return { berhasil: false, alasan: "NOMOR_TELEPON_DIGUNAKAN" } as const;
  }
  const data = await basisData.barber.create({
    data: {
      nama: dataBarber.nama,
      nomorTelepon: dataBarber.nomorTelepon ?? null,
      aktif: dataBarber.aktif ?? true,
    },
  });
  return { berhasil: true, data } as const;
};

export const ubahBarber = async (
  id: number,
  dataBarber: {
    nama?: string | undefined;
    nomorTelepon?: string | undefined;
    aktif?: boolean | undefined;
  },
) => {
  const ada = await basisData.barber.findUnique({ where: { id } });
  if (!ada) return { berhasil: false, alasan: "TIDAK_DITEMUKAN" } as const;
  if (dataBarber.nomorTelepon !== undefined) {
    const sama = await basisData.barber.findUnique({
      where: { nomorTelepon: dataBarber.nomorTelepon },
    });
    if (sama && sama.id !== id)
      return { berhasil: false, alasan: "NOMOR_TELEPON_DIGUNAKAN" } as const;
  }
  const data = await basisData.barber.update({
    where: { id },
    data: {
      ...(dataBarber.nama !== undefined && { nama: dataBarber.nama }),
      ...(dataBarber.nomorTelepon !== undefined && {
        nomorTelepon: dataBarber.nomorTelepon,
      }),
      ...(dataBarber.aktif !== undefined && { aktif: dataBarber.aktif }),
    },
  });
  return { berhasil: true, data } as const;
};

export const hapusBarber = async (id: number) => {
  const data = await basisData.barber.findUnique({
    where: { id },
    include: { _count: { select: { pesanan: true } } },
  });
  if (!data) return { berhasil: false, alasan: "TIDAK_DITEMUKAN" } as const;
  if (data._count.pesanan > 0)
    return { berhasil: false, alasan: "PUNYA_RIWAYAT" } as const;
  await basisData.barber.delete({ where: { id } });
  return { berhasil: true } as const;
};
