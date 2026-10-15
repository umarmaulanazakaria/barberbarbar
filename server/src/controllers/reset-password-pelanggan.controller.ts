import type { Request, Response } from "express";
import {
  skemaLupaPasswordPelanggan,
  skemaResetPasswordPelanggan,
} from "../schemas/reset-password-pelanggan.schema.js";
import {
  resetPasswordPelanggan,
} from "../services/reset-password-pelanggan.service.js";
import { ajukanEmailReset, emailResetTersedia } from "../services/email-reset-pelanggan.service.js";

export const lupaPasswordPelanggan = async (permintaan: Request, respon: Response) => {
  const validasi = skemaLupaPasswordPelanggan.safeParse(permintaan.body);
  if (!validasi.success) {
    return respon.status(400).json({ pesan: "Email tidak valid" });
  }
  // Pengiriman terpisah dari respons; latensi provider tidak membocorkan akun.
  ajukanEmailReset(validasi.data.email);
  return respon.status(200).json({
    pesan: "Jika email terdaftar, permintaan reset password akan diproses",
    pengirimanTersedia: emailResetTersedia(),
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
