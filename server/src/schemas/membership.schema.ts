import { z } from "zod";

export const skemaTambahMembership = z.object({
  pelangganId: z.number().int().positive({
    message: "Pelanggan harus dipilih",
  }),
});

export const skemaUbahMembership = z.object({
  discountPercent: z.number().int().min(0).max(100).optional(),

  isActive: z.boolean().optional(),
});
