import type { Request, Response } from "express";
import {
  skemaLupaPasswordPelanggan,
  skemaResetPasswordPelanggan,
} from "../schemas/reset-password-pelanggan.schema.js";
import {
  buatTokenResetPelanggan,
  resetPasswordPelanggan,
} from "../services/reset-password-pelanggan.service.js";

export const lupaPasswordPelanggan = async (permintaan: Request, respon: Response) => {
  const validasi = skemaLupaPasswordPelanggan.safeParse(permintaan.body);
  if (!validasi.success) {
    return respon.status(400).json({ pesan: "Email tidak valid" });
  }
  await buatTokenResetPelanggan(validasi.data.email);
  // Fondasi saja: belum ada pengiriman email. Jangan membocorkan token/akun.
  return respon.status(200).json({
    pesan: "Jika email terdaftar, permintaan reset password akan diproses",
  });
};

export const aturUlangPasswordPelanggan = async (permintaan: Request, respon: Response) => {
  const validasi = skemaResetPasswordPelanggan.safeParse(permintaan.body);
  if (!validasi.success) {
    return respon.status(400).json({ pesan: "Data reset password tidak valid" });
  }
  const berhasil = await resetPasswordPelanggan(validasi.data.token, validasi.data.password);
  if (!berhasil) {
    return respon.status(400).json({ pesan: "Token reset tidak valid atau kedaluwarsa" });
  }
  return respon.status(200).json({ pesan: "Password pelanggan berhasil diubah" });
};
