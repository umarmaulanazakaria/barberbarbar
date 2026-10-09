import bcrypt from "bcrypt";

import basisData from "../lib/prisma.js";
import type { DataRegistrasiPelanggan } from "../schemas/auth-pelanggan.schema.js";
import jwt from "jsonwebtoken";
import type { DataLoginPelanggan } from "../schemas/auth-pelanggan.schema.js";
import type { DataUbahProfilPelanggan } from "../schemas/auth-pelanggan.schema.js";

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

export const loginPelanggan = async (data: DataLoginPelanggan) => {
  const identitas = data.identitas.trim();

  const akun = await basisData.akunPelanggan.findFirst({
    where: {
      OR: [
        {
          email: {
            equals: identitas.toLowerCase(),
            mode: "insensitive",
          },
        },
        {
          pelanggan: {
            nomorTelepon: identitas,
          },
        },
      ],
    },
    include: {
      pelanggan: true,
    },
  });

  if (!akun || akun.pelanggan.status !== "AKTIF") {
    return null;
  }

  const passwordSesuai = await bcrypt.compare(data.password, akun.passwordHash);

  if (!passwordSesuai) {
    return null;
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET belum diatur");
  }

  const token = jwt.sign(
    {
      id: akun.id,
      tipe: "CUSTOMER",
    },
    jwtSecret,
    {
      expiresIn: "1d",
    },
  );

  return {
    token,
    pelanggan: {
      id: akun.pelanggan.id,
      nama: akun.pelanggan.nama,
      nomorTelepon: akun.pelanggan.nomorTelepon,
      email: akun.email,
    },
  };
};

export const ambilProfilPelanggan = async (idAkun: number) => {
  return basisData.akunPelanggan.findUnique({
    where: { id: idAkun },
    select: {
      id: true,
      email: true,
      dibuatPada: true,
      pelanggan: {
        select: {
          id: true,
          nama: true,
          nomorTelepon: true,
          alamat: true,
          status: true,
        },
      },
    },
  });
};

export const ubahProfilPelanggan = async (
  idAkun: number,
  data: DataUbahProfilPelanggan,
) => {
  const akun = await basisData.akunPelanggan.findUnique({
    where: { id: idAkun },
    select: {
      pelangganId: true,
      pelanggan: {
        select: { status: true },
      },
    },
  });

  if (!akun || akun.pelanggan.status !== "AKTIF") {
    return null;
  }

  return basisData.pelanggan.update({
    where: { id: akun.pelangganId },
    data: {
      ...(data.nama !== undefined && { nama: data.nama }),
      ...(data.alamat !== undefined && { alamat: data.alamat }),
    },
    select: {
      id: true,
      nama: true,
      nomorTelepon: true,
      alamat: true,
      status: true,
    },
  });
};
