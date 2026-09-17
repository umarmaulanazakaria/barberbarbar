import { z } from "zod";

export const skemaTambahBarber = z.object({
  nama: z.string().min(1, {
    message: "Nama barber tidak boleh kosong",
  }),

  nomorTelepon: z
    .string()
    .min(1, {
      message: "Nomor telepon tidak boleh kosong",
    })
    .optional(),

  aktif: z.boolean().optional(),
});

export const skemaUbahBarber = skemaTambahBarber.partial();

export const skemaBuatAkunBarber = z
  .object({
    email: z.string().email({
      message: "Email tidak valid",
    }),

    password: z.string().min(6, {
      message: "Password minimal 6 karakter",
    }),

    confirmPassword: z.string().min(6, {
      message: "Konfirmasi password minimal 6 karakter",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password dan konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });
