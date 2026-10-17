import { createHash, randomUUID } from "node:crypto";
import basisData from "../lib/prisma.js";
import type { Prisma, MetodePembayaran } from "../generated/prisma/client.js";
import { kunciJadwalBooking } from "../lib/transaksi-booking.js";
import { hitungUangBooking } from "../lib/uang-booking.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";

export class KesalahanPembayaranBooking extends Error {
  constructor(public kode: number, public pesan: string, public kodeKesalahan?: string) { super(pesan); }
}
const gagal = (pesan: string, kode = 409): never => { throw new KesalahanPembayaranBooking(kode, pesan); };
const hash = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
const kolomInvoice = { id: true, nomorInvoice: true, subtotal: true, discountPercent: true, diskon: true,
  total: true, dibuatPada: true, pembayaranLegacyId: true } as const;
const kolomTransaksi = { id: true, tujuan: true, kanal: true, status: true, nominal: true, mataUang: true,
  metode: true, jumlahDiterima: true, kembalian: true, dibuatPada: true, dibayarPada: true, deadlinePada: true } as const;
export const ambilBookingPembayaran = async (tx: Prisma.TransactionClient, id: number, pelangganId?: number) => {
  const booking = await tx.booking.findFirst({ where: { id, ...(pelangganId === undefined ? {} : { pelangganId }) },
    include: { items: true, pesanan: { include: { items: true } } } });
  if (!booking) return gagal("Booking tidak ditemukan", 404);
  if (booking.pesanan && booking.pesanan.pelangganId !== booking.pelangganId) return gagal("Relasi pesanan booking tidak valid");
  return booking;
};
const ambil = ambilBookingPembayaran;
type DataBooking = Awaited<ReturnType<typeof ambil>>;
export const bacaRingkasanPembayaran = async (tx: Prisma.TransactionClient, booking: DataBooking, waktuUji?: Date) => {
  const sekarang = waktuUji ?? await waktuDatabaseBooking(tx);
  const transaksi = await tx.transaksiPembayaranBooking.findMany({ where: { bookingId: booking.id }, include: { buktiProvider: true }, orderBy: { id: "asc" } });
  const valid = transaksi.filter(t => t.status === "SUCCEEDED" &&
    (t.kanal === "KASIR" ? t.tujuan === "PELUNASAN" && t.jumlahDiterima !== null && t.kembalian !== null :
      t.buktiProvider !== null && t.buktiProvider.referensiProvider === t.referensiProvider &&
      t.buktiProvider.nominal === t.nominal && t.buktiProvider.mataUang === "IDR"));
  const uang = hitungUangBooking(booking.pesanan?.items ?? booking.items, booking.discountPercent,
    valid.filter(t => t.tujuan !== "REFUND").map(t => t.nominal), valid.filter(t => t.tujuan === "REFUND").map(t => t.nominal));
  const dp = valid.filter(t => t.tujuan === "DP" && t.kanal === "MIDTRANS" &&
    (t.roundKonfirmasiPada?.getTime() === (booking.sumberBooking === "TAMU" ? booking.dibuatPada.getTime() : booking.dikonfirmasiPada?.getTime()) ||
      (booking.dpDibawaDariRound !== null && t.roundKonfirmasiPada?.getTime() === booking.dpDibawaDariRound.getTime())) &&
    t.dibayarPada && t.deadlinePada && t.dibayarPada <= t.deadlinePada);
  const dpTerverifikasi = dp.length > 0 && dp.reduce((n, t) => n + t.nominal, 0) >= booking.nominalDp;
  const deadline = booking.status === "COMPLETED" ? booking.deadlinePelunasan ??
    (booking.layananSelesaiPada ? new Date(booking.layananSelesaiPada.getTime() + 3600000) : null) : null;
  const syaratDpTerpenuhi = dpTerverifikasi || booking.memberBebasDp && !!booking.membershipBerbayarId && !!booking.identitasMemberPada;
  const paid = (valid.length > 0 || booking.memberBebasDp && uang.total === 0 && booking.status === "COMPLETED") && uang.balance === 0;
  const statusPembayaran = paid ? "PAID" : booking.status === "COMPLETED" && deadline && sekarang >= deadline ? "OVERDUE" :
    booking.status === "COMPLETED" ? uang.jumlahDibayar > 0 ? "PARTIALLY_PAID" : "UNPAID" : booking.memberBebasDp ? "MEMBER_CONFIRMED" : dpTerverifikasi ? "DP_PAID" : "AWAITING_DP";
  const invoice = await tx.invoiceBooking.findUnique({ where: { bookingId: booking.id }, select: kolomInvoice });
  const terminal = ["CANCELLED", "REJECTED", "NO_SHOW"].includes(booking.status);
  return { ...uang, nominalDp: booking.memberBebasDp ? 0 : uang.nominalDp, bebasDp: booking.memberBebasDp, syaratDpTerpenuhi, pembayaranPercobaan: process.env.MIDTRANS_IS_PRODUCTION === "false",
    balance: terminal ? 0 : uang.balance, kewajibanPelunasanDihentikan: terminal,
    nominalDpAwal: booking.nominalDp, dpTerverifikasi, deadlineDp: booking.deadlineDp,
    deadlinePelunasan: deadline, statusPembayaran: terminal ? (booking.memberBebasDp && uang.jumlahDibayar===0 ? "NO_PAYMENT_DUE" : booking.status === "NO_SHOW" || booking.status === "CANCELLED" && booking.dibatalkanPada &&
      booking.mulaiPada.getTime()-booking.dibatalkanPada.getTime()<3600000 ? "DP_FORFEITED" : "REFUND_REVIEW") : statusPembayaran,
    perluRefund: uang.kelebihan > 0,
    invoiceSementara: invoice === null, invoice,
    transaksi: transaksi.map(t => ({ id: t.id, tujuan: t.tujuan, kanal: t.kanal, status: t.status, nominal: t.nominal,
      mataUang: t.mataUang, metode: t.metode, jumlahDiterima: t.jumlahDiterima, kembalian: t.kembalian,
      dibuatPada: t.dibuatPada, dibayarPada: t.dibayarPada })) };
};
const bacaRingkasan = bacaRingkasanPembayaran;
export const ringkasanPembayaranBooking = (id: number, pelangganId?: number) => basisData.$transaction(async tx => {
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  return bacaRingkasan(tx, await ambil(tx, id, pelangganId));
}, { isolationLevel: "RepeatableRead" });

