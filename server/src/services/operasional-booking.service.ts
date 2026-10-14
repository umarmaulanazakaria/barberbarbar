import basisData from "../lib/prisma.js";
import type { Booking, Prisma } from "../generated/prisma/client.js";
import { kapasitasBookingCukup, validasiWaktuBooking } from "../lib/jadwal-booking.js";
import { kunciJadwalBooking } from "../lib/transaksi-booking.js";
import { kolomBooking, statusMenahanBooking } from "./booking.service.js";

export class KesalahanOperasionalBooking extends Error {
  constructor(public kode: number, public pesan: string) { super(pesan); }
}
const tolak = (pesan = "Operasi booking tidak dapat diproses", kode = 409): never => { throw new KesalahanOperasionalBooking(kode, pesan); };
const ambil = async (tx: Prisma.TransactionClient, id: number, pelangganId?: number) => {
  const booking = await tx.booking.findFirst({ where: { id, ...(pelangganId === undefined ? {} : { pelangganId }) } });
  if (!booking) return tolak("Booking tidak ditemukan", 404);
  return booking;
};
const catat = (tx: Prisma.TransactionClient, booking: Booking, aksi: string, status: Booking["status"],
  aktor: { penggunaId: number } | { akunPelangganId: number }, rincian?: Prisma.InputJsonObject) =>
  tx.riwayatBooking.create({ data: { bookingId: booking.id, aksi, statusSebelum: booking.status,
    statusSetelah: status, ...aktor, ...(rincian === undefined ? {} : { rincian }) } });
const transaksiBooking = <T>(aksi: (tx: Prisma.TransactionClient) => Promise<T>) => basisData.$transaction(async tx => {
  await kunciJadwalBooking(tx);
  return aksi(tx);
}, { isolationLevel: "ReadCommitted" });
const validasiSlot = async (tx: Prisma.TransactionClient, booking: Booking, mulai: Date, selesai: Date, barberId: number | null) => {
  const aktif = await tx.barber.findMany({ where: { aktif: true }, select: { id: true } });
  if (barberId !== null && !aktif.some(b => b.id === barberId)) return tolak("Barber tidak tersedia");
  const bentrok = await tx.booking.findMany({ where: { id: { not: booking.id }, status: { in: [...statusMenahanBooking] },
    mulaiPada: { lt: selesai }, selesaiPada: { gt: mulai } },
    select: { pelangganId: true, barberPilihanId: true, barberDisetujuiId: true, barberFinalId: true, mulaiPada: true, selesaiPada: true } });
  if (bentrok.some(b => b.pelangganId === booking.pelangganId) ||
      (barberId !== null && bentrok.some(b => (b.barberFinalId ?? b.barberDisetujuiId ?? b.barberPilihanId) === barberId)) ||
      !kapasitasBookingCukup(bentrok, { mulaiPada: mulai, selesaiPada: selesai }, aktif.length)) return tolak("Jadwal booking tidak tersedia");
};
const pastikanCustomerAktif = async (tx: Prisma.TransactionClient, booking: Booking) => {
  const pelanggan = await tx.pelanggan.findUnique({ where: { id: booking.pelangganId }, select: { status: true } });
  if (pelanggan?.status !== "AKTIF") return tolak("Customer tidak aktif");
};

export const daftarBookingOperator = () => basisData.booking.findMany({
  select: { ...kolomBooking, pelanggan: { select: { id: true, nama: true } } }, orderBy: { mulaiPada: "asc" },
});
export const detailBookingOperator = (id: number) => basisData.booking.findUnique({
  where: { id }, select: { ...kolomBooking, pelanggan: { select: { id: true, nama: true } } },
});

export const putuskanBooking = (id: number, penggunaId: number, setuju: boolean, alasan?: string) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id);
  if (booking.status !== "PENDING_CONFIRMATION") return tolak();
  const sekarang = new Date();
  if (setuju) {
    await pastikanCustomerAktif(tx, booking);
    if (booking.mulaiPada <= sekarang) return tolak("Jadwal booking sudah lewat");
    await validasiSlot(tx, booking, booking.mulaiPada, booking.selesaiPada, booking.barberDisetujuiId ?? booking.barberPilihanId);
  } else if (!alasan?.trim()) return tolak("Alasan penolakan wajib diisi", 400);
  const status = setuju ? "CONFIRMED" : "REJECTED";
  const deadline = setuju ? new Date(sekarang.getTime() + 3600000) : null;
  const klaim = await tx.booking.updateMany({ where: { id, status: "PENDING_CONFIRMATION" }, data: {
    status, diputuskanOlehId: penggunaId, deadlineDp: deadline,
    ...(setuju ? { dikonfirmasiPada: sekarang } : { ditolakPada: sekarang, alasanPenolakan: alasan! }),
  } });
  if (klaim.count !== 1) return tolak();
  await catat(tx, booking, setuju ? "CONFIRM" : "REJECT", status, { penggunaId },
    setuju ? { deadlineDp: deadline!.toISOString() } : { alasan: alasan! });
  return tx.booking.findUniqueOrThrow({ where: { id }, select: kolomBooking });
});

export const usulkanBarber = (id: number, penggunaId: number, barberId: number, alasan: string) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id);
  if (!["CONFIRMED", "CHECKED_IN"].includes(booking.status) || !booking.barberPilihanId) return tolak();
  await pastikanCustomerAktif(tx, booking);
  if (barberId === (booking.barberDisetujuiId ?? booking.barberPilihanId)) return tolak("Barber pengganti harus berbeda");
  if (await tx.usulanBarberBooking.findFirst({ where: { bookingId: id, status: "PENDING" } })) return tolak("Masih ada usulan yang menunggu keputusan");
  await validasiSlot(tx, booking, booking.mulaiPada, booking.selesaiPada, barberId);
  const usulan = await tx.usulanBarberBooking.create({ data: { bookingId: id, barberId, alasan, diusulkanOlehId: penggunaId } });
  await catat(tx, booking, "PROPOSE_BARBER", booking.status, { penggunaId }, { usulanId: usulan.id, barberId, alasan });
  return tx.booking.findUniqueOrThrow({ where: { id }, select: kolomBooking });
});

