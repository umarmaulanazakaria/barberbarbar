import type { Request, Response } from "express";
import {
  ambilDataSemuaPelanggan,
  tambahDataPelanggan,
  ambilDataPelangganBerdasarkanId,
  ubahDataPelanggan,
  hapusDataPelanggan,
  ambilDataPelangganBerdasarkanNomorTelepon,
  blokirDataPelanggan,
  bukaBlokirDataPelanggan,
} from "../services/pelanggan.service.js";
import {
  skemaTambahPelanggan,
  skemaUbahPelanggan,
} from "../schemas/pelanggan.schema.js";

export const ambilSemuaPelanggan = async (_req: Request, res: Response) =>
  res.json(await ambilDataSemuaPelanggan());

export const tambahPelanggan = async (req: Request, res: Response) => {
  const validasi = skemaTambahPelanggan.safeParse(req.body);
  if (!validasi.success)
    return res.status(400).json({
      pesan: "Data pelanggan tidak valid",
      kesalahan: validasi.error.issues,
    });
  const data = await tambahDataPelanggan(validasi.data);
  if (!data)
    return res.status(409).json({ pesan: "Nomor telepon sudah digunakan" });
  return res.status(201).json(data);
};

export const ambilPelangganBerdasarkanId = async (
  req: Request,
  res: Response,
) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id))
    return res.status(400).json({ pesan: "ID pelanggan tidak valid" });
  const data = await ambilDataPelangganBerdasarkanId(id);
  if (!data)
    return res.status(404).json({ pesan: "Pelanggan tidak ditemukan" });
  return res.json(data);
};

//video

export const ubahPelanggan = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id))
    return res.status(400).json({ pesan: "ID pelanggan tidak valid" });
  const validasi = skemaUbahPelanggan.safeParse(req.body);
  if (!validasi.success)
    return res.status(400).json({
      pesan: "Data pelanggan tidak valid",
      kesalahan: validasi.error.issues,
    });
  const pelangganSaatIni = await ambilDataPelangganBerdasarkanId(id);
  if (!pelangganSaatIni)
    return res.status(404).json({ pesan: "Pelanggan tidak ditemukan" });
  if (
    pelangganSaatIni.status === "DIBLOKIR" &&
    validasi.data.nomorTelepon !== undefined &&
    validasi.data.nomorTelepon !== pelangganSaatIni.nomorTelepon
  ) {
    return res.status(409).json({
      pesan: "Nomor telepon pelanggan yang diblokir tidak dapat diubah",
    });
  }
  if (validasi.data.nomorTelepon !== undefined) {
    const sama = await ambilDataPelangganBerdasarkanNomorTelepon(
      validasi.data.nomorTelepon,
    );
    if (sama && sama.id !== id)
      return res.status(409).json({ pesan: "Nomor telepon sudah digunakan" });
  }
  const data = await ubahDataPelanggan(id, validasi.data);
  if (!data)
    return res.status(404).json({ pesan: "Pelanggan tidak ditemukan" });
  return res.json(data);
};

export const hapusPelanggan = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id))
    return res.status(400).json({ pesan: "ID pelanggan tidak valid" });
  const hasil = await hapusDataPelanggan(id);
  if (!hasil.berhasil) {
    const pesan = {
      TIDAK_DITEMUKAN: "Pelanggan tidak ditemukan",
      DIBLOKIR: "Pelanggan diblokir dan tidak dapat dihapus",
      PUNYA_RIWAYAT:
        "Pelanggan memiliki riwayat pesanan dan tidak dapat dihapus",
    }[hasil.alasan];
    return res
      .status(hasil.alasan === "TIDAK_DITEMUKAN" ? 404 : 409)
      .json({ pesan });
  }
  return res.json({ pesan: "Pelanggan berhasil dihapus" });
};

export const blokirPelanggan = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id))
    return res.status(400).json({ pesan: "ID pelanggan tidak valid" });
  const data = await blokirDataPelanggan(id);
  if (!data)
    return res.status(404).json({ pesan: "Pelanggan tidak ditemukan" });
  return res.json({ pesan: "Pelanggan berhasil diblokir", data });
};

export const bukaBlokirPelanggan = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id))
    return res.status(400).json({ pesan: "ID pelanggan tidak valid" });
  const data = await bukaBlokirDataPelanggan(id);
  if (!data)
    return res.status(404).json({ pesan: "Pelanggan tidak ditemukan" });
  return res.json({ pesan: "Blokir pelanggan berhasil dibuka", data });
};
