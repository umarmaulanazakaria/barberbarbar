import type { Prisma } from "../generated/prisma/client.js";
import { transaksiProfil, KesalahanProfil } from "./profil-pelanggan.service.js";
import { memberLayak } from "./manfaat-membership.service.js";
import { statusMembership } from "../lib/status-membership.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";

export type KonteksIdentitasStaff = { jenis: "BOOKING"; bookingId: number } | { jenis: "WALK_IN"; kunciPermintaan: string } | { jenis: "CEK_MEMBER" };
const aksiAudit = "MEMBER_IDENTITY_PHYSICAL", masaVerifikasi = 15 * 60000;
const tolak = (pesan: string, status = 409): never => { throw new KesalahanProfil(status, pesan); };
const operator = async (tx: Prisma.TransactionClient, penggunaId: number) => {
  const p = await tx.pengguna.findUnique({ where: { id: penggunaId }, select: { role: true } });
  if (!p || !["STAFF", "ADMIN"].includes(p.role)) return tolak("Hanya operator yang dapat memeriksa identitas Member.", 403);
};
async function konteks(tx: Prisma.TransactionClient, nomorMember?: string, bookingId?: number) {
  const b = bookingId ? await tx.booking.findUnique({ where: { id: bookingId }, include: { items: true } }) : null;
  if (bookingId && (!b || !b.memberBebasDp || !b.membershipBerbayarId)) return tolak("Booking tidak memiliki Membership yang dapat diverifikasi.");
  const m = await tx.membership.findFirst({ where: b ? { id: b.membershipBerbayarId! } : { memberCode: nomorMember?.trim().toUpperCase() ?? "" }, include: { pelanggan: { include: { profil: true } }, penjualan: { select: { status: true } } } });
  if (!m || !m.pelanggan.profil || m.pelanggan.profil.diarsipkanPada) return tolak("Member atau profil aktif tidak ditemukan.", 404);
  const sekarang = await waktuDatabaseBooking(tx), status = statusMembership(m, sekarang);
  return { m, b, sekarang, status, layak: status === "AKTIF" && (!b || statusMembership(m, b.mulaiPada) === "AKTIF") };
}
const dto = (r: Awaited<ReturnType<typeof konteks>>) => ({ member: { id: r.m.id, nomorMember: r.m.memberCode, nama: r.m.pelanggan.profil!.nama, status: r.status, berlakuSampai: r.m.berlakuSampai }, profil: { id: r.m.pelanggan.profil!.id, nama: r.m.pelanggan.profil!.nama }, layak: r.layak });
export const lihatIdentitasMemberStaff = (penggunaId: number, nomorMember?: string, bookingId?: number) => transaksiProfil(async tx => {
  await operator(tx, penggunaId); return dto(await konteks(tx, nomorMember, bookingId));
});
export const putuskanIdentitasMemberStaff = (penggunaId: number, data: { nomorMember?: string | undefined; konteks: KonteksIdentitasStaff; cocok: boolean }) => transaksiProfil(async tx => {
  await operator(tx, penggunaId);
  const r = await konteks(tx, data.nomorMember, data.konteks.jenis === "BOOKING" ? data.konteks.bookingId : undefined);
  if (r.b && (!["CONFIRMED", "CHECKED_IN"].includes(r.b.status) || r.b.pesananId)) return tolak("Verifikasi hanya dapat dilakukan sebelum pelayanan dimulai.");
  if (data.cocok && !r.layak) return tolak("Membership tidak aktif atau tidak berlaku pada jadwal Booking. Manfaat belum dapat digunakan.");
  if (data.cocok && r.b) {
    const paket = await tx.pengaturanMembership.findUnique({ where: { id: 1 } });
    if (!paket?.layananGratisId) return tolak("Paket Membership belum tersedia.");
    if (r.b.items.some(i => i.layananId === paket.layananGratisId && i.harga === 0) && await tx.booking.count({ where: { id: { not: r.b.id }, membershipBerbayarId: r.m.id, status: { in: ["AWAITING_DP", "PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] }, items: { some: { layananId: paket.layananGratisId, harga: 0 } } } })) return tolak("Member memiliki Booking gratis aktif lainnya. Minta pemeriksaan Admin.");
  }
  const rincian = { metode: "KARTU_MEMBER_KTP", ...data.konteks, membershipId: r.m.id, cocok: data.cocok, pemeriksaanFisik: true, berlakuHingga: new Date(r.sekarang.getTime() + masaVerifikasi).toISOString() };
  const audit = await tx.riwayatProfilPelanggan.create({ data: { profilId: r.m.pelanggan.profil!.id, penggunaId, aksi: aksiAudit, dibuatPada: r.sekarang, rincian } });
  if (r.b) {
    // Hanya cap verifikasi; tidak mengubah harga, item, DP, atau status Booking.
    await tx.booking.update({ where: { id: r.b.id }, data: { identitasMemberPada: data.cocok ? r.sekarang : null } });
    await tx.riwayatBooking.create({ data: { bookingId: r.b.id, penggunaId, aksi: data.cocok ? "VERIFY_MEMBERSHIP_IDENTITY" : "MEMBERSHIP_IDENTITY_MISMATCH", statusSebelum: r.b.status, statusSetelah: r.b.status, dibuatPada: r.sekarang, rincian: { ...rincian, verifikasiId: audit.id, hargaDipertahankan: true } } });
  }
  return { ...dto(r), terverifikasi: data.cocok, verifikasiId: data.cocok ? audit.id : null, diverifikasiPada: data.cocok ? r.sekarang : null };
});
// Bukti server dibatasi ke operator, profil, Member, dan satu kunci permintaan Walk-in.
export async function pastikanVerifikasiWalkInStaff(tx: Prisma.TransactionClient, penggunaId: number, profilId: number, kunciPermintaan: string, verifikasiId: number) {
  await operator(tx, penggunaId);
  const audit = await tx.riwayatProfilPelanggan.findFirst({ where: { id: verifikasiId, penggunaId, profilId, aksi: aksiAudit } });
  const r = audit?.rincian;
  if (!audit || !r || typeof r !== "object" || Array.isArray(r) || r.jenis !== "WALK_IN" || r.cocok !== true || r.pemeriksaanFisik !== true || r.kunciPermintaan !== kunciPermintaan || typeof r.membershipId !== "number" || typeof r.berlakuHingga !== "string") return tolak("Verifikasi fisik Member belum sah untuk permintaan Walk-in ini.");
  const sekarang = await waktuDatabaseBooking(tx), akhir = Date.parse(r.berlakuHingga);
  if (!Number.isFinite(akhir) || sekarang.getTime() >= akhir || sekarang < audit.dibuatPada) return tolak("Verifikasi Member kedaluwarsa. Periksa Kartu Member dan KTP kembali.");
  const terakhir = await tx.riwayatProfilPelanggan.findFirst({ where: { penggunaId, profilId, aksi: aksiAudit, rincian: { path: ["kunciPermintaan"], equals: kunciPermintaan } }, orderBy: { id: "desc" }, select: { id: true } });
  if (terakhir?.id !== verifikasiId) return tolak("Keputusan identitas sudah berubah. Verifikasi Member kembali.");
  if (await tx.riwayatProfilPelanggan.count({ where: { profilId, id: { gt: verifikasiId }, aksi: { in: ["UBAH_PROFIL", "ARSIPKAN", "PULIHKAN"] } } })) return tolak("Identitas profil sudah berubah. Periksa Kartu Member dan KTP kembali.");
  const m = await tx.membership.findUnique({ where: { id: r.membershipId }, select: { memberCode: true } });
  if (!m) return tolak("Membership tidak ditemukan.");
  const layak = await memberLayak(tx, m.memberCode, sekarang);
  if (layak.pelanggan.profil?.id !== profilId) return tolak("Profil Member sudah berubah. Verifikasi kembali.");
  return audit;
}
