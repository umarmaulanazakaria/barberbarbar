import type { Prisma } from "../generated/prisma/client.js";

// Satu Booking/pesanan baru memakai satu slot, tidak dikalikan layanan atau qty.
export const slotLayananMenit = 45;
export const snapshotSlotLayanan = (snapshot?: Prisma.JsonValue): Prisma.InputJsonObject => ({
  ...(snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : {}),
  slotJadwalMenit: slotLayananMenit,
});
export const memilikiSlotLayanan = (snapshot: Prisma.JsonValue | null | undefined) =>
  !!snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) && snapshot.slotJadwalMenit === slotLayananMenit;
export const durasiPesanan = (snapshot: Prisma.JsonValue | null | undefined, items: { durasiMenit: number; qty: number }[]) =>
  memilikiSlotLayanan(snapshot) ? slotLayananMenit : items.reduce((n, i) => n + i.durasiMenit * i.qty, 0);
