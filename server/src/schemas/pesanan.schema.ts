import { z } from "zod";

export const skemaTambahPesanan = z.object({
  pelangganId: z.number().int().positive(),
  barberId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        layananId: z.number().int().positive(),
        qty: z.number().int().positive().max(20).default(1),
      }),
    )
    .min(1, { message: "Minimal satu layanan harus dipilih" }),
  catatan: z.string().max(500).optional(),
});

export const skemaUbahStatusPesanan = z.object({
  status: z.enum(["WAITING", "IN_SERVICE", "COMPLETED", "CANCELLED"]),
});

export const skemaPembayaran = z.object({
  metode: z.enum(["CASH", "QRIS", "CARD", "TRANSFER", "OTHER"]),
  jumlahDiterima: z.number().int().nonnegative(),
  catatan: z.string().max(500).optional(),
});
