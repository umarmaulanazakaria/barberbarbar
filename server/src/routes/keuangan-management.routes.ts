import { Router } from "express";
import { z } from "zod";
import { bacaKeuangan, laporanKeuangan } from "../services/dokumen-keuangan.service.js";
import { pdfKeuangan } from "../lib/pdf-keuangan.js";
import db from "../lib/prisma.js";
import { aturanJadwalBooking, zonaBooking } from "../lib/jadwal-booking.js";
import { kebijakanBookingTamu } from "../lib/kebijakan-booking-tamu.js";
import { slotLayananMenit } from "../lib/slot-layanan.js";
const router = Router();
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.get("/settings", async (_req, res) => {
  const paket = await db.pengaturanMembership.findUniqueOrThrow({ where: { id: 1 }, include: { layananGratis: { select: { id: true, nama: true, aktif: true } } } });
  return res.json({ profil: { nama: "BARBER BARBAR", slogan: "Not Cutting Heads, Just Hair", dapatDiubah: false },
    jam: { ...aturanJadwalBooking, zonaWaktu: zonaBooking }, bookingTamu: { ...kebijakanBookingTamu, slotMenit: slotLayananMenit },
    pembayaran: { metode: ["CASH", "TRANSFER", "QRIS"], mode: process.env.MIDTRANS_IS_PRODUCTION === "false" ? "Sandbox" : "Konfigurasi server", verifikasi: "Backend dan bukti provider resmi" },
    membership: { harga: paket.harga, layananGratisId: paket.layananGratisId, layananGratis: paket.layananGratis, bulan: 12 } });
});
router.get("/documents", async (req, res) => {
  const p = z.object({ cari: z.string().trim().max(100).default(""), sumber: z.enum(["SEMUA", "BOOKING", "WALK_IN", "MEMBERSHIP"]).default("SEMUA"), status: z.enum(["SEMUA", "UNPAID", "DP_PAID", "PAID", "FREE"]).default("SEMUA"), halaman: z.coerce.number().int().min(1).max(100000).default(1) }).strict().safeParse(req.query);
  if (!p.success) return res.status(400).json({ pesan: "Filter invoice tidak valid." });
  const d = p.data, hasil = (await bacaKeuangan()).dokumen.filter(v => (d.sumber === "SEMUA" || v.sumber === d.sumber) && (d.status === "SEMUA" || v.status === d.status) && `${v.nomor} ${v.referensi} ${v.pelanggan}`.toLocaleLowerCase("id-ID").includes(d.cari.toLocaleLowerCase("id-ID")));
  return res.json({ data: hasil.slice((d.halaman - 1) * 20, d.halaman * 20).map(({ items: _items, struk: _struk, ...v }) => v), total: hasil.length, halaman: d.halaman });
});
// ID pembayaran permanen juga dipakai untuk deduplikasi dialog otomatis di browser.
router.get("/receipts", async (_req, res) => res.json((await bacaKeuangan()).dokumen.flatMap(d => d.struk)));
router.get("/documents/:id", async (req, res) => {
  if (!/^[BWM]-\d+$/.test(String(req.params.id))) return res.status(404).json({ pesan: "Dokumen tidak ditemukan." });
  const d = (await bacaKeuangan()).dokumen.find(d => d.id === req.params.id);
  return d ? res.json(d) : res.status(404).json({ pesan: "Dokumen tidak ditemukan." });
});
router.get("/documents/:id/pdf", async (req, res) => {
  const p = z.object({ struk: z.string().regex(/^(BP|WP|MP)-\d+$/).optional(), format: z.enum(["A4", "58", "80"]).optional() }).strict().safeParse(req.query);
  if (!p.success) return res.status(400).json({ pesan: "Identitas struk tidak valid." });
  const d = (await bacaKeuangan()).dokumen.find(d => d.id === req.params.id), s = d?.struk.find(s => s.id === p.data.struk);
  if (!d || p.data.struk && !s) return res.status(404).json({ pesan: "Dokumen tidak ditemukan." });
  return res.type("application/pdf").attachment(`${s?.id ?? d.id}.pdf`).send(pdfKeuangan(d, s, p.data.format ?? (s ? "80" : "A4")));
});
router.get("/reports", async (req, res) => {
  const hari = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(`${v}T00:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v; });
  const p = z.object({ mulai: tanggal.default(hari), sampai: tanggal.default(hari) }).strict().refine(v => v.mulai <= v.sampai && (Date.parse(v.sampai) - Date.parse(v.mulai)) <= 366 * 86400000).safeParse(req.query);
  if (!p.success) return res.status(400).json({ pesan: "Rentang laporan tidak valid atau melebihi 366 hari." });
  return res.json(laporanKeuangan(await bacaKeuangan(), p.data.mulai, p.data.sampai));
});
export default router;
