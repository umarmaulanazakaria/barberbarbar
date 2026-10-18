import { Router } from "express";
import { z } from "zod";
import { batasiPercobaanPelanggan, batasiNomorMemberPublik } from "../middleware/batas-percobaan-pelanggan.middleware.js";
import { KesalahanProfil, transaksiProfil } from "../services/profil-pelanggan.service.js";
import { terapkanManfaat } from "../services/manfaat-membership.service.js";
import { lihatMemberBooking, verifikasiMemberBooking } from "../services/verifikasi-member-booking.service.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";
import routerIdentitasStaff from "./identitas-member-staff.routes.js";
import { lihatIdentitasMemberStaff, putuskanIdentitasMemberStaff } from "../services/identitas-member-staff.service.js";
export const routerManfaatPublik = Router(), routerManfaatOperator = Router();
routerManfaatOperator.use("/staff", routerIdentitasStaff);
const items = z.array(z.object({ layananId: z.number().int().positive(), qty: z.number().int().min(1).max(10) }).strict()).min(1).max(20).refine(v => new Set(v.map(i => i.layananId)).size === v.length);
const baca = <T>(s: z.ZodType<T>, v: unknown) => { const p = s.safeParse(v); if (!p.success) throw new KesalahanProfil(400, "Data manfaat Membership tidak valid."); return p.data; };
const id = (v: unknown) => baca(z.coerce.number().int().positive().max(2147483647), v);
const katalog = async (tx: import("../generated/prisma/client.js").Prisma.TransactionClient, pilihan: z.infer<typeof items>) => {
  const daftar = await tx.layanan.findMany({ where: { id: { in: pilihan.map(i => i.layananId) }, aktif: true } });
  if (daftar.length !== pilihan.length) throw new KesalahanProfil(409, "Layanan tidak tersedia.");
  return pilihan.map(i => { const l = daftar.find(l => l.id === i.layananId)!; return { layananId: l.id, namaLayanan: l.nama, harga: l.harga, durasiMenit: l.durasiMenit, qty: i.qty, subtotal: l.harga * i.qty }; });
};
routerManfaatPublik.post("/member-quote", batasiPercobaanPelanggan(15), batasiNomorMemberPublik(30), async (req, res) => {
  const d = baca(z.object({ nomorMember: z.string().trim().min(1).max(60), mulaiPada: z.string().datetime({ offset: true }), items }).strict(), req.body);
  const hasil = await transaksiProfil(async tx => { const manfaat = await terapkanManfaat(tx, await katalog(tx, d.items), d.nomorMember, new Date(d.mulaiPada)); return { items: manfaat.items.map(i => ({ layananId: i.layananId, harga: i.harga, subtotal: i.subtotal })), total: manfaat.items.reduce((n, i) => n + i.subtotal, 0), bebasDp: true }; });
  res.set("Cache-Control", "no-store").json(hasil); // Tidak mengembalikan identitas pemilik.
});
routerManfaatOperator.post("/quote", async (req, res) => {
  const d = baca(z.object({ profilId: z.number().int().positive(), items }).strict(), req.body);
  res.set("Cache-Control", "no-store").json(await transaksiProfil(async tx => {
    const p = await tx.profilPelanggan.findUniqueOrThrow({ where: { id: d.profilId }, include: { pelanggan: { include: { membership: true } } } });
    const data = await katalog(tx, d.items), m = p.pelanggan.membership, sekarang = await waktuDatabaseBooking(tx);
    if (!m?.berlakuSampai || m.berlakuSampai <= sekarang || !m.isActive) return { member: false, total: data.reduce((n, i) => n + i.subtotal, 0), items: data };
    const manfaat = await terapkanManfaat(tx, data, m.memberCode, sekarang);
    return { member: true, total: manfaat.items.reduce((n, i) => n + i.subtotal, 0), items: manfaat.items };
  }));
});
routerManfaatOperator.get("/booking/:id", async (req, res) => res.set("Cache-Control", "no-store").json(await lihatMemberBooking(id(req.params.id))));
// Kontrak Web operator: Member ditentukan dari Booking, bukan identitas kiriman klien.
routerManfaatOperator.get("/booking/:id/identity", async (req, res) => {
  res.set("Cache-Control", "no-store").json(await lihatIdentitasMemberStaff(req.pengguna!.id, undefined, id(req.params.id)));
});
routerManfaatOperator.post("/booking/:id/identity", async (req, res) => {
  const d = baca(z.object({ pemeriksaanFisik: z.literal(true), cocok: z.boolean() }).strict(), req.body);
  res.set("Cache-Control", "no-store").json(await putuskanIdentitasMemberStaff(req.pengguna!.id, { konteks: { jenis: "BOOKING", bookingId: id(req.params.id) }, cocok: d.cocok }));
});
routerManfaatOperator.put("/booking/:id", async (req, res) => {
  const d = baca(z.object({ nomorMember: z.string().trim().max(60), nama: z.string().trim().max(100), nomorTelepon: z.string().trim().max(30), hargaNormal: z.boolean(), konfirmasi: z.literal(true) }).strict(), req.body);
  res.json(await verifikasiMemberBooking(id(req.params.id), req.pengguna!.id, d));
});
const tangani: import("express").ErrorRequestHandler = (e: unknown, _req, res, _next) => { if (e instanceof KesalahanProfil) return res.status(e.status).json({ pesan: e.message }); return res.status(503).json({ pesan: "Manfaat Membership belum dapat diverifikasi." }); };
routerManfaatPublik.use(tangani); routerManfaatOperator.use(tangani);
