import { z } from "zod";
import { skemaBuatBooking } from "./booking.schema.js";
export const skemaIdBooking = z.coerce.number().int().positive();
export const skemaKosongBooking = z.object({}).strict();
export const skemaTolakBooking = z.object({ alasan: z.string().trim().min(1).max(500) }).strict();
export const skemaUsulanBarber = z.object({ barberId: z.number().int().positive(), alasan: z.string().trim().min(1).max(500) }).strict();
export const skemaMulaiBooking = z.object({ barberId: z.number().int().positive() }).strict();
export const skemaRescheduleBooking = z.object({
  mulaiPada: z.iso.datetime({ offset: true }), barberPilihanId: z.number().int().positive().nullable().optional(),
  items: skemaBuatBooking.shape.items.optional(),
}).strict();
