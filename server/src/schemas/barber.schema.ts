import { z } from "zod";

export const skemaTambahBarber = z.object({
  nama: z.string().min(1, {
    message: "Nama barber tidak boleh kosong",
  }),

  nomorTelepon: z.string().min(1, {
    message: "Nomor telepon tidak boleh kosong",
  }).optional(),

  aktif: z.boolean().optional(),
});

export const skemaUbahBarber = skemaTambahBarber.partial();