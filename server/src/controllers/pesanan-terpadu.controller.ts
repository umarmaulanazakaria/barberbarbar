import type { Request, Response } from "express";
import { daftarPesananTerpadu, skemaDaftarTerpadu } from "../services/pesanan-terpadu.service.js";
export const pesananTerpadu = async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const data = skemaDaftarTerpadu.safeParse(req.query);
  if (!data.success) return res.status(400).json({ pesan: "Filter pesanan tidak valid. Periksa tanggal dan halaman." });
  return res.json(await daftarPesananTerpadu(data.data));
};
