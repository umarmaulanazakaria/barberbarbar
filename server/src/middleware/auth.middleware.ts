import "dotenv/config";

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET belum diatur");
}

export const autentikasi = (
  permintaan: Request,
  respon: Response,
  lanjut: NextFunction,
) => {
  const headerAutorisasi = permintaan.headers.authorization;

  if (!headerAutorisasi) {
    return respon.status(401).json({
      pesan: "Token tidak ditemukan",
    });
  }

  if (!headerAutorisasi.startsWith("Bearer ")) {
    return respon.status(401).json({
      pesan: "Format token tidak valid",
    });
  }

  const token = headerAutorisasi.split(" ")[1];

  if (!token) {
    return respon.status(401).json({
      pesan: "Token tidak ditemukan",
    });
  }

  try {
    const dataToken = jwt.verify(token, jwtSecret);

    if (
      typeof dataToken === "string" ||
      typeof dataToken.id !== "number" ||
      (dataToken.role !== "ADMIN" && dataToken.role !== "STAFF")
    ) {
      return respon.status(401).json({
        pesan: "Isi token tidak valid",
      });
    }

    permintaan.pengguna = {
      id: dataToken.id,
      role: dataToken.role,
    };

    lanjut();
  } catch {
    return respon.status(401).json({
      pesan: "Token tidak valid atau sudah kedaluwarsa",
    });
  }
};