import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { KesalahanMidtrans } from "../lib/midtrans.js";
import { KesalahanPembayaranBooking } from "../services/pembayaran-booking.service.js";
import { skemaBayarOperasional, daftarPembayaranOperasional, buatPembayaranOperasional, sinkronPembayaranOperasional, webhookPembayaranOperasional } from "../services/pembayaran-operasional.service.js";

const id = (nilai: unknown) => { const p = z.coerce.number().int().positive().max(2147483647).safeParse(nilai); if (!p.success) throw new KesalahanPembayaranBooking(400, "ID tidak valid"); return p.data; };
const bungkus = (kerja: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  try { res.json(await kerja(req)); }
  catch (e) {
    if (e instanceof KesalahanPembayaranBooking || e instanceof KesalahanMidtrans) return res.status(e.kode).json({ pesan: e.message, ...(e.message.startsWith("Kunci pembayaran") ? { kode: "IDEMPOTENSI_BERBEDA" } : {}) });
    // Tidak mencetak objek SDK/Prisma/payload pembayaran atau credential.
    res.status(503).json({ pesan: "Hasil pembayaran belum dapat dipastikan. Periksa transaksi yang sama sebelum mencoba kembali." });
  }
};
const router = Router();
router.get("/:id", bungkus(req => daftarPembayaranOperasional(id(req.params.id))));
router.post("/:id", bungkus(req => {
  if (!req.pengguna) throw new KesalahanPembayaranBooking(401, "Operator belum login");
  const p = skemaBayarOperasional.safeParse(req.body);
  if (!p.success) throw new KesalahanPembayaranBooking(400, "Konfirmasi dana, referensi transfer, dan data pembayaran tidak valid");
  return buatPembayaranOperasional(id(req.params.id), req.pengguna.id, p.data);
}));
router.post("/:id/:transaksiId/sync", bungkus(req => {
  if (!z.object({}).strict().safeParse(req.body ?? {}).success) throw new KesalahanPembayaranBooking(400, "Data rekonsiliasi tidak valid");
  return sinkronPembayaranOperasional(id(req.params.id), id(req.params.transaksiId));
}));
export const routerNotifikasiOperasional = Router();
routerNotifikasiOperasional.post("/notifications", (req: Request, res: Response, next: NextFunction) => {
  const body: unknown = req.body;
  if (!body || typeof body !== "object" || !("order_id" in body) || typeof body.order_id !== "string" || !body.order_id.startsWith("BBOPS-")) return next();
  return bungkus(r => webhookPembayaranOperasional(r.body))(req, res);
});
export default router;
