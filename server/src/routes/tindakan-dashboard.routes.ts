import { Router } from "express";
import { z } from "zod";
import basisData from "../lib/prisma.js";
import { KesalahanMidtrans } from "../lib/midtrans.js";
import { buatPemeriksaanPembayaran } from "../lib/pemeriksaan-pembayaran.js";
import { KesalahanPembayaranBooking } from "../services/pembayaran-booking.service.js";
import { KesalahanOperasionalBooking, mulaiLayananBooking } from "../services/operasional-booking.service.js";
import { sinkronkanDpUntukDeadline } from "../services/midtrans-booking.service.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";

const router = Router();
const skemaId = z.coerce.number().int().positive().max(2147483647);
const id = (nilai: unknown) => { const p = skemaId.safeParse(nilai); if (!p.success) throw new KesalahanPembayaranBooking(400, "ID tidak valid"); return p.data; };
export const konteksDpDashboard = (bookingId: number) => basisData.$transaction(async tx => {
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  const b = await tx.booking.findUnique({ where: { id: bookingId } });
  if (!b) throw new KesalahanPembayaranBooking(404, "Booking tidak ditemukan");
  const sekarang = await waktuDatabaseBooking(tx);
  const t = await tx.transaksiPembayaranBooking.findFirst({ where: { bookingId, tujuan: "DP", kanal: "MIDTRANS",
    roundKonfirmasiPada: b.sumberBooking === "TAMU" ? b.dibuatPada : b.dikonfirmasiPada }, include: { snap: true }, orderBy: { id: "desc" } });
  let urlPembayaran: string | null = null;
  if (["AWAITING_DP", "CONFIRMED"].includes(b.status) && b.deadlineDp && b.deadlineDp > sekarang && t?.status === "PENDING" && t.snap?.status === "READY" && t.snap.urlSnap) {
    const u = new URL(t.snap.urlSnap);
    if (u.protocol === "https:" && u.hostname === "app.sandbox.midtrans.com" && !u.username && !u.password && u.pathname.startsWith("/snap/")) urlPembayaran = u.href;
  }
  return { dp: { nominal: b.nominalDp, deadline: b.deadlineDp, statusProvider: t?.statusProvider ?? t?.status ?? "BELUM_ADA_TRANSAKSI", urlPembayaran }, serverTime: sekarang };
}, { isolationLevel: "RepeatableRead" });
const periksa = buatPemeriksaanPembayaran<unknown>();
router.get("/BOOKING/:id/context", async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  try { res.json(await konteksDpDashboard(id(req.params.id))); } catch (e) { next(e); }
});
router.post("/BOOKING/:id/sync-dp", async (req, res, next) => {
  try {
    if (!z.object({}).strict().safeParse(req.body ?? {}).success) throw new KesalahanPembayaranBooking(400, "Data tidak valid");
    const bookingId = id(req.params.id), transaksi = await basisData.transaksiPembayaranBooking.findMany({ where: { bookingId, tujuan: "DP", status: "PENDING", kanal: "MIDTRANS" }, select: { id: true } });
    for (const t of transaksi) await periksa(t.id, () => sinkronkanDpUntukDeadline(t.id));
    res.json({ pesan: "Status DP diperiksa melalui Midtrans" });
  } catch (e) { next(e); }
});
router.post("/BOOKING/:id/start", async (req, res, next) => {
  try {
    const p = z.object({ barberId: z.number().int().positive() }).strict().safeParse(req.body);
    if (!p.success || !req.pengguna) throw new KesalahanPembayaranBooking(400, "Barber wajib dipilih");
    const booking = await mulaiLayananBooking(id(req.params.id), p.data.barberId, req.pengguna.id, req.pengguna.role === "ADMIN");
    res.json({ booking });
  } catch (e) { next(e); }
});
router.use((e: unknown, _req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
  if (e instanceof KesalahanPembayaranBooking || e instanceof KesalahanOperasionalBooking || e instanceof KesalahanMidtrans) return res.status(e.kode).json({ pesan: e.message });
  next(e);
});
export default router;