export const jawabUsulanBarber = (id: number, usulanId: number, pelangganId: number, akunPelangganId: number, setuju: boolean) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id, pelangganId);
  if (!["CONFIRMED", "CHECKED_IN"].includes(booking.status)) return tolak();
  const usulan = await tx.usulanBarberBooking.findFirst({ where: { id: usulanId, bookingId: id } });
  if (!usulan) return tolak("Usulan tidak ditemukan", 404);
  if (usulan.status !== "PENDING") return tolak();
  await pastikanCustomerAktif(tx, booking);
  if (setuju) await validasiSlot(tx, booking, booking.mulaiPada, booking.selesaiPada, usulan.barberId);
  const hasil = await tx.usulanBarberBooking.updateMany({ where: { id: usulanId, bookingId: id, status: "PENDING" },
    data: { status: setuju ? "ACCEPTED" : "REJECTED", diputuskanPada: new Date() } });
  if (hasil.count !== 1) return tolak();
  if (setuju) await tx.booking.update({ where: { id }, data: { barberDisetujuiId: usulan.barberId } });
  await catat(tx, booking, setuju ? "ACCEPT_BARBER" : "REJECT_BARBER", booking.status,
    { akunPelangganId }, { usulanId, barberId: usulan.barberId });
  return tx.booking.findUniqueOrThrow({ where: { id }, select: kolomBooking });
});

export const rescheduleBooking = (id: number, pelangganId: number, akunPelangganId: number, data: { mulaiPada: string; barberPilihanId?: number | null | undefined }) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id, pelangganId);
  if (booking.status !== "CONFIRMED" || booking.pesananId !== null) return tolak();
  const usulan = await tx.usulanBarberBooking.findFirst({ where: { bookingId: id }, orderBy: { id: "desc" } });
  if (usulan?.status !== "REJECTED" || !usulan.diputuskanPada || !booking.dikonfirmasiPada ||
      usulan.diputuskanPada < booking.dikonfirmasiPada) {
    return tolak("Reschedule ini hanya tersedia setelah menolak usulan barber pada konfirmasi saat ini");
  }
  await pastikanCustomerAktif(tx, booking);
  const mulai = new Date(data.mulaiPada);
  const selesai = validasiWaktuBooking(mulai, booking.durasiMenit);
  if (!selesai) return tolak("Waktu booking tidak memenuhi ketentuan operasional", 400);
  const barberId = data.barberPilihanId === undefined ? booking.barberPilihanId : data.barberPilihanId;
  await validasiSlot(tx, booking, mulai, selesai, barberId);
  await tx.booking.update({ where: { id }, data: { mulaiPada: mulai, selesaiPada: selesai, barberPilihanId: barberId,
    barberDisetujuiId: null, status: "PENDING_CONFIRMATION", deadlineDp: null, dikonfirmasiPada: null, diputuskanOlehId: null } });
  await catat(tx, booking, "RESCHEDULE", "PENDING_CONFIRMATION", { akunPelangganId }, {
    mulaiSebelum: booking.mulaiPada.toISOString(), mulaiSetelah: mulai.toISOString(),
    deadlineDpSebelum: booking.deadlineDp?.toISOString() ?? null,
  });
  return tx.booking.findUniqueOrThrow({ where: { id }, select: kolomBooking });
});

// Keputusan pengguna: check-in dan start wajib DP. F6 belum menyediakan bukti
// pembayaran; jangan menambah flag PAID, bypass atau endpoint pencatatan DP palsu.
export const checkInBooking = (id: number) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id);
  if (booking.status !== "CONFIRMED") return tolak();
  await pastikanCustomerAktif(tx, booking);
  return tolak("Check-in memerlukan bukti DP terverifikasi; integrasi pembayaran tersedia pada F6");
});
export const mulaiLayananBooking = (id: number, barberId: number) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id);
  if (booking.status !== "CHECKED_IN") return tolak("Booking belum check-in dengan prasyarat yang valid");
  await pastikanCustomerAktif(tx, booking);
  if (await tx.usulanBarberBooking.findFirst({ where: { bookingId: id, status: "PENDING" } })) return tolak("Usulan barber belum diputuskan customer");
  const pilihan = booking.barberDisetujuiId ?? booking.barberPilihanId;
  if (pilihan !== null && pilihan !== barberId) return tolak("Barber belum disetujui customer");
  await validasiSlot(tx, booking, booking.mulaiPada, booking.selesaiPada, barberId);
  return tolak("IN_SERVICE memerlukan bukti DP terverifikasi; integrasi pembayaran tersedia pada F6");
});
export const selesaikanBooking = (id: number, penggunaId: number) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id);
  if (booking.status !== "IN_SERVICE") return tolak();
  await tx.booking.update({ where: { id }, data: { status: "COMPLETED", layananSelesaiPada: new Date() } });
  await catat(tx, booking, "COMPLETE", "COMPLETED", { penggunaId });
  return tx.booking.findUniqueOrThrow({ where: { id }, select: kolomBooking });
});
export const ubahLayananBooking = (id: number) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id);
  if (booking.status !== "IN_SERVICE") return tolak();
  return tolak("Pembuatan Pesanan dan perubahan item booking ditunda sampai F6 sesuai kebijakan integrasi pembayaran");
});
