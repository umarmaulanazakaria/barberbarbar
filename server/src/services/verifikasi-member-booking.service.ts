import basisData from "../lib/prisma.js";
import { transaksiProfil, KesalahanProfil } from "./profil-pelanggan.service.js";
import { memberLayak, terapkanManfaat } from "./manfaat-membership.service.js";
import { normalisasiHpWalkIn } from "../schemas/walkin-dashboard.schema.js";
import { ambilBookingPembayaran, bacaRingkasanPembayaran } from "./pembayaran-booking.service.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";
export const lihatMemberBooking = async (id: number) => {
  const b = await basisData.booking.findUniqueOrThrow({ where: { id }, select: { membershipBerbayarId: true, memberBebasDp: true, identitasMemberPada: true, aksesTamu: { select: { nama: true, nomorTelepon: true } } } });
  const m = b.membershipBerbayarId ? await basisData.membership.findUnique({ where: { id: b.membershipBerbayarId }, include: { pelanggan: { include: { profil: true } } } }) : null;
  return { bebasDp: b.memberBebasDp, diverifikasiPada: b.identitasMemberPada, nomorMember: m?.memberCode ?? null, namaMember: m?.pelanggan.profil?.nama ?? m?.pelanggan.nama ?? null, nomorTeleponMember: m?.pelanggan.profil?.nomorTelepon ?? m?.pelanggan.nomorTelepon ?? null, kontakBooking: b.aksesTamu };
};
export const verifikasiMemberBooking = (id: number, penggunaId: number, data: { nomorMember: string; nama: string; nomorTelepon: string; hargaNormal: boolean }) => transaksiProfil(async tx => {
  const operator = await tx.pengguna.findUnique({ where: { id: penggunaId }, select: { role: true } });
  if (operator?.role !== "ADMIN") throw new KesalahanProfil(403, "Koreksi Member dan harga normal hanya dapat dilakukan oleh Admin.");
  const b = await tx.booking.findUniqueOrThrow({ where: { id }, include: { items: true } });
  if (!["CONFIRMED", "CHECKED_IN"].includes(b.status) || b.pesananId) throw new KesalahanProfil(409, "Verifikasi atau koreksi member hanya sebelum pelayanan dimulai.");
  if (await tx.transaksiPembayaranBooking.count({ where: { bookingId: id, status: "PENDING" } })) throw new KesalahanProfil(409, "Rekonsiliasi pembayaran pending sebelum mengubah manfaat.");
  const katalog = await tx.layanan.findMany({ where: { id: { in: b.items.map(i => i.layananId) }, aktif: true } });
  if (katalog.length !== b.items.length) throw new KesalahanProfil(409, "Ada layanan nonaktif. Periksa layanan sebelum mengubah manfaat.");
  let items = b.items.map(i => { const l = katalog.find(l => l.id === i.layananId)!; return { layananId: l.id, namaLayanan: l.nama, durasiMenit: l.durasiMenit, qty: i.qty, harga: l.harga, subtotal: l.harga * i.qty }; });
  const manfaat = data.hargaNormal ? null : await terapkanManfaat(tx, items, data.nomorMember, b.mulaiPada);
  if (manfaat) {
    await memberLayak(tx, manfaat.member.memberCode, await waktuDatabaseBooking(tx));
    const p = manfaat.member.pelanggan.profil;
    if (normalisasiHpWalkIn(data.nomorTelepon) !== normalisasiHpWalkIn(p?.nomorTelepon ?? manfaat.member.pelanggan.nomorTelepon ?? "") || data.nama.trim().toLocaleLowerCase() !== (p?.nama ?? manfaat.member.pelanggan.nama).trim().toLocaleLowerCase()) throw new KesalahanProfil(409, "Identitas tidak cocok. Periksa Nomor Member atau pilih harga normal.");
    if (b.memberBebasDp && manfaat.member.id === b.membershipBerbayarId) {
      await tx.booking.update({ where: { id }, data: { identitasMemberPada: await waktuDatabaseBooking(tx) } });
      await tx.riwayatBooking.create({ data: { bookingId: id, penggunaId, aksi: "VERIFY_MEMBERSHIP_IDENTITY", statusSebelum: b.status, statusSetelah: b.status, rincian: { membershipId: manfaat.member.id, hargaDipertahankan: true } } });
      return { tersimpan: true, perluDp: false };
    }
    if (manfaat.gratis && await tx.booking.count({ where: { id: { not: id }, membershipBerbayarId: manfaat.member.id, status: { in: ["AWAITING_DP", "PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] }, items: { some: { layananId: manfaat.snapshot.layananGratisId, harga: 0 } } } })) throw new KesalahanProfil(409, "Member sudah memiliki satu Booking layanan gratis aktif.");
    items = manfaat.items;
  }
  const total = items.reduce((n, i) => n + i.subtotal, 0), uang = await bacaRingkasanPembayaran(tx, await ambilBookingPembayaran(tx, id));
  if (!Number.isSafeInteger(total) || total > 2147483647 || total < uang.jumlahDibayar) throw new KesalahanProfil(409, "Tagihan baru tidak dapat mengurangi pembayaran yang sudah tercatat.");
  const sekarang = await waktuDatabaseBooking(tx), perluDp = !manfaat && !uang.dpTerverifikasi;
  const cukupNomor = b.snapshotManfaat && typeof b.snapshotManfaat === "object" && !Array.isArray(b.snapshotManfaat) && b.snapshotManfaat.pemesananCukupNomorMember === true;
  let pemesan: { pelangganId: number; profilPelangganId: number | null } | undefined;
  if (cukupNomor) {
    if (manfaat) pemesan = { pelangganId: manfaat.member.pelangganId, profilPelangganId: manfaat.member.pelanggan.profil?.id ?? null };
    else {
      if (data.nama.trim().length < 2 || !/^08\d{8,11}$/.test(normalisasiHpWalkIn(data.nomorTelepon))) throw new KesalahanProfil(400, "Isi nama dan HP orang yang hadir sebelum melepas Membership. Akun pemilik tidak diubah.");
      const tamu = await tx.pelanggan.create({ data: { nama: data.nama.trim(), nomorTelepon: null } });
      pemesan = { pelangganId: tamu.id, profilPelangganId: null };
    }
  }
  await tx.itemBooking.deleteMany({ where: { bookingId: id } }); await tx.itemBooking.createMany({ data: items.map(i => ({ ...i, bookingId: id })) });
  await tx.booking.update({ where: { id }, data: { ...pemesan, membershipBerbayarId: manfaat?.member.id ?? null, memberBebasDp: !!manfaat, identitasMemberPada: manfaat ? sekarang : null,
    snapshotManfaat: { ...(manfaat?.snapshot ?? { koreksi: "HARGA_NORMAL", penggunaId }), ...(cukupNomor ? { pemesananCukupNomorMember: true } : {}) }, membershipAktif: !!manfaat, discountPercent: 0, subtotal: total, diskon: 0, total, nominalDp: manfaat ? 0 : Math.ceil(total / 2), dpPersen: manfaat ? 0 : 50,
    deadlineDp: perluDp ? new Date(sekarang.getTime() + 15 * 60000) : null, ...(perluDp ? { status: "AWAITING_DP", checkInPada: null } : {}) } });
  await tx.riwayatBooking.create({ data: { bookingId: id, penggunaId, aksi: "VERIFY_MEMBERSHIP_IDENTITY", statusSebelum: b.status, statusSetelah: perluDp ? "AWAITING_DP" : b.status, rincian: { pelangganSebelumnya: b.pelangganId, pelangganBaru: pemesan?.pelangganId ?? b.pelangganId, memberSebelumnya: b.membershipBerbayarId, memberBaru: manfaat?.member.id ?? null, hargaNormal: data.hargaNormal, totalSebelumnya: b.total, totalBaru: total } } });
  return { tersimpan: true, perluDp };
});
