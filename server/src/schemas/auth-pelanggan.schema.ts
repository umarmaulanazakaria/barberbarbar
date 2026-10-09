import { z } from "zod";

export const skemaRegistrasiPelanggan = z.object({
  nama: z.string().trim().min(2).max(100),

  nomorTelepon: z
    .string()
    .trim()
    .regex(/^08[0-9]{8,11}$/, "Nomor telepon tidak valid"),

  email: z.email("Email tidak valid").trim().toLowerCase(),

  password: z.string().min(8).max(72),

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
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Minimal satu data profil harus diisi",
  );

export type DataUbahProfilPelanggan = z.infer<typeof skemaUbahProfilPelanggan>;
