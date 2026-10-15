import { z } from "zod";

export const skemaRegistrasiPelanggan = z.object({
  nama: z.string().trim().min(2).max(100),

  nomorTelepon: z
    .string()
    .trim()
    .regex(/^08[0-9]{8,11}$/, "Nomor telepon tidak valid"),

  email: z.email("Email tidak valid").trim().toLowerCase(),

  password: z.string().min(8).max(72).refine(
    (password) => Buffer.byteLength(password, "utf8") <= 72,
    "Password maksimal 72 byte",
  ),

  alamat: z.string().trim().max(500).optional(),
});

export type DataRegistrasiPelanggan = z.infer<typeof skemaRegistrasiPelanggan>;

export const skemaLoginPelanggan = z.object({
  identitas: z.string().trim().min(1, "Email atau nomor telepon wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type DataLoginPelanggan = z.infer<typeof skemaLoginPelanggan>;

export const skemaUbahProfilPelanggan = z
  .object({
    nama: z.string().trim().min(2).max(100).optional(),
    alamat: z.string().trim().max(500).nullable().optional(),
    email: skemaRegistrasiPelanggan.shape.email.optional(),
    nomorTelepon: skemaRegistrasiPelanggan.shape.nomorTelepon.optional(),
    passwordBaru: skemaRegistrasiPelanggan.shape.password.optional(),
    passwordSaatIni: z.string().min(1).max(72).refine(p => Buffer.byteLength(p, "utf8") <= 72, "Kata sandi tidak valid").optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).some(k => k !== "passwordSaatIni"),
    "Minimal satu data profil harus diisi",
  )
  .superRefine((data, konteks) => {
    if ((data.email !== undefined || data.nomorTelepon !== undefined || data.passwordBaru !== undefined) && !data.passwordSaatIni) {
      konteks.addIssue({ code: "custom", path: ["passwordSaatIni"], message: "Kata sandi saat ini wajib diisi" });
    }
  });

export type DataUbahProfilPelanggan = z.infer<typeof skemaUbahProfilPelanggan>;
