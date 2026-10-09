import { z } from "zod";

export const skemaLupaPasswordPelanggan = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email tidak valid")),
});

export const skemaResetPasswordPelanggan = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().min(8).max(72).refine(
    (password) => Buffer.byteLength(password, "utf8") <= 72,
    "Password maksimal 72 byte",
  ),
});
