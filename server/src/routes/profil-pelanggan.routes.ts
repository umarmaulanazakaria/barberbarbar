import { Router } from "express";
import { z } from "zod";
import basisData from "../lib/prisma.js";
import { hanyaAdmin } from "../middleware/role.middleware.js";
import { KesalahanProfil, skemaProfil, skemaCariProfil, daftarProfil, detailProfil, simpanProfilDalamTransaksi, transaksiProfil, ubahArsipProfil, kandidatDuplikat, konteksProfilBooking, tautkanProfilBooking } from "../services/profil-pelanggan.service.js";
import { normalisasiHpWalkIn } from "../schemas/walkin-dashboard.schema.js";
const router = Router();
const id = (v: unknown) => { const p = z.coerce.number().int().positive().safeParse(v); if (!p.success) throw new KesalahanProfil(400, "ID tidak valid"); return p.data; };
const baca = <T>(s: z.ZodType<T>, v: unknown) => { const p = s.safeParse(v); if (!p.success) throw new KesalahanProfil(400, "Data profil tidak valid. Nama dan nomor HP Indonesia wajib; email harus valid bila diisi."); return p.data; };
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.get("/options", async (req, res) => {
  // Bentuk respons legacy dipertahankan. Pencarian combobox dibatasi di database.
  if (Object.keys(req.query).length) {
    const p = baca(z.object({ cari: z.string().trim().max(100).default(""), batas: z.coerce.number().int().min(1).max(25).default(20), id: z.coerce.number().int().positive().optional() }).strict(), req.query);
    const hp = normalisasiHpWalkIn(p.cari);
    const data = await basisData.profilPelanggan.findMany({ where: { diarsipkanPada: null, nomorTelepon: { not: null }, pelanggan: { status: "AKTIF" },
      ...(p.id ? { id: p.id } : p.cari ? { OR: [{ nama: { contains: p.cari, mode: "insensitive" as const } }, ...(hp ? [{ nomorTelepon: { contains: hp } }] : [])] } : {}) },
      select: { id: true, nama: true, nomorTelepon: true, pelanggan: { select: { membership: { select: { id: true, memberCode: true } } } } },
      orderBy: [{ nama: "asc" }, { id: "asc" }], take: p.batas });
    return res.json(data.map(p => ({ id: p.id, nama: p.nama, nomorTelepon: p.nomorTelepon, membership: p.pelanggan.membership })));
  }
  const data = await basisData.profilPelanggan.findMany({ include: { pelanggan: { include: { membership: true } } }, orderBy: [{ nama: "asc" }, { id: "asc" }] });
  res.json(data.map(p => ({ id: p.id, pelangganId: p.pelangganId, nama: p.nama, nomorTelepon: p.nomorTelepon ?? "", email: p.email, catatan: p.catatan, diarsipkanPada: p.diarsipkanPada,
    status: p.diarsipkanPada ? "DIARSIPKAN" : p.pelanggan.status, membership: p.pelanggan.membership })));
});
router.get("/duplicates", async (req, res) => {
  const p = baca(z.object({ nomorTelepon: z.string().max(30).default(""), email: z.string().max(254).default(""), kecuali: z.coerce.number().int().positive().optional() }).strict(), req.query);
  res.json({ data: await transaksiProfil(tx => kandidatDuplikat(tx, normalisasiHpWalkIn(p.nomorTelepon), p.email.trim().toLowerCase(), p.kecuali)) });
});
router.get("/booking/:id", async (req, res) => res.json(await konteksProfilBooking(id(req.params.id), baca(z.string().trim().max(100), req.query.cari ?? ""))));
router.put("/booking/:id", async (req, res) => {
  const p = baca(z.object({ profilId: z.number().int().positive().nullable(), konfirmasi: z.literal(true) }).strict(), req.body);
  res.json(await tautkanProfilBooking(id(req.params.id), p.profilId, req.pengguna!.id));
});
router.get("/", async (req, res) => res.json(await daftarProfil(baca(skemaCariProfil, req.query))));
router.post("/", hanyaAdmin, async (req, res) => res.status(201).json(await transaksiProfil(tx => simpanProfilDalamTransaksi(tx, baca(skemaProfil, req.body), req.pengguna!.id))));
router.get("/:id", async (req, res) => res.json(await detailProfil(id(req.params.id))));
router.patch("/:id", hanyaAdmin, async (req, res) => res.json(await transaksiProfil(tx => simpanProfilDalamTransaksi(tx, baca(skemaProfil, req.body), req.pengguna!.id, id(req.params.id)))));
router.post("/:id/archive", hanyaAdmin, async (req, res) => { baca(z.object({ konfirmasi: z.literal(true) }).strict(), req.body); res.json(await ubahArsipProfil(id(req.params.id), req.pengguna!.id, true)); });
router.post("/:id/restore", hanyaAdmin, async (req, res) => { baca(z.object({ konfirmasi: z.literal(true) }).strict(), req.body); res.json(await ubahArsipProfil(id(req.params.id), req.pengguna!.id, false)); });
router.use((e: unknown, _req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
  if (e instanceof KesalahanProfil) return res.status(e.status).json({ pesan: e.message, kandidat: e.kandidat });
  next(e);
});
export default router;
