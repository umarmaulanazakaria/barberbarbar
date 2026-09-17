import type { Request, Response } from "express";
import {
  ambilSemuaPesanan,
  ambilPesananAktif,
  ambilRiwayatPesanan,
  ambilPesananBerdasarkanId,
  tambahPesanan,
  ubahStatusPesanan,
  bayarPesanan,
  ambilSemuaInvoice,
} from "../services/pesanan.service.js";
import {
  skemaTambahPesanan,
  skemaUbahStatusPesanan,
  skemaPembayaran,
} from "../schemas/pesanan.schema.js";

export const ambilSemua = async (_req: Request, res: Response) =>
  res.json(await ambilSemuaPesanan());
export const ambilAktif = async (_req: Request, res: Response) =>
  res.json(await ambilPesananAktif());
export const ambilRiwayat = async (_req: Request, res: Response) =>
  res.json(await ambilRiwayatPesanan());
export const ambilInvoice = async (_req: Request, res: Response) =>
  res.json(await ambilSemuaInvoice());

export const ambilBerdasarkanId = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id))
    return res.status(400).json({ pesan: "ID pesanan tidak valid" });
  const data = await ambilPesananBerdasarkanId(id);
  if (!data) return res.status(404).json({ pesan: "Pesanan tidak ditemukan" });
  return res.json(data);
};

export const tambah = async (req: Request, res: Response) => {
  if (!req.pengguna)
    return res.status(401).json({ pesan: "Pengguna belum login" });
  const validasi = skemaTambahPesanan.safeParse(req.body);
  if (!validasi.success)
    return res
      .status(400)
      .json({
        pesan: "Data pesanan tidak valid",
        kesalahan: validasi.error.issues,
      });
  const hasil = await tambahPesanan(validasi.data, req.pengguna.id);
  if (!hasil.berhasil) {
    const pesan: Record<string, string> = {
      PELANGGAN_TIDAK_DITEMUKAN: "Pelanggan tidak ditemukan",
      PELANGGAN_DIBLOKIR: "Pelanggan diblokir",
      BARBER_TIDAK_DITEMUKAN: "Barber tidak ditemukan",
      BARBER_TIDAK_AKTIF: "Barber tidak aktif",
      LAYANAN_TIDAK_DITEMUKAN: "Ada layanan yang tidak ditemukan",
      LAYANAN_TIDAK_AKTIF: "Ada layanan yang tidak aktif",
    };
    return res
      .status(hasil.alasan.includes("TIDAK_DITEMUKAN") ? 404 : 409)
      .json({ pesan: pesan[hasil.alasan] });
  }
  return res
    .status(201)
    .json({ pesan: "Pesanan berhasil dibuat", data: hasil.data });
};

export const ubahStatus = async (req: Request, res: Response) => {
  if (!req.pengguna)
    return res.status(401).json({ pesan: "Pengguna belum login" });
  const id = Number(req.params.id);
  if (Number.isNaN(id))
    return res.status(400).json({ pesan: "ID pesanan tidak valid" });
  const validasi = skemaUbahStatusPesanan.safeParse(req.body);
  if (!validasi.success)
    return res
      .status(400)
      .json({ pesan: "Status tidak valid", kesalahan: validasi.error.issues });
  const hasil = await ubahStatusPesanan(
    id,
    validasi.data.status,
    req.pengguna.id,
  );
  if (!hasil.berhasil)
    return res.status(hasil.alasan === "TIDAK_DITEMUKAN" ? 404 : 409).json({
      pesan:
        hasil.alasan === "TIDAK_DITEMUKAN"
          ? "Pesanan tidak ditemukan"
          : "Perubahan status tidak diperbolehkan",
    });
  return res.json({
    pesan: "Status pesanan berhasil diperbarui",
    data: hasil.data,
  });
};

export const bayar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id))
    return res.status(400).json({ pesan: "ID pesanan tidak valid" });
  const validasi = skemaPembayaran.safeParse(req.body);
  if (!validasi.success)
    return res
      .status(400)
      .json({
        pesan: "Data pembayaran tidak valid",
        kesalahan: validasi.error.issues,
      });
  const hasil = await bayarPesanan(id, validasi.data);
  if (!hasil.berhasil) {
    const pesan = {
      TIDAK_DITEMUKAN: "Pesanan tidak ditemukan",
      BELUM_SELESAI: "Pesanan harus selesai sebelum dibayar",
      SUDAH_DIBAYAR: "Pesanan sudah dibayar",
      JUMLAH_KURANG: "Jumlah pembayaran kurang dari total",
    }[hasil.alasan];
    return res
      .status(hasil.alasan === "TIDAK_DITEMUKAN" ? 404 : 409)
      .json({ pesan });
  }
  return res.json({ pesan: "Pembayaran berhasil", data: hasil.data });
};
