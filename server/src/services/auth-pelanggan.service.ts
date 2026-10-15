import bcrypt from "bcrypt";

import basisData from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { sidikKredensialPelanggan } from "../lib/kredensial-pelanggan.js";
import type { DataRegistrasiPelanggan } from "../schemas/auth-pelanggan.schema.js";
import jwt from "jsonwebtoken";
import type { DataLoginPelanggan } from "../schemas/auth-pelanggan.schema.js";
import type { DataUbahProfilPelanggan } from "../schemas/auth-pelanggan.schema.js";

export const registrasiPelanggan = async (data: DataRegistrasiPelanggan) => {
  const email = data.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(data.password, 12);
  try {
    // Serializable melindungi predikat email/permohonan tanpa unique index baru.
    return await basisData.$transaction(async (transaksi) => {
      const akunTerdaftar = await transaksi.akunPelanggan.findFirst({
        where: { email: { equals: email, mode: "insensitive" } }, select: { id: true },
      });
      if (akunTerdaftar) return { status: "REGISTRASI_TIDAK_TERSEDIA" } as const;
      const pelangganExisting = await transaksi.pelanggan.findUnique({
        where: { nomorTelepon: data.nomorTelepon },
        include: { akunPelanggan: { select: { id: true } } },
      });
      if (pelangganExisting?.status === "DIBLOKIR" || pelangganExisting?.akunPelanggan) {
        return { status: "REGISTRASI_TIDAK_TERSEDIA" } as const;
      }
      const permohonanAktif = await transaksi.permohonanPengaitanAkun.findFirst({
        where: { status: "MENUNGGU", OR: [
          ...(pelangganExisting ? [{ pelangganId: pelangganExisting.id }] : []),
          { email: { equals: email, mode: "insensitive" } },
        ] }, select: { id: true },
      });
      if (permohonanAktif) return { status: "REGISTRASI_TIDAK_TERSEDIA" } as const;
      if (pelangganExisting) {
        await transaksi.permohonanPengaitanAkun.create({ data: {
          pelangganId: pelangganExisting.id, namaPendaftar: data.nama,
          nomorTelepon: data.nomorTelepon, email, passwordHash,
        } });
        return { status: "MENUNGGU_PERSETUJUAN" } as const;
      }
      await transaksi.pelanggan.create({ data: {
        nama: data.nama, nomorTelepon: data.nomorTelepon, alamat: data.alamat ?? null,
        akunPelanggan: { create: { email, passwordHash } },
      } });
      return { status: "BERHASIL" } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (kesalahan) {
    if (kesalahan instanceof Prisma.PrismaClientKnownRequestError &&
        (kesalahan.code === "P2002" || kesalahan.code === "P2034")) {
      return { status: "REGISTRASI_TIDAK_TERSEDIA" } as const;
    }
    throw kesalahan;
  }
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
      kredensial: sidikKredensialPelanggan(akun.passwordHash, jwtSecret),
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

export class KesalahanProfilPelanggan extends Error {
  constructor(public kode: number, pesan: string) { super(pesan); }
}
export const ubahProfilPelanggan = async (
  idAkun: number,
  data: DataUbahProfilPelanggan,
) => {
  try { return await basisData.$transaction(async transaksi => {
  // Urutan lock sama dengan reset password; validasi password sesudah lock.
  await transaksi.$queryRaw`SELECT "id" FROM "AkunPelanggan" WHERE "id" = ${idAkun} FOR UPDATE`;
  const akun = await transaksi.akunPelanggan.findUnique({
    where: { id: idAkun },
    select: {
      pelangganId: true,
      email: true,
      passwordHash: true,
      pelanggan: {
        select: { status: true },
      },
    },
  });

  if (!akun || akun.pelanggan.status !== "AKTIF") {
    return null;
  }

  const sensitif = data.email !== undefined || data.nomorTelepon !== undefined || data.passwordBaru !== undefined;
  if (sensitif && (!data.passwordSaatIni || !await bcrypt.compare(data.passwordSaatIni, akun.passwordHash))) {
    throw new KesalahanProfilPelanggan(403, "Kata sandi saat ini tidak sesuai");
  }
  if (data.email !== undefined && data.email !== akun.email) {
    const konflik = await transaksi.akunPelanggan.findFirst({ where: { id: { not: idAkun }, email: { equals: data.email, mode: "insensitive" } }, select: { id: true } });
    const pending = await transaksi.permohonanPengaitanAkun.findFirst({ where: { status: "MENUNGGU", email: { equals: data.email, mode: "insensitive" } }, select: { id: true } });
    if (konflik || pending) throw new KesalahanProfilPelanggan(409, "Perubahan profil tidak dapat diproses dengan data tersebut");
  }
  if (sensitif) {
    // Rehash mencabut JWT berbasis sidik kredensial existing, termasuk ketika
    // hanya email/telepon berubah. Tidak memerlukan kolom/migration baru.
    const passwordHash = await bcrypt.hash(data.passwordBaru ?? data.passwordSaatIni!, 12);
    await transaksi.akunPelanggan.update({ where: { id: idAkun }, data: {
      passwordHash, ...(data.email !== undefined ? { email: data.email } : {}),
    } });
    await transaksi.passwordResetToken.updateMany({ where: { akunPelangganId: idAkun, digunakanPada: null }, data: { digunakanPada: new Date() } });
  }
  const pelanggan = await transaksi.pelanggan.update({
    where: { id: akun.pelangganId },
    data: {
      ...(data.nama !== undefined && { nama: data.nama }),
      ...(data.alamat !== undefined && { alamat: data.alamat }),
      ...(data.nomorTelepon !== undefined && { nomorTelepon: data.nomorTelepon }),
    },
    select: {
      id: true,
      nama: true,
      nomorTelepon: true,
      alamat: true,
      status: true,
    },
  });
  return { pelanggan, sesiDicabut: sensitif };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      throw new KesalahanProfilPelanggan(409, "Perubahan profil tidak dapat diproses dengan data tersebut");
    }
    throw error;
  }
};
