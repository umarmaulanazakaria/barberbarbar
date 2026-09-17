import { z } from "zod";

export const skemaLogin = z.object({
  email: z.string().email({
    message: "Email tidak valid",
  }),

  password: z.string().min(6, {
    message: "Password minimal 6 karakter",
  }),
});
