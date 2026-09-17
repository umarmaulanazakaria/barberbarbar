import type { Request, Response } from "express";
import {
  ambilSemuaMembership,
  ambilMembershipBerdasarkanId,
  tambahMembership,
  ubahMembership,
  hapusMembership,
} from "../services/membership.service.js";
import {
  skemaTambahMembership,
  skemaUbahMembership,
} from "../schemas/membership.schema.js";

export const ambilSemua = async (_req: Request, res: Response) => {
  return res.json(await ambilSemuaMembership());
};

export const ambilBerdasarkanId = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ pesan: "ID membership tidak valid" });
  const data = await ambilMembershipBerdasarkanId(id);
  if (!data) return res.status(404).json({ pesan: "Membership tidak ditemukan" });
  return res.json(data);
};

export const tambah = async (req: Request, res: Response) => {
  const validasi = skemaTambahMembership.safeParse(req.body);
  if (!validasi.success) return res.status(400).json({ pesan: "Data membership tidak valid", kesalahan: validasi.error.issues });
  const hasil = await tambahMembership(validasi.data);
  if (!hasil.berhasil) {
    const pesan = {
      PELANGGAN_TIDAK_DITEMUKAN: "Pelanggan tidak ditemukan",
      PELANGGAN_DIBLOKIR: "Pelanggan diblokir dan tidak dapat menjadi member",
      SUDAH_MEMBER: "Pelanggan sudah memiliki membership",
    }[hasil.alasan];
    return res.status(hasil.alasan === "PELANGGAN_TIDAK_DITEMUKAN" ? 404 : 409).json({ pesan });
  }
  return res.status(201).json({ pesan: "Membership berhasil dibuat", data: hasil.data });
};

export const ubah = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ pesan: "ID membership tidak valid" });
  const validasi = skemaUbahMembership.safeParse(req.body);
  if (!validasi.success) return res.status(400).json({ pesan: "Data membership tidak valid", kesalahan: validasi.error.issues });
  const hasil = await ubahMembership(id, validasi.data);
  if (!hasil.berhasil) {
    return res.status(404).json({ pesan: "Membership tidak ditemukan" });
  }
  return res.json({ pesan: "Membership berhasil diubah", data: hasil.data });
};

export const hapus = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ pesan: "ID membership tidak valid" });
  const data = await hapusMembership(id);
  if (!data) return res.status(404).json({ pesan: "Membership tidak ditemukan" });
  return res.json({ pesan: "Membership berhasil dihapus" });
};
