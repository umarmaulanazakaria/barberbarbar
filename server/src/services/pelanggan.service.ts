import basisData from "../lib/prisma.js";

export const ambilDataSemuaPelanggan = async () =>
  basisData.pelanggan.findMany({
    include: { membership: true },
    orderBy: { nama: "asc" },
  });

export const tambahDataPelanggan = async (dataPelanggan: {
  nama: string;
  nomorTelepon: string;
  alamat?: string | undefined;
}) => {
  const sama = await basisData.pelanggan.findUnique({
    where: { nomorTelepon: dataPelanggan.nomorTelepon },
  });
  if (sama) return null;

  return basisData.pelanggan.create({
    data: { ...dataPelanggan, alamat: dataPelanggan.alamat ?? null },
    include: { membership: true },
  });
};

export const ambilDataPelangganBerdasarkanId = async (idPelanggan: number) =>
  basisData.pelanggan.findUnique({
    where: { id: idPelanggan },
    include: { membership: true },
  });

export const ambilDataPelangganBerdasarkanNomorTelepon = async (
  nomorTelepon: string,
) => basisData.pelanggan.findUnique({ where: { nomorTelepon } });

export const ubahDataPelanggan = async (
  idPelanggan: number,
  dataPelanggan: {
    nama?: string | undefined;
    nomorTelepon?: string | undefined;
    alamat?: string | undefined;
  },
) => {
  const ada = await basisData.pelanggan.findUnique({
    where: { id: idPelanggan },
  });
  if (!ada) return null;

  return basisData.pelanggan.update({
    where: { id: idPelanggan },
    data: {
      ...(dataPelanggan.nama !== undefined && { nama: dataPelanggan.nama }),
      ...(dataPelanggan.nomorTelepon !== undefined && {
        nomorTelepon: dataPelanggan.nomorTelepon,
      }),
      ...(dataPelanggan.alamat !== undefined && {
        alamat: dataPelanggan.alamat,
      }),
    },
    include: { membership: true },
  });
};

export const hapusDataPelanggan = async (idPelanggan: number) => {
  const pelanggan = await basisData.pelanggan.findUnique({
    where: { id: idPelanggan },
    include: { _count: { select: { pesanan: true } } },
  });

  if (!pelanggan)
    return { berhasil: false, alasan: "TIDAK_DITEMUKAN" } as const;
  if (pelanggan.status === "DIBLOKIR")
    return { berhasil: false, alasan: "DIBLOKIR" } as const;
  if (pelanggan._count.pesanan > 0)
    return { berhasil: false, alasan: "PUNYA_RIWAYAT" } as const;

  await basisData.pelanggan.delete({ where: { id: idPelanggan } });
  return { berhasil: true } as const;
};

export const blokirDataPelanggan = async (idPelanggan: number) => {
  const ada = await basisData.pelanggan.findUnique({
    where: { id: idPelanggan },
  });
  if (!ada) return null;

  return basisData.pelanggan.update({
    where: { id: idPelanggan },
    data: { status: "DIBLOKIR" },
    include: { membership: true },
  });
};

export const bukaBlokirDataPelanggan = async (idPelanggan: number) => {
  const ada = await basisData.pelanggan.findUnique({
    where: { id: idPelanggan },
  });
  if (!ada) return null;

  return basisData.pelanggan.update({
    where: { id: idPelanggan },
    data: { status: "AKTIF" },
    include: { membership: true },
  });
};
