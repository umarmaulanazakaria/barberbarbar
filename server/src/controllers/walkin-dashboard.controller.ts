import type { Request, Response } from "express";
import { z } from "zod";
import { skemaWalkIn } from "../schemas/walkin-dashboard.schema.js";
import { KesalahanWalkIn, simpanWalkInDashboard, periksaPermintaanWalkIn } from "../services/walkin-dashboard.service.js";

export const tambahWalkInDashboard = async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  if (!req.pengguna) return res.status(401).json({ pesan: "Pengguna belum login" });
  const valid = skemaWalkIn.safeParse(req.body);
  if (!valid.success) return res.status(400).json({ pesan: "Data walk-in tidak valid. Periksa pelanggan, layanan, dan nomor HP.", kesalahan: valid.error.issues });
  try {
    const hasil = await simpanWalkInDashboard(valid.data, req.pengguna.id);
    return res.status(hasil.diulang ? 200 : 201).json({ pesan: "Pesanan tercatat", ...hasil });
  } catch (error) {
    if (error instanceof KesalahanWalkIn) return res.status(error.status).json({ pesan: error.message, kode: error.kode });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return res.status(409).json({ pesan: "Data sudah digunakan. Periksa pelanggan atau status permintaan.", kode: "DATA_TERPAKAI" });
    throw error;
  }
};
export const statusWalkInDashboard = async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  if (!req.pengguna) return res.status(401).json({ pesan: "Pengguna belum login" });
  const kunci = z.string().uuid().safeParse(req.params.kunci);
  if (!kunci.success) return res.status(400).json({ pesan: "Kunci permintaan tidak valid" });
  const hasil = await periksaPermintaanWalkIn(kunci.data, req.pengguna.id);
  return hasil ? res.json({ pesan: "Pesanan tercatat", ...hasil }) : res.status(404).json({ pesan: "Belum ada konfirmasi pesanan. Jangan mengganti kunci permintaan." });
};
