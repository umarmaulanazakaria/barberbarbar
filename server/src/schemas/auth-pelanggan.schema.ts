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
