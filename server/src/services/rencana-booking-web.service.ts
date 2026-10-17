import { z } from "zod";
import db from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { slotLayananMenit } from "../lib/slot-layanan.js";
import { aturanJadwalBooking, validasiWaktuBooking } from "../lib/jadwal-booking.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";
import { kapasitasLintasBooking, siapkanKapasitasLintasBooking } from "../lib/kapasitas-lintas-booking.js";
import { terapkanManfaat } from "./manfaat-membership.service.js";
import { KesalahanProfil } from "./profil-pelanggan.service.js";
import { KesalahanPembayaranBooking } from "./pembayaran-booking.service.js";
const gagal = (pesan: string, kode = 409): never => { throw new KesalahanPembayaranBooking(kode, pesan); };
export const skemaRencanaBooking = z.object({ nomorMember: z.string().trim().min(1).max(60).optional(),
  barberPilihanId: z.number().int().positive().optional(), mulaiPada: z.string().datetime({ offset: true }),
  items: z.array(z.object({ layananId: z.number().int().positive(), qty: z.number().int().min(1).max(10) }).strict()).min(1).max(20),
}).strict().refine(d => new Set(d.items.map(i => i.layananId)).size === d.items.length);
export type RencanaBookingWeb = z.infer<typeof skemaRencanaBooking>;
export async function siapkanRencanaBookingWeb(tx: Prisma.TransactionClient, data: RencanaBookingWeb, bacaSaja = false) {
  const sekarang = await waktuDatabaseBooking(tx), mulaiPada = new Date(data.mulaiPada);
  const selesaiPada = validasiWaktuBooking(mulaiPada, slotLayananMenit, sekarang);
  if (!selesaiPada) return gagal("Jadwal tidak tersedia. Pilih ulang tanggal dan slot Booking.");
  const layanan = await tx.layanan.findMany({ where: { id: { in: data.items.map(i => i.layananId) }, aktif: true } });
  if (layanan.length !== data.items.length) return gagal("Layanan tidak tersedia. Perbarui pilihan Anda.");
  let items = data.items.map(i => { const l = layanan.find(l => l.id === i.layananId)!; return { layananId: l.id, namaLayanan: l.nama, harga: l.harga, durasiMenit: l.durasiMenit, qty: i.qty, subtotal: l.harga * i.qty }; });
  const subtotal = items.reduce((n, i) => n + i.subtotal, 0);
  let manfaat: Awaited<ReturnType<typeof terapkanManfaat>> | null = null;
  if (data.nomorMember) {
    try { manfaat = await terapkanManfaat(tx, items, data.nomorMember, mulaiPada); }
    catch (e) { if (e instanceof KesalahanProfil) return gagal("Membership tidak dapat digunakan pada jadwal ini. Periksa nomor atau lanjutkan sebagai Booking Reguler."); throw e; }
    if (!manfaat.member.pelanggan.profil || manfaat.member.pelanggan.profil.diarsipkanPada) return gagal("Membership tidak dapat digunakan untuk Booking ini. Hubungi Admin atau lanjutkan reguler.");
    if (manfaat.gratis && await tx.booking.count({ where: { membershipBerbayarId: manfaat.member.id, status: { in: ["AWAITING_DP", "PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] }, items: { some: { layananId: manfaat.snapshot.layananGratisId, harga: 0 } } } })) return gagal("Manfaat Member belum dapat digunakan untuk Booking ini. Hubungi Admin atau lanjutkan reguler.");
    items = manfaat.items;
  }
  const total = items.reduce((n, i) => n + i.subtotal, 0);
  if (!Number.isSafeInteger(total) || total > 2147483647 || total < 0 || total === 0 && !manfaat || !Number.isSafeInteger(subtotal)) return gagal("Nominal layanan tidak dapat diproses.");
  const barber = data.barberPilihanId ? await tx.barber.findFirst({ where: { id: data.barberPilihanId, aktif: true }, select: { id: true, nama: true } }) : null;
  if (data.barberPilihanId && !barber) return gagal("Barber tidak tersedia. Pilih kembali.");
  if (!await kapasitasLintasBooking(tx, { mulaiPada, selesaiPada }, { barberId: data.barberPilihanId, bacaSaja })) return gagal("Slot atau barber sudah tidak tersedia. Pilih jadwal lain.");
  return { items, manfaat, total, subtotal, mulaiPada, selesaiPada, barber };
}
export const kutipanBookingWeb = (data: RencanaBookingWeb) => db.$transaction(async tx => {
  const r = await siapkanRencanaBookingWeb(tx, data, true), dp = r.manfaat ? 0 : Math.ceil(r.total / 2);
  // Tidak ada nama/HP, profil, ID pemilik atau booking lain dalam respons publik.
  return { items: r.items.map(i => ({ layananId: i.layananId, nama: i.namaLayanan, qty: i.qty, harga: i.harga, subtotal: i.subtotal })), subtotal: r.subtotal, diskonMember: r.subtotal - r.total,
    total: r.total, nominalDp: dp, sisaSetelahDp: r.total - dp, bebasDp: !!r.manfaat, barber: r.barber, mulaiPada: r.mulaiPada, selesaiPada: r.selesaiPada, slotMenit: slotLayananMenit };
}, { isolationLevel: "RepeatableRead" });
export const slotBookingWeb = (tanggal: string) => db.$transaction(async tx => {
  const sekarang = await waktuDatabaseBooking(tx), hariIni = new Date(sekarang.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  const mulaiHari = new Date(`${tanggal}T00:00:00+07:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !Number.isFinite(mulaiHari.getTime()) || new Date(mulaiHari.getTime() + 7 * 3600000).toISOString().slice(0, 10) !== tanggal || tanggal < hariIni || mulaiHari.getTime() > sekarang.getTime() + aturanJadwalBooking.maksimumHari * 86400000) return gagal("Tanggal tidak tersedia.", 400);
  const barber = await tx.barber.findMany({ where: { aktif: true }, select: { id: true, nama: true }, orderBy: { nama: "asc" } });
  const tersedia = await siapkanKapasitasLintasBooking(tx, { bacaSaja: true });
  const slot: { mulaiPada: string; selesaiPada: string; barberId: number[] }[] = [];
  for (let menit = aturanJadwalBooking.bukaMenit; menit + slotLayananMenit <= aturanJadwalBooking.tutupMenit; menit += slotLayananMenit) {
    const mulaiPada = new Date(mulaiHari.getTime() + menit * 60000), selesaiPada = validasiWaktuBooking(mulaiPada, slotLayananMenit, sekarang);
    if (!selesaiPada) continue;
    const ids = barber.filter(b => tersedia({ mulaiPada, selesaiPada }, b.id)).map(b => b.id);
    if (ids.length) slot.push({ mulaiPada: mulaiPada.toISOString(), selesaiPada: selesaiPada.toISOString(), barberId: ids });
  }
  return { tanggal, serverTime: sekarang.toISOString(), slotMenit: slotLayananMenit, barber: barber.filter(b => slot.some(s => s.barberId.includes(b.id))), slot };
}, { isolationLevel: "RepeatableRead" });
