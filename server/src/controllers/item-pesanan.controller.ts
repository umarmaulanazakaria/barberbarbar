import type { Request, Response } from "express";
import {
  skemaTambahItemPesanan,
  skemaUbahItemPesanan,
} from "../schemas/item-pesanan.schema.js";
import {
  ambilItemBerdasarkanPesanan,
  tambahItemPesanan,
  ubahItemPesanan,
  hapusItemPesanan,
} from "../services/item-pesanan.service.js";

const gagal = (respon: Response, alasan: string) =>
  respon
    .status(alasan.includes("TIDAK_DITEMUKAN") ? 404 : 409)
    .json({
      pesan:
        {
          PESANAN_TIDAK_DITEMUKAN: "Pesanan tidak ditemukan",
          ITEM_TIDAK_DITEMUKAN: "Item tidak ditemukan",
          PESANAN_TIDAK_BISA_DIUBAH:
            "Item pesanan hanya dapat diubah sebelum pembayaran dilakukan",
          LAYANAN_TIDAK_VALID: "Layanan tidak tersedia",
          MINIMAL_SATU_ITEM: "Pesanan minimal memiliki satu item",
        }[alasan] ?? "Operasi gagal",
    });

export const ambilPerPesanan = async (req: Request, res: Response) => {
  const id = Number(req.params.orderId);
  if (Number.isNaN(id)) {
    return res.status(400).json({ pesan: "ID pesanan tidak valid" });
  }

  return res.json(await ambilItemBerdasarkanPesanan(id));
};

export const tambah = async (req: Request, res: Response) => {
  const validasi = skemaTambahItemPesanan.safeParse(req.body);

  if (!validasi.success) {
    return res.status(400).json({
      pesan: "Data item tidak valid",
      kesalahan: validasi.error.issues,
    });
  }

  const hasil = await tambahItemPesanan(validasi.data);
  if (!hasil.berhasil) return gagal(res, hasil.alasan);

  return res.status(201).json({
    pesan: "Item berhasil ditambahkan",
    data: hasil.data,
  });
};
// API/ORDER/:ID
export const ubah = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ pesan: "ID item tidak valid" });
  }

  const validasi = skemaUbahItemPesanan.safeParse(req.body);
  if (!validasi.success) {
    return res.status(400).json({
      pesan: "Data item tidak valid",
      kesalahan: validasi.error.issues,
    });
  }

  const hasil = await ubahItemPesanan(id, validasi.data);
  if (!hasil.berhasil) return gagal(res, hasil.alasan);

  return res.json({ pesan: "Item berhasil diubah", data: hasil.data });
};

export const hapus = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ pesan: "ID item tidak valid" });
  }

  const hasil = await hapusItemPesanan(id);
  if (!hasil.berhasil) return gagal(res, hasil.alasan);

  return res.json({ pesan: "Item berhasil dihapus" });
};
