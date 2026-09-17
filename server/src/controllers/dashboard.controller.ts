import type { Request, Response } from "express";
import { ambilDashboard, ambilLaporan } from "../services/dashboard.service.js";

export const dashboard = async (_req: Request, res: Response) => res.json(await ambilDashboard());

export const laporan = async (req: Request, res: Response) => {
  const mulai = typeof req.query.mulai === "string" && req.query.mulai ? new Date(`${req.query.mulai}T00:00:00.000`) : undefined;
  const selesai = typeof req.query.selesai === "string" && req.query.selesai ? new Date(`${req.query.selesai}T23:59:59.999`) : undefined;

  if ((mulai && Number.isNaN(mulai.getTime())) || (selesai && Number.isNaN(selesai.getTime()))) {
    return res.status(400).json({ pesan: "Format tanggal laporan tidak valid" });
  }

  if (mulai && selesai && mulai > selesai) {
    return res.status(400).json({ pesan: "Tanggal mulai tidak boleh melewati tanggal selesai" });
  }

  return res.json(await ambilLaporan(mulai, selesai));
};
