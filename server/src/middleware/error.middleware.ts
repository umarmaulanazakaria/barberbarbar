import type { Request, Response, NextFunction } from "express";
import { Prisma } from "../generated/prisma/client.js";

export const tidakDitemukan = (req: Request, res: Response) => {
  return res.status(404).json({ pesan: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan` });
};

export const tanganiKesalahan = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const kategori = error instanceof SyntaxError ? "JSON_INVALID"
    : error instanceof Prisma.PrismaClientKnownRequestError ? "DATABASE_REQUEST"
    : error instanceof Prisma.PrismaClientValidationError ? "DATABASE_VALIDATION"
    : error instanceof Prisma.PrismaClientInitializationError ? "DATABASE_UNAVAILABLE"
    : "INTERNAL";
  const kode = error instanceof Prisma.PrismaClientKnownRequestError && /^P\d{4}$/.test(error.code)
    ? error.code : undefined;
  console.error({ kejadian: "REQUEST_GAGAL", kategori, ...(kode ? { kode } : {}) });

  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ pesan: "JSON request tidak valid" });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return res.status(409).json({ pesan: "Data unik sudah digunakan" });
    }
    if (error.code === "P2003") {
      return res.status(409).json({ pesan: "Data masih digunakan oleh data lain" });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ pesan: "Data tidak ditemukan" });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ pesan: "Parameter request tidak valid" });
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return res.status(503).json({ pesan: "Database tidak dapat dihubungi" });
  }

  return res.status(500).json({ pesan: "Terjadi kesalahan pada server" });
};
