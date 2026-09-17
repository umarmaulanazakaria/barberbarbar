import type { Request, Response } from "express";

import {
  buatPenggunaBaru,
  loginPengguna,
  ambilPenggunaBerdasarkanId,
} from "../services/auth.service.js";

import {
  skemaRegistrasi,
  skemaLogin,
} from "../schemas/auth.schema.js";

export const registrasi = async (
  permintaan: Request,
  respon: Response,
) => {
  const hasilValidasi = skemaRegistrasi.safeParse(
    permintaan.body,
  );

  if (!hasilValidasi.success) {
    return respon.status(400).json({
      pesan: "Data pengguna tidak valid",
      kesalahan: hasilValidasi.error.issues,
    });
  }

  const { name, email, password } = hasilValidasi.data;

  const penggunaBaru = await buatPenggunaBaru({
    name,
    email,
    password,
  });

  if (!penggunaBaru) {
    return respon.status(409).json({
      pesan: "Email sudah digunakan",
    });
  }

  return respon.status(201).json({
    pesan: "Pengguna berhasil didaftarkan",
  });
};

export const login = async (
  permintaan: Request,
  respon: Response,
) => {
  const hasilValidasi = skemaLogin.safeParse(
    permintaan.body,
  );

  if (!hasilValidasi.success) {
    return respon.status(400).json({
      pesan: "Data login tidak valid",
      kesalahan: hasilValidasi.error.issues,
    });
  }

  const { email, password } = hasilValidasi.data;

  const penggunaLogin = await loginPengguna({
    email,
    password,
  });

  if (!penggunaLogin) {
    return respon.status(401).json({
      pesan: "Email atau password salah",
    });
  }

  return respon.status(200).json({
    pesan: "Login berhasil",
    pengguna: {
      id: penggunaLogin.pengguna.id,
      name: penggunaLogin.pengguna.name,
      email: penggunaLogin.pengguna.email,
      role: penggunaLogin.pengguna.role,
    },
    token: penggunaLogin.token,
  });
};

export const profilSaya = async (
  permintaan: Request,
  respon: Response,
) => {
  if (!permintaan.pengguna) {
    return respon.status(401).json({
      pesan: "Pengguna belum login",
    });
  }

  const pengguna =
    await ambilPenggunaBerdasarkanId(
      permintaan.pengguna.id,
    );

  if (!pengguna) {
    return respon.status(404).json({
      pesan: "Pengguna tidak ditemukan",
    });
  }

  return respon.status(200).json({
    pengguna,
  });
};