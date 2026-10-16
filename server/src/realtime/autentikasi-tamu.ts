import { verifikasiSesi } from "../services/tracking-booking.service.js";

export type IdentitasTamuRealtime = { tipe: "TAMU"; bookingId: number };

export const asalWebTamu = () => (process.env.GUEST_WEB_ORIGINS ??
  "http://localhost:5175,http://127.0.0.1:5175").split(",").map(s => s.trim()).filter(Boolean);

export const tokenCookieTamu = (cookie: string | undefined) => {
  const nilai = cookie?.split(";").map(s => s.trim()).filter(s => s.startsWith("bb_guest_session=")) ?? [];
  if (nilai.length !== 1) throw new Error("AKSES_DITOLAK");
  const token = nilai[0]!.slice("bb_guest_session=".length);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("AKSES_DITOLAK");
  return token;
};

export const verifikasiTamuRealtime = async (token: string, awal?: IdentitasTamuRealtime): Promise<IdentitasTamuRealtime> => {
  if (process.env.GUEST_BOOKING_ENABLED !== "true") throw new Error("AKSES_DITOLAK");
  const bookingId = await verifikasiSesi(token);
  if (awal && awal.bookingId !== bookingId) throw new Error("AKSES_DITOLAK");
  return { tipe: "TAMU", bookingId };
};
