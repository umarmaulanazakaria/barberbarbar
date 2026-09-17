import { z } from "zod";

export const skemaTambahLayanan = z.object({
  nama: z.string().min(1, {
    message: "Nama layanan tidak boleh kosong",
  }),

  durasiMenit: z.number().int().positive({
    message: "Durasi harus lebih dari 0 menit",
  }),

  harga: z.number().int().positive({
    message: "Harga harus lebih dari 0",
  }),

  aktif: z.boolean().optional(),
});

export const skemaUbahLayanan = skemaTambahLayanan.partial();