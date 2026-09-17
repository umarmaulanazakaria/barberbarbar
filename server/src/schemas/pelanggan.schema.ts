import { z } from "zod";

export const skemaTambahPelanggan = z.object({
  nama: z.string().min(1, { message: "Nama pelanggan harus diisi" }),
  nomorTelepon: z
    .string()
    .min(1, { message: "Nomor telepon pelanggan harus diisi" }),
  alamat: z.string().optional(),
});

export const skemaUbahPelanggan = skemaTambahPelanggan.partial();
