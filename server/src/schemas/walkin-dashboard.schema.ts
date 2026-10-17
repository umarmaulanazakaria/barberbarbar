import { z } from "zod";

export const normalisasiHpWalkIn = (nilai: string) => {
  const digit = nilai.replace(/[\s().+\-]/g, "");
  return digit.startsWith("62") ? `0${digit.slice(2)}` : digit;
};
const hp = z.string().trim().max(30).refine(v => !v || /^[+\d\s().-]+$/.test(v), "Nomor HP tidak valid")
  .transform(normalisasiHpWalkIn).refine(v => !v || /^08[0-9]{8,11}$/.test(v), "Nomor HP tidak valid");
export const skemaWalkIn = z.object({
  pelanggan: z.discriminatedUnion("jenis", [
    z.object({ jenis: z.literal("LAMA"), id: z.number().int().positive() }).strict(),
    z.object({ jenis: z.literal("BARU"), nama: z.string().trim().min(1).max(100), nomorTelepon: hp.optional() }).strict(),
  ]),
  items: z.array(z.object({ layananId: z.number().int().positive(), qty: z.literal(1), hargaDiharapkan: z.number().int().min(0).max(2147483647) }).strict()).min(1).max(50)
    .refine(items => new Set(items.map(i => i.layananId)).size === items.length, "Layanan tidak boleh berulang"),
  barberId: z.number().int().positive().nullable(),
  totalDiharapkan: z.number().int().min(0).max(2147483647),
  kunciIdempotensi: z.string().uuid(),
}).strict();
export type DataWalkIn = z.infer<typeof skemaWalkIn>;
