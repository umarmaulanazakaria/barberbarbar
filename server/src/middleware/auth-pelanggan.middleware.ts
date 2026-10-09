import "dotenv/config";

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import basisData from "../lib/prisma.js";
import { sidikKredensialPelanggan } from "../lib/kredensial-pelanggan.js";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET belum diatur");
}

export const autentikasiPelanggan = async (
  permintaan: Request,
  respon: Response,
  lanjut: NextFunction,
) => {
  const header = permintaan.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return respon.status(401).json({
      pesan: "Token pelanggan tidak ditemukan atau tidak valid",
    });
  }

  const token = header.slice(7).trim();

  if (!token) {
    return respon.status(401).json({
      pesan: "Token pelanggan tidak ditemukan",
    });
  }

  try {
    const dataToken = jwt.verify(token, jwtSecret);

    if (
      typeof dataToken === "string" ||
      dataToken.tipe !== "CUSTOMER" ||
      typeof dataToken.id !== "number" ||
      !Number.isSafeInteger(dataToken.id) ||
      dataToken.id <= 0
    ) {
      return respon.status(401).json({
        pesan: "Token pelanggan tidak valid",
      });
    }

    const akun = await basisData.akunPelanggan.findUnique({
      where: { id: dataToken.id },
      select: {
        id: true,
        pelangganId: true,
        passwordHash: true,
        pelanggan: {
          select: { status: true },
        },
      },
    });

    if (!akun || akun.pelanggan.status !== "AKTIF" ||
        dataToken.kredensial !== sidikKredensialPelanggan(akun.passwordHash, jwtSecret)) {
      return respon.status(401).json({
        pesan: "Akun pelanggan tidak aktif atau tidak ditemukan",
      });
    }

    permintaan.akunPelanggan = {
      id: akun.id,
      pelangganId: akun.pelangganId,
    };

    return lanjut();
  } catch (kesalahan) {
    if (kesalahan instanceof jwt.JsonWebTokenError) {
      return respon.status(401).json({
        pesan: "Token pelanggan tidak valid atau kedaluwarsa",
      });
    }

    return lanjut(kesalahan);
  }
};
