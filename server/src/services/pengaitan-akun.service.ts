import { Prisma } from "../generated/prisma/client.js";
import basisData from "../lib/prisma.js";

export const ambilDaftarPermohonan = async () => {
  return basisData.permohonanPengaitanAkun.findMany({
    select: {
      id: true,
      namaPendaftar: true,
      nomorTelepon: true,
      email: true,
      status: true,
      dibuatPada: true,
      diputuskanPada: true,
      catatanKeputusan: true,
      pelanggan: {
        select: {
          id: true,
          nama: true,
          status: true,
        },
      },
      diputuskanOleh: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { dibuatPada: "desc" },
  });
};

export const setujuiPengaitanAkun = async (
  idPermohonan: number,
  idAdmin: number,
) => {
  try {
    return await basisData.$transaction(async (transaksi) => {
      const permohonan = await transaksi.permohonanPengaitanAkun.findUnique({
        where: { id: idPermohonan },
        include: {
          pelanggan: {
            include: {
              akunPelanggan: true,
            },
          },
        },
      });

      if (!permohonan) {
        return { status: "TIDAK_DITEMUKAN" } as const;
      }

      if (permohonan.status !== "MENUNGGU") {
        return { status: "SUDAH_DIPUTUSKAN" } as const;
      }

      if (
        permohonan.pelanggan.status !== "AKTIF" ||
        permohonan.pelanggan.akunPelanggan
      ) {
        return { status: "TIDAK_DAPAT_DISETUJUI" } as const;
      }

      const emailDigunakan = await transaksi.akunPelanggan.findFirst({
        where: {
          email: {
            equals: permohonan.email,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      if (emailDigunakan) {
        return { status: "TIDAK_DAPAT_DISETUJUI" } as const;
      }

      const pembaruan = await transaksi.permohonanPengaitanAkun.updateMany({
        where: {
          id: idPermohonan,
          status: "MENUNGGU",
        },
        data: {
          status: "DISETUJUI",
          diputuskanOlehId: idAdmin,
          diputuskanPada: new Date(),
          passwordHash: "",
        },
      });

      if (pembaruan.count !== 1) {
        return { status: "SUDAH_DIPUTUSKAN" } as const;
      }

      await transaksi.akunPelanggan.create({
        data: {
          pelangganId: permohonan.pelangganId,
          email: permohonan.email,
          passwordHash: permohonan.passwordHash,
        },
      });

      return { status: "BERHASIL" } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (kesalahan) {
    if (
      kesalahan instanceof Prisma.PrismaClientKnownRequestError &&
      (kesalahan.code === "P2002" || kesalahan.code === "P2034")
    ) {
      return { status: "KONFLIK" } as const;
    }

    throw kesalahan;
  }
};

export const tolakPengaitanAkun = async (
  idPermohonan: number,
  idAdmin: number,
  catatanKeputusan?: string,
) => {
  const hasil = await basisData.permohonanPengaitanAkun.updateMany({
    where: {
      id: idPermohonan,
      status: "MENUNGGU",
    },
    data: {
      status: "DITOLAK",
      diputuskanOlehId: idAdmin,
      diputuskanPada: new Date(),
      catatanKeputusan: catatanKeputusan ?? null,
      passwordHash: "",
    },
  });

  return {
    status: hasil.count === 1 ? "BERHASIL" : "TIDAK_DIPROSES",
  } as const;
};