export const buatIntentDpBooking = (id: number, pelangganId: number, kunci: string) => basisData.$transaction(async tx => {
  await kunciJadwalBooking(tx);
  const booking = await ambil(tx, id, pelangganId);
  if (booking.status !== "CONFIRMED" || !booking.dikonfirmasiPada || !booking.deadlineDp) return gagal("DP hanya tersedia setelah booking dikonfirmasi");
  if (await waktuDatabaseBooking(tx) >= booking.deadlineDp) return gagal("Deadline DP telah lewat");
  if (booking.nominalDp <= 0) return gagal("DP bernilai nol memerlukan kebijakan provider F7; tidak ditandai paid otomatis");
  const ringkasan = await bacaRingkasan(tx, booking);
  if (ringkasan.dpTerverifikasi) return gagal("DP sudah terverifikasi");
  const aktif = await tx.transaksiPembayaranBooking.findFirst({ where: { bookingId: id, tujuan: "DP",
    roundKonfirmasiPada: booking.dikonfirmasiPada, status: { in: ["PENDING", "SUCCEEDED"] } }, select: kolomTransaksi });
  if (aktif) return { transaksi: aktif, integrasiProvider: "DEFERRED_F7" };
  const transaksi = await tx.transaksiPembayaranBooking.create({ data: { bookingId: id, tujuan: "DP", kanal: "MIDTRANS",
    nominal: booking.nominalDp, kunciIdempotensi: `DP:${id}:${booking.dikonfirmasiPada.toISOString()}:${kunci}`,
    sidikPermintaan: hash({ id, round: booking.dikonfirmasiPada.toISOString(), nominal: booking.nominalDp }),
    roundKonfirmasiPada: booking.dikonfirmasiPada, deadlinePada: booking.deadlineDp }, select: kolomTransaksi });
  return { transaksi, integrasiProvider: "DEFERRED_F7" };
}, { isolationLevel: "ReadCommitted" });

export const finalisasiInvoiceDalamTransaksi = async (tx: Prisma.TransactionClient, booking: DataBooking, ringkasan: Awaited<ReturnType<typeof bacaRingkasan>>, kembali: number) => {
  if (booking.status !== "COMPLETED" || ringkasan.statusPembayaran !== "PAID" || !ringkasan.syaratDpTerpenuhi) return gagal("Invoice final belum memenuhi prasyarat");
  const sudah = await tx.invoiceBooking.findUnique({ where: { bookingId: booking.id }, select: kolomInvoice });
  if (sudah) return sudah;
  const nomorInvoice = `INV-BKG-${randomUUID()}`;
  if(booking.memberBebasDp && ringkasan.total===0){
    if(booking.pesananId)await tx.pesanan.update({where:{id:booking.pesananId},data:{statusPembayaran:"PAID",invoiceManfaat:nomorInvoice}});
    return tx.invoiceBooking.create({data:{bookingId:booking.id,nomorInvoice,subtotal:0,discountPercent:0,diskon:0,total:0,jumlahDibayar:0n,kelebihan:0n},select:kolomInvoice});
  }
  let pembayaranLegacyId: number | null = null;
  if (booking.pesananId !== null) {
    if (booking.pesanan?.status !== "COMPLETED") return gagal("Layanan pesanan belum selesai");
    if (ringkasan.total + kembali > 2_147_483_647) return gagal("Nominal kuitansi melampaui representasi kasir existing", 400);
    // Artefak invoice legacy, bukan kredit kedua. Ledger adalah sumber paid amount.
    const legacy = await tx.pembayaran.create({ data: { pesananId: booking.pesananId, nomorInvoice, metode: "OTHER",
      jumlahDiterima: ringkasan.total + kembali, kembalian: kembali, catatan: "Invoice booking; riwayat DP/pelunasan pada ledger booking" } });
    pembayaranLegacyId = legacy.id;
    await tx.pesanan.update({ where: { id: booking.pesananId }, data: { statusPembayaran: "PAID",
      subtotal: ringkasan.subtotal, discountPercent: ringkasan.discountPercent, diskon: ringkasan.diskon, total: ringkasan.total } });
  }
  return tx.invoiceBooking.create({ data: { bookingId: booking.id, nomorInvoice, subtotal: ringkasan.subtotal,
    discountPercent: ringkasan.discountPercent, diskon: ringkasan.diskon, total: ringkasan.total,
    jumlahDibayar: BigInt(ringkasan.jumlahDibayar), kelebihan: BigInt(ringkasan.kelebihan), pembayaranLegacyId }, select: kolomInvoice });
};
const finalisasi = finalisasiInvoiceDalamTransaksi;

