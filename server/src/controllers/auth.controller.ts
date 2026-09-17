import type { Request, Response } from "express";

import {
  loginPengguna,
  ambilPenggunaBerdasarkanId,
} from "../services/auth.service.js";

import { skemaLogin } from "../schemas/auth.schema.js";

export const login = async (permintaan: Request, respon: Response) => {
  const hasilValidasi = skemaLogin.safeParse(permintaan.body);

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
      pesan: "Email atau password salah, atau akun staff tidak aktif",
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

export const profilSaya = async (permintaan: Request, respon: Response) => {
  if (!permintaan.pengguna) {
    return respon.status(401).json({
      pesan: "Pengguna belum login",
    });
  }

  const pengguna = await ambilPenggunaBerdasarkanId(permintaan.pengguna.id);

  if (!pengguna) {
    return respon.status(404).json({
      pesan: "Pengguna tidak ditemukan",
    });
  }

  return respon.status(200).json({
    pengguna,
  });
};
