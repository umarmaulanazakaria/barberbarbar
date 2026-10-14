import { z } from "zod";

export const skemaBuatBooking = z.object({
  mulaiPada: z.iso.datetime({ offset: true }),
  barberPilihanId: z.number().int().positive().nullable().optional(),
  items: z.array(z.object({ layananId: z.number().int().positive(), qty: z.number().int().min(1).max(100) }).strict())
    .min(1).max(50).refine(items => new Set(items.map(item => item.layananId)).size === items.length,
      "Layanan sama harus digabung menggunakan qty"),
  catatan: z.string().trim().max(500).optional(),
}).strict();
export type DataBuatBooking = z.infer<typeof skemaBuatBooking>;
