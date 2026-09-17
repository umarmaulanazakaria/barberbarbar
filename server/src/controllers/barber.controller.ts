import type { Request, Response } from "express";

import {
  ambilSemuaBarber,
  ambilSemuaBarberDenganAkun,
  ambilBarberBerdasarkanId,
  tambahBarber,
  ubahBarber,
  hapusBarber,
  buatAkunBarber,
} from "../services/barber.service.js";

import {
  skemaTambahBarber,
  skemaUbahBarber,
  skemaBuatAkunBarber,
} from "../schemas/barber.schema.js";

export const ambilSemua = async (_req: Request, res: Response) =>
  res.json(await ambilSemuaBarber());

export const ambilSemuaDenganAkun = async (_req: Request, res: Response) =>
  res.json(await ambilSemuaBarberDenganAkun());

export const ambilBerdasarkanId = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({
      pesan: "ID barber tidak valid",
    });
  }

  const data = await ambilBarberBerdasarkanId(id);

  if (!data) {
    return res.status(404).json({
      pesan: "Barber tidak ditemukan",
    });
  }

  return res.json(data);
};

export const tambah = async (req: Request, res: Response) => {
  const validasi = skemaTambahBarber.safeParse(req.body);

  if (!validasi.success) {
    return res.status(400).json({
      pesan: "Data barber tidak valid",
      kesalahan: validasi.error.issues,
    });
  }

  const hasil = await tambahBarber(validasi.data);

  if (!hasil.berhasil) {
    return res.status(409).json({
      pesan: "Nomor telepon sudah digunakan",
    });
  }

  return res.status(201).json({
    pesan: "Barber berhasil ditambahkan",
    data: hasil.data,
  });
};

export const ubah = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({
      pesan: "ID barber tidak valid",
    });
  }

  const validasi = skemaUbahBarber.safeParse(req.body);

  if (!validasi.success) {
    return res.status(400).json({
      pesan: "Data barber tidak valid",
      kesalahan: validasi.error.issues,
    });
  }

  const hasil = await ubahBarber(id, validasi.data);

  if (!hasil.berhasil) {
    return res.status(hasil.alasan === "TIDAK_DITEMUKAN" ? 404 : 409).json({
      pesan:
        hasil.alasan === "TIDAK_DITEMUKAN"
          ? "Barber tidak ditemukan"
          : "Nomor telepon sudah digunakan",
    });
  }

  return res.json({
    pesan: "Barber berhasil diubah",
    data: hasil.data,
  });
};

export const hapus = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({
      pesan: "ID barber tidak valid",
    });
  }

  const hasil = await hapusBarber(id);

  if (!hasil.berhasil) {
    return res.status(hasil.alasan === "TIDAK_DITEMUKAN" ? 404 : 409).json({
      pesan:
        hasil.alasan === "TIDAK_DITEMUKAN"
          ? "Barber tidak ditemukan"
          : "Barber memiliki riwayat pesanan; nonaktifkan saja",
    });
  }

  return res.json({
    pesan: "Barber berhasil dihapus",
  });
};

export const buatAkun = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({
      pesan: "ID barber tidak valid",
    });
  }

  const validasi = skemaBuatAkunBarber.safeParse(req.body);

  if (!validasi.success) {
    return res.status(400).json({
      pesan: "Data akun staff tidak valid",
      kesalahan: validasi.error.issues,
    });
  }

  const hasil = await buatAkunBarber(id, {
    email: validasi.data.email,

    password: validasi.data.password,
  });

  if (!hasil.berhasil) {
    if (hasil.alasan === "TIDAK_DITEMUKAN") {
      return res.status(404).json({
        pesan: "Barber tidak ditemukan",
      });
    }

    if (hasil.alasan === "BARBER_TIDAK_AKTIF") {
      return res.status(409).json({
        pesan: "Akun hanya dapat dibuat untuk barber yang aktif",
      });
    }

    if (hasil.alasan === "SUDAH_PUNYA_AKUN") {
      return res.status(409).json({
        pesan: "Barber ini sudah memiliki akun staff",
      });
    }

    return res.status(409).json({
      pesan: "Email sudah digunakan",
    });
  }

  return res.status(201).json({
    pesan: "Akun staff berhasil dibuat",
    data: hasil.data,
  });
};
