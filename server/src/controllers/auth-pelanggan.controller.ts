import type { Request, Response, NextFunction } from "express";

import { skemaRegistrasiPelanggan } from "../schemas/auth-pelanggan.schema.js";
import { registrasiPelanggan } from "../services/auth-pelanggan.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { skemaLoginPelanggan } from "../schemas/auth-pelanggan.schema.js";
import { loginPelanggan } from "../services/auth-pelanggan.service.js";
import { ambilProfilPelanggan } from "../services/auth-pelanggan.service.js";
import { skemaUbahProfilPelanggan } from "../schemas/auth-pelanggan.schema.js";
import { ubahProfilPelanggan } from "../services/auth-pelanggan.service.js";

export const daftarPelanggan = async (
  permintaan: Request,
  respon: Response,
  lanjut: NextFunction,
) => {
  const validasi = skemaRegistrasiPelanggan.safeParse(permintaan.body);

  if (!validasi.success) {
    return respon.status(400).json({
      pesan: "Data registrasi tidak valid",
      kesalahan: validasi.error.issues,
    });
  }

  try {
    const hasil = await registrasiPelanggan(validasi.data);

    if (hasil.status === "REGISTRASI_TIDAK_TERSEDIA") {
      return respon.status(409).json({
        pesan: "Registrasi tidak dapat diproses dengan data tersebut",
      });
    }

    if (hasil.status === "MENUNGGU_PERSETUJUAN") {
      return respon.status(202).json({
        pesan: "Permohonan pengaitan akun menunggu persetujuan admin",
        status: "MENUNGGU_PERSETUJUAN",
      });
    }

    return respon.status(201).json({
      pesan: "Registrasi berhasil",
      status: "BERHASIL",
    });
  } catch (kesalahan) {
    if (
      kesalahan instanceof Prisma.PrismaClientKnownRequestError &&
      kesalahan.code === "P2002"
    ) {
      return respon.status(409).json({
        pesan: "Registrasi tidak dapat diproses dengan data tersebut",
      });
    }

    lanjut(kesalahan);
  }
};

export const masukPelanggan = async (
  permintaan: Request,
  respon: Response,
  lanjut: NextFunction,
) => {
  const validasi = skemaLoginPelanggan.safeParse(permintaan.body);

  if (!validasi.success) {
    return respon.status(400).json({
      pesan: "Data login tidak valid",
      kesalahan: validasi.error.issues,
    });
  }

  try {
    const hasil = await loginPelanggan(validasi.data);

    if (!hasil) {
      return respon.status(401).json({
        pesan: "Email/nomor telepon atau password salah",
      });
    }

    return respon.status(200).json({
      pesan: "Login pelanggan berhasil",
      token: hasil.token,
      pelanggan: hasil.pelanggan,
    });
  } catch (kesalahan) {
    lanjut(kesalahan);
  }
};

export const profilPelanggan = async (
  permintaan: Request,
  respon: Response,
  lanjut: NextFunction,
) => {
  if (!permintaan.akunPelanggan) {
    return respon.status(401).json({
      pesan: "Pelanggan belum login",
    });
  }

  try {
    const akun = await ambilProfilPelanggan(permintaan.akunPelanggan.id);

    if (!akun || akun.pelanggan.status !== "AKTIF") {
      return respon.status(401).json({
        pesan: "Akun pelanggan tidak aktif atau tidak ditemukan",
      });
    }

    return respon.status(200).json({
      akun,
    });
  } catch (kesalahan) {
    lanjut(kesalahan);
  }
};

export const perbaruiProfilPelanggan = async (
  permintaan: Request,
  respon: Response,
  lanjut: NextFunction,
) => {
  if (!permintaan.akunPelanggan) {
    return respon.status(401).json({
      pesan: "Pelanggan belum login",
    });
  }

  const validasi = skemaUbahProfilPelanggan.safeParse(permintaan.body);

  if (!validasi.success) {
    return respon.status(400).json({
      pesan: "Data profil tidak valid",
      kesalahan: validasi.error.issues,
    });
  }

  try {
    const pelanggan = await ubahProfilPelanggan(
      permintaan.akunPelanggan.id,
      validasi.data,
    );

    if (!pelanggan) {
      return respon.status(401).json({
        pesan: "Akun pelanggan tidak aktif atau tidak ditemukan",
      });
    }

    return respon.status(200).json({
      pesan: "Profil pelanggan berhasil diperbarui",
      pelanggan,
    });
  } catch (kesalahan) {
    lanjut(kesalahan);
  }
};
