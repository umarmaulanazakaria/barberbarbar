import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import basisData from "../lib/prisma.js";
import { sidikKredensialPelanggan } from "../lib/kredensial-pelanggan.js";

export type IdentitasRealtime = { tipe: "CUSTOMER"; id: number; pelangganId: number } |
  { tipe: "ADMIN" | "STAFF"; id: number; kredensial: string };
export const verifikasiIdentitasRealtime = async (token: unknown, awal?: IdentitasRealtime): Promise<IdentitasRealtime> => {
  if (typeof token !== "string" || token.length > 4096 || !process.env.JWT_SECRET) throw new Error("AKSES_DITOLAK");
  const data = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  if (typeof data === "string" || !Number.isSafeInteger(data.id) || data.id <= 0) throw new Error("AKSES_DITOLAK");
  if (data.tipe === "CUSTOMER" && data.role === undefined) {
    const akun = await basisData.akunPelanggan.findUnique({ where: { id: data.id },
      select: { id: true, pelangganId: true, passwordHash: true, pelanggan: { select: { status: true } } } });
    if (!akun || akun.pelanggan.status !== "AKTIF" || data.kredensial !== sidikKredensialPelanggan(akun.passwordHash, process.env.JWT_SECRET)) throw new Error("AKSES_DITOLAK");
    if (awal && (awal.tipe !== "CUSTOMER" || awal.id !== akun.id || awal.pelangganId !== akun.pelangganId)) throw new Error("AKSES_DITOLAK");
    return { tipe: "CUSTOMER", id: akun.id, pelangganId: akun.pelangganId };
  }
  if (data.tipe !== undefined || !["ADMIN","STAFF"].includes(data.role)) throw new Error("AKSES_DITOLAK");
  const akun = await basisData.pengguna.findUnique({ where: { id: data.id },
    select: { id: true, role: true, passwordHash: true, barber: { select: { aktif: true } } } });
  if (!akun || akun.role !== data.role || akun.role === "STAFF" && !akun.barber?.aktif) throw new Error("AKSES_DITOLAK");
  const kredensial = createHash("sha256").update(akun.passwordHash).digest("hex");
  if (awal && (awal.tipe === "CUSTOMER" || awal.id !== akun.id || awal.tipe !== akun.role || awal.kredensial !== kredensial)) throw new Error("AKSES_DITOLAK");
  return { tipe: akun.role, id: akun.id, kredensial };
};
