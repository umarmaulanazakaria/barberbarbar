import { z } from "zod";

export const skemaRegistrasi = z.object({
  name: z.string().min(1, { message: "Nama tidak boleh kosong" }),
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(6, { message: "Password minimal 6 karakter" }),
  confirmPassword: z.string().min(6, { message: "Konfirmasi password minimal 6 karakter" }),
})

.refine((data) => data.password === data.confirmPassword, {
  message: "Password dan konfirmasi password tidak cocok",
  path: ["confirmPassword"],
});

export const skemaLogin = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(6, { message: "Password minimal 6 karakter" }),
});