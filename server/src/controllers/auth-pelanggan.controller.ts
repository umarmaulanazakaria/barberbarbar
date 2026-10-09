import type { Request, Response, NextFunction } from "express";

import { skemaRegistrasiPelanggan } from "../schemas/auth-pelanggan.schema.js";
import { registrasiPelanggan } from "../services/auth-pelanggan.service.js";
import { Prisma } from "../generated/prisma/client.js";

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