export const bayarPelunasanKasirBooking = (id: number, penggunaId: number, data: {
  metode: MetodePembayaran; jumlahDiterima: number; kunciIdempotensi: string; catatan?: string | undefined;
}, retry = true) => basisData.$transaction(tx => bayarPelunasanKasirDalamTransaksi(tx, id, penggunaId, data, retry), { isolationLevel: "ReadCommitted" });
export const bayarPelunasanKasirDalamTransaksi = async (tx: Prisma.TransactionClient, id: number, penggunaId: number, data: {
  metode: MetodePembayaran; jumlahDiterima: number; kunciIdempotensi: string; catatan?: string | undefined;
}, retry = true) => {
  await kunciJadwalBooking(tx);
  let booking = await ambil(tx, id);
  if (booking.pesananId !== null) {
    await tx.$queryRaw`SELECT "id" FROM "Pesanan" WHERE "id" = ${booking.pesananId} FOR UPDATE`;
    booking = await ambil(tx, id);
  }
  if (booking.status !== "COMPLETED" || (booking.pesanan && booking.pesanan.status !== "COMPLETED")) return gagal("Pelunasan hanya setelah layanan COMPLETED");
  const kunci = `KASIR:${id}:${data.kunciIdempotensi}`;
  const sidik = hash({ id, metode: data.metode, jumlahDiterima: data.jumlahDiterima, catatan: data.catatan ?? null });
  const sebelumnya = await tx.transaksiPembayaranBooking.findUnique({ where: { kunciIdempotensi: kunci } });
  if (sebelumnya && (!retry || sebelumnya.sidikPermintaan !== sidik)) return gagal("Pembayaran sudah diproses atau kunci digunakan untuk request berbeda");
  const ringkasan = await bacaRingkasan(tx, booking);
  if (!ringkasan.syaratDpTerpenuhi) return gagal("DP booking wajib bukti provider terverifikasi; kasir tidak boleh menerima DP manual");
  if (sebelumnya) return { transaksi: await tx.transaksiPembayaranBooking.findUniqueOrThrow({ where: { id: sebelumnya.id }, select: kolomTransaksi }), ringkasan };
  if (await tx.transaksiPembayaranBooking.count({ where: { bookingId: id, tujuan: {in:["DP","PELUNASAN"]}, kanal: "MIDTRANS", status: "PENDING" } })) {
    return gagal("Pelunasan online masih aktif; rekonsiliasi provider dahulu sebelum kasir");
  }
  if (ringkasan.balance === 0) return gagal("Pembayaran sudah lunas");
  if (!Number.isSafeInteger(data.jumlahDiterima) || data.jumlahDiterima < ringkasan.balance || data.jumlahDiterima > 2_147_483_647) return gagal("Jumlah diterima kurang atau tidak valid", 400);
  const kembali = data.jumlahDiterima - ringkasan.balance;
  const transaksi = await tx.transaksiPembayaranBooking.create({ data: { bookingId: id, tujuan: "PELUNASAN", kanal: "KASIR",
    status: "SUCCEEDED", nominal: ringkasan.balance, metode: data.metode, jumlahDiterima: data.jumlahDiterima,
    kembalian: kembali, kunciIdempotensi: kunci, sidikPermintaan: sidik, penggunaId, dibayarPada: await waktuDatabaseBooking(tx) }, select: kolomTransaksi });
  const sesudah = await bacaRingkasan(tx, booking);
  await finalisasi(tx, booking, sesudah, kembali);
  return { transaksi, ringkasan: await bacaRingkasan(tx, booking) };
};

export const finalisasiInvoiceBooking = (id: number) => basisData.$transaction(async tx => {
  await kunciJadwalBooking(tx); const booking = await ambil(tx, id);
  if (booking.pesananId !== null) await tx.$queryRaw`SELECT "id" FROM "Pesanan" WHERE "id" = ${booking.pesananId} FOR UPDATE`;
  return finalisasi(tx, await ambil(tx, id), await bacaRingkasan(tx, await ambil(tx, id)), 0);
}, { isolationLevel: "ReadCommitted" });
