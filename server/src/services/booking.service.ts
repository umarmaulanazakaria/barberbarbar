import { terapkanManfaat } from "./manfaat-membership.service.js";
import { kapasitasLintasBooking } from "../lib/kapasitas-lintas-booking.js";
import { randomUUID } from "node:crypto";
import basisData from "../lib/prisma.js";
import { validasiWaktuBooking, zonaBooking } from "../lib/jadwal-booking.js";
import type { DataBuatBooking } from "../schemas/booking.schema.js";
import { kunciJadwalBooking } from "../lib/transaksi-booking.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";

export const kolomBooking = {
  memberBebasDp:true, membershipBerbayarId:true, identitasMemberPada:true,
  id: true, nomorBooking: true, status: true, mulaiPada: true, selesaiPada: true, zonaWaktu: true,
  durasiMenit: true, barberPilihanId: true, pesananId: true, subtotal: true, membershipAktif: true,
  discountPercent: true, diskon: true, total: true, dpPersen: true, nominalDp: true, catatan: true,
  dibuatPada: true, diperbaruiPada: true, dikonfirmasiPada: true, ditolakPada: true, dibatalkanPada: true,
  deadlineDp: true, deadlinePelunasan: true, checkInPada: true, layananMulaiPada: true, layananSelesaiPada: true,
  alasanPenolakan: true, barberDisetujuiId: true, barberFinalId: true,
  usulanBarber: { select: { id: true, barberId: true, alasan: true, status: true, dibuatPada: true, diputuskanPada: true }, orderBy: { id: "desc" as const } },
  riwayat: { select: { aksi: true, statusSebelum: true, statusSetelah: true, rincian: true, dibuatPada: true }, orderBy: { id: "asc" as const } },
  items: { select: { layananId: true, namaLayanan: true, harga: true, durasiMenit: true, qty: true, subtotal: true } },
} as const;
export const statusMenahanBooking = ["AWAITING_DP", "PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] as const;

export const buatBookingPelanggan = async (pelangganId: number, data: DataBuatBooking) =>
  basisData.$transaction(async transaksi => {
    // PrismaPg mengirim parameter Date sebagai waktu UTC tanpa offset.
    // TIMESTAMPTZ harus menafsirkan parameter itu dalam UTC, bukan zona sesi host.
    await kunciJadwalBooking(transaksi);
    // Semua penulis booking F5+ wajib memakai lock yang sama sebelum validasi.
    // READ COMMITTED membaca hasil commit request sebelumnya setelah menunggu lock.
    const sekarang = await waktuDatabaseBooking(transaksi);
    const pelanggan = await transaksi.pelanggan.findUnique({ where: { id: pelangganId }, include: { membership: true } });
    if (!pelanggan || pelanggan.status !== "AKTIF") return { status: "AKUN_TIDAK_AKTIF" } as const;
    const layanan = await transaksi.layanan.findMany({ where: { id: { in: data.items.map(item => item.layananId) }, aktif: true } });
    if (layanan.length !== data.items.length) return { status: "DATA_TIDAK_VALID" } as const;
    let items = data.items.map(item => {
      const sumber = layanan.find(l => l.id === item.layananId)!;
      return { layananId: sumber.id, namaLayanan: sumber.nama, durasiMenit: sumber.durasiMenit,
        harga: sumber.harga, qty: item.qty, subtotal: sumber.harga * item.qty };
    });
    if (items.some(item => item.harga < 0 || item.durasiMenit <= 0)) return { status: "DATA_TIDAK_VALID" } as const;
    const durasiMenit = items.reduce((total, item) => total + item.durasiMenit * item.qty, 0);
    const mulaiPada = new Date(data.mulaiPada);
    const selesaiPada = validasiWaktuBooking(mulaiPada, durasiMenit, sekarang);
    if (!selesaiPada) return { status: "WAKTU_TIDAK_VALID" } as const;
    const aktif = await transaksi.barber.findMany({ where: { aktif: true }, select: { id: true } });
    if (data.barberPilihanId && !aktif.some(b => b.id === data.barberPilihanId)) return { status: "DATA_TIDAK_VALID" } as const;
    const rentang = { mulaiPada, selesaiPada };
    if (!await kapasitasLintasBooking(transaksi, rentang, { pelangganId, barberId: data.barberPilihanId })) return { status: "JADWAL_TIDAK_TERSEDIA" } as const;
    let manfaat: Awaited<ReturnType<typeof terapkanManfaat>> | null=null;
    const member=pelanggan.membership;
    if(member?.isActive && member.berlakuMulai && member.berlakuMulai<=mulaiPada && member.berlakuSampai && member.berlakuSampai>mulaiPada && await transaksi.penjualanMembership.count({where:{membershipId:member.id,status:"SUCCEEDED"}})){
      manfaat=await terapkanManfaat(transaksi,items,member.memberCode,mulaiPada);
      if(manfaat.gratis && await transaksi.booking.count({where:{membershipBerbayarId:member.id,status:{in:["AWAITING_DP","PENDING_CONFIRMATION","CONFIRMED","CHECKED_IN","IN_SERVICE"]},items:{some:{layananId:manfaat.snapshot.layananGratisId,harga:0}}}}))return {status:"JADWAL_TIDAK_TERSEDIA"} as const;
      items=manfaat.items;
    }
    const subtotal = items.reduce((jumlah, item) => jumlah + item.subtotal, 0);
    const membershipAktif = !!manfaat;
    // Kontrak F4: ACTIVE selalu 10%, tidak mengikuti diskon kustom operator.
    // API/pesanan operator existing tidak diubah (kebijakan F3 tetap berlaku).
    const discountPercent = 0;
    const diskon = Math.floor(subtotal * discountPercent / 100);
    const total = subtotal - diskon;
    const nominalDp = manfaat ? 0 : Math.ceil(total / 2); // Rupiah bulat; setidaknya 50%.
    if (![subtotal, total, nominalDp].every(angka => Number.isSafeInteger(angka) && angka >= 0 && angka <= 2_147_483_647)) {
      return { status: "DATA_TIDAK_VALID" } as const;
    }
    const booking = await transaksi.booking.create({ data: {
      ...(manfaat?{membershipBerbayarId:manfaat.member.id,memberBebasDp:true,snapshotManfaat:manfaat.snapshot,status:"CONFIRMED",dikonfirmasiPada:sekarang}:{}),
      nomorBooking: `BKG-${randomUUID()}`, pelangganId, dibuatPada: sekarang, barberPilihanId: data.barberPilihanId ?? null,
      mulaiPada, selesaiPada, zonaWaktu: zonaBooking, durasiMenit, subtotal, membershipAktif,
      discountPercent, diskon, total, dpPersen: manfaat?0:50, nominalDp, catatan: data.catatan ?? null,
      items: { create: items },
    }, select: kolomBooking });
    return { status: "BERHASIL", booking } as const;
  }, { isolationLevel: "ReadCommitted" });

export const daftarBookingSendiri = (pelangganId: number) => basisData.$transaction(async tx => {
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  return tx.booking.findMany({
  where: { pelangganId }, select: kolomBooking, orderBy: { mulaiPada: "asc" },
  });
});
export const detailBookingSendiri = (pelangganId: number, id: number) => basisData.$transaction(async tx => {
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  return tx.booking.findFirst({
  where: { id, pelangganId }, select: kolomBooking,
  });
});
