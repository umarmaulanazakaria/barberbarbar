import { z } from "zod";
export const skemaKunciPembayaranBooking = z.object({ kunciIdempotensi: z.string().trim().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/) }).strict();
export const skemaPelunasanBooking = skemaKunciPembayaranBooking.extend({
  metode: z.enum(["CASH", "QRIS", "CARD", "TRANSFER", "OTHER"]),
  jumlahDiterima: z.number().int().nonnegative().max(2_147_483_647),
  catatan: z.string().trim().max(500).optional(),
}).strict();
