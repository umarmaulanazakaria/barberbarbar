import type { Request, Response, NextFunction } from "express";

export const hanyaAdmin = (
  permintaan: Request,
  respon: Response,
  lanjut: NextFunction,
) => {
  if (!permintaan.pengguna) {
    return respon.status(401).json({
      pesan: "Pengguna belum terautentikasi",
    });
  }

  if (permintaan.pengguna.role !== "ADMIN") {
    return respon.status(403).json({
      pesan: "Akses hanya untuk ADMIN",
    });
  }

  lanjut();
};