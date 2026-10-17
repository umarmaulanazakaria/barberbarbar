import { Router } from "express";
import { z } from "zod";
import { hanyaAdmin } from "../middleware/role.middleware.js";
import { KesalahanProfil } from "../services/profil-pelanggan.service.js";
import { KesalahanMidtrans } from "../lib/midtrans.js";
import { daftarMember, detailMember, paketMembership, ubahPaketMembership, skemaPenjualan, jualMembership, sinkronMembership, notifikasiMembership } from "../services/penjualan-membership.service.js";
const router = Router();
const baca = <T>(skema: z.ZodType<T>, nilai: unknown) => { const p = skema.safeParse(nilai); if (!p.success) throw new KesalahanProfil(400, "Data Membership tidak valid. Periksa identitas, harga, dan konfirmasi dana."); return p.data; };
const id = (v: unknown) => baca(z.coerce.number().int().positive().max(2147483647), v);
const tangani: import("express").ErrorRequestHandler = (e: unknown, _req, res, _next) => {
  if (e instanceof KesalahanProfil) return res.status(e.status).json({ pesan: e.message, kandidat: e.kandidat });
  if (e instanceof KesalahanMidtrans) return res.status(e.kode).json({ pesan: e.message });
  return res.status(503).json({ pesan: "Operasi Membership belum dapat dipastikan. Periksa transaksi yang sama sebelum mengirim ulang." });
};
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.get("/package", async (_req, res) => res.json(await paketMembership()));
router.put("/package", hanyaAdmin, async (req, res) => { const d = baca(z.object({ harga: z.number().int().positive().max(2147483647), layananGratisId: z.number().int().positive() }).strict(), req.body); res.json(await ubahPaketMembership(d.harga, d.layananGratisId, req.pengguna!.id)); });
router.get("/", async (req, res) => { const d = baca(z.object({ cari: z.string().trim().max(100).default(""), status: z.enum(["SEMUA", "AKTIF", "KEDALUWARSA", "BELUM_AKTIF", "MENUNGGU_PEMBAYARAN"]).default("SEMUA"), halaman: z.coerce.number().int().min(1).max(100000).default(1) }).strict(), req.query); res.json(await daftarMember(d.cari, d.status, d.halaman)); });
router.post("/sales", hanyaAdmin, async (req, res) => res.json(await jualMembership(baca(skemaPenjualan, req.body), req.pengguna!.id)));
router.post("/sales/:id/sync", hanyaAdmin, async (req, res) => { baca(z.object({}).strict(), req.body); res.json(await sinkronMembership(id(req.params.id))); });
router.get("/:id", async (req, res) => res.json(await detailMember(id(req.params.id))));
router.use(tangani);
export const routerNotifikasiMembership = Router();
routerNotifikasiMembership.post("/notifications", async (req, res, next) => {
  if (typeof req.body?.order_id !== "string" || !req.body.order_id.startsWith("BBMEM-")) return next();
  try { res.json(await notifikasiMembership(req.body)); } catch (e) { tangani(e, req, res, next); }
});
export default router;
