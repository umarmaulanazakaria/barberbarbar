import bcrypt from "bcrypt";

import basisData from "../lib/prisma.js";
import type { DataRegistrasiPelanggan } from "../schemas/auth-pelanggan.schema.js";

export const registrasiPelanggan = async (data: DataRegistrasiPelanggan) => {
  const email = data.email.trim().toLowerCase();

  const akunTerdaftar = await basisData.akunPelanggan.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (akunTerdaftar) {
    return { status: "REGISTRASI_TIDAK_TERSEDIA" } as const;
  }

  const pelangganExisting = await basisData.pelanggan.findUnique({
    where: { nomorTelepon: data.nomorTelepon },
    select: {
      id: true,
      status: true,
      akunPelanggan: {
        select: { id: true },
      },
    },
  });

  if (
    pelangganExisting?.status === "DIBLOKIR" ||
    pelangganExisting?.akunPelanggan
  ) {
    return { status: "REGISTRASI_TIDAK_TERSEDIA" } as const;
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  if (pelangganExisting) {
    const permohonanAktif = await basisData.permohonanPengaitanAkun.findFirst({
      where: {
        status: "MENUNGGU",
        OR: [
          { pelangganId: pelangganExisting.id },
          {
            email: {
              equals: email,
              mode: "insensitive",
            },
          },
        ],
      },
      select: { id: true },
    });

    if (permohonanAktif) {
      return { status: "REGISTRASI_TIDAK_TERSEDIA" } as const;
    }

    await basisData.permohonanPengaitanAkun.create({
      data: {
        pelangganId: pelangganExisting.id,
        namaPendaftar: data.nama,
        nomorTelepon: data.nomorTelepon,
        email,
        passwordHash,
      },
    });

    return { status: "MENUNGGU_PERSETUJUAN" } as const;
  }

  // Pembuatan pelanggan dan akun harus berhasil bersama-sama.
  await basisData.$transaction(async (transaksi) => {
    const pelangganBaru = await transaksi.pelanggan.create({
      data: {
        nama: data.nama,
        nomorTelepon: data.nomorTelepon,
        alamat: data.alamat ?? null,
      },
    });

    await transaksi.akunPelanggan.create({
      data: {
        pelangganId: pelangganBaru.id,
        email,
        passwordHash,
      },
    });
  });

  return { status: "BERHASIL" } as const;
};
