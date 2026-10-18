import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { KesalahanProfil } from "../services/profil-pelanggan.service.js";
import { lihatIdentitasMemberStaff, putuskanIdentitasMemberStaff } from "../services/identitas-member-staff.service.js";
import { simpanWalkInDashboard, KesalahanWalkIn } from "../services/walkin-dashboard.service.js";
import { skemaWalkIn } from "../schemas/walkin-dashboard.schema.js";
const router = Router(), nomor = z.string().trim().min(1).max(60), id = z.coerce.number().int().positive();
const baca = <T>(s: z.ZodType<T>, v: unknown) => { const p = s.safeParse(v); if (!p.success) throw new KesalahanProfil(400, "Konfirmasi pemeriksaan fisik dan referensi Member tidak valid."); return p.data; };
const aktor = (req: Request) => { if (!req.pengguna || !["STAFF", "ADMIN"].includes(req.pengguna.role)) throw new KesalahanProfil(403, "Akses operator diperlukan."); return req.pengguna.id; };
const bungkus = (f: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  try { res.json(await f(req)); } catch (e) { if (e instanceof KesalahanProfil || e instanceof KesalahanWalkIn) return res.status(e.status).json({ pesan: e.message, ...(e instanceof KesalahanWalkIn ? { kode: e.kode } : e.status === 409 && req.path === "/walk-in" ? { kode: "VERIFIKASI_MEMBER_TIDAK_SAH" } : {}) }); res.status(503).json({ pesan: "Verifikasi Member belum dapat dipastikan. Periksa status sebelum mencoba kembali." }); }
};
router.get("/member", bungkus(req => {
  const p = baca(z.object({ nomorMember: nomor.optional(), bookingId: id.optional() }).strict().refine(d => !!d.nomorMember !== !!d.bookingId), req.query);
  return lihatIdentitasMemberStaff(aktor(req), p.nomorMember, p.bookingId);
}));
router.post("/identity", bungkus(req => {
  const p = baca(z.object({ nomorMember: nomor.optional(), pemeriksaanFisik: z.literal(true), cocok: z.boolean(), konteks: z.discriminatedUnion("jenis", [
    z.object({ jenis: z.literal("BOOKING"), bookingId: z.number().int().positive() }).strict(),
    z.object({ jenis: z.literal("WALK_IN"), kunciPermintaan: z.uuid() }).strict(),
    z.object({ jenis: z.literal("CEK_MEMBER") }).strict(),
  ]) }).strict().refine(d => d.konteks.jenis === "BOOKING" || !!d.nomorMember), req.body);
  return putuskanIdentitasMemberStaff(aktor(req), p);
}));
router.post("/walk-in", bungkus(req => {
  const p = baca(skemaWalkIn.extend({ verifikasiId: z.number().int().positive() }).strict().refine(d => d.konfirmasiMember === true && d.pelanggan.jenis === "LAMA"), req.body);
  const { verifikasiId, ...data } = p;
  return simpanWalkInDashboard(data, aktor(req), verifikasiId);
}));
export default router;
