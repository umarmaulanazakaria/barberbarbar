import type { Request, Response } from "express";
import { daftarRiwayatPesanan, detailRiwayatPesanan, skemaRiwayatPesanan, skemaDetailRiwayat } from "../services/riwayat-pesanan.service.js";

export const daftarRiwayat = async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const filter = skemaRiwayatPesanan.safeParse(req.query);
  if (!filter.success) return res.status(400).json({ pesan: "Filter riwayat tidak valid. Periksa tanggal, status, dan halaman." });
  return res.json(await daftarRiwayatPesanan(filter.data));
};
export const detailRiwayat = async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const filter = skemaDetailRiwayat.safeParse(req.params);
  if (!filter.success) return res.status(400).json({ pesan: "Identitas arsip tidak valid." });
  const data = await detailRiwayatPesanan(filter.data.jenis, filter.data.id);
  return data ? res.json(data) : res.status(404).json({ pesan: "Arsip pesanan tidak ditemukan." });
};
