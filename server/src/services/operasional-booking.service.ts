import { kapasitasLintasBooking } from "../lib/kapasitas-lintas-booking.js";
import { randomUUID } from "node:crypto";
import basisData from "../lib/prisma.js";
import { pastikanDpProviderSah, mintaRefundDalamTransaksi, mintaRefundKelebihan } from "./midtrans-booking.service.js";
import { hitungUangBooking } from "../lib/uang-booking.js";
import type { Booking, Prisma } from "../generated/prisma/client.js";
import { kapasitasBookingCukup, validasiWaktuBooking } from "../lib/jadwal-booking.js";
import { kunciJadwalBooking } from "../lib/transaksi-booking.js";
import { kolomBooking, statusMenahanBooking } from "./booking.service.js";
import { batasKonfirmasiBooking, menitNoShow, waktuDatabaseBooking } from "../lib/deadline-booking.js";

export class KesalahanOperasionalBooking extends Error {
  constructor(public kode: number, public pesan: string) { super(pesan); }
}
const tolak = (pesan = "Operasi booking tidak dapat diproses", kode = 409): never => { throw new KesalahanOperasionalBooking(kode, pesan); };
const ambil = async (tx: Prisma.TransactionClient, id: number, pelangganId?: number) => {
  const booking = await tx.booking.findFirst({ where: { id, ...(pelangganId === undefined ? {} : { pelangganId }) } });
  if (!booking) return tolak("Booking tidak ditemukan", 404);
  return booking;
};
const catat = async (tx: Prisma.TransactionClient, booking: Booking, aksi: string, status: Booking["status"],
  aktor: { penggunaId: number } | { akunPelangganId: number }, rincian?: Prisma.InputJsonObject) =>
  tx.riwayatBooking.create({ data: { bookingId: booking.id, aksi, statusSebelum: booking.status,
    statusSetelah: status, dibuatPada: await waktuDatabaseBooking(tx), ...aktor, ...(rincian === undefined ? {} : { rincian }) } });
const transaksiBooking = <T>(aksi: (tx: Prisma.TransactionClient) => Promise<T>) => basisData.$transaction(async tx => {
  await kunciJadwalBooking(tx);
  return aksi(tx);
}, { isolationLevel: "ReadCommitted" });
const validasiSlot = async (tx: Prisma.TransactionClient, booking: Booking, mulai: Date, selesai: Date, barberId: number | null) => {
  const aktif = await tx.barber.findMany({ where: { aktif: true }, select: { id: true } });
  if (barberId !== null && !aktif.some(b => b.id === barberId)) return tolak("Barber tidak tersedia");
  if (!await kapasitasLintasBooking(tx,{mulaiPada:mulai,selesaiPada:selesai},{bookingId:booking.id,pelangganId:booking.pelangganId,barberId})) return tolak("Jadwal booking tidak tersedia");
};
const pastikanCustomerAktif = async (tx: Prisma.TransactionClient, booking: Booking) => {
  const pelanggan = await tx.pelanggan.findUnique({ where: { id: booking.pelangganId }, select: { status: true } });
  if (pelanggan?.status !== "AKTIF") return tolak("Customer tidak aktif");
};

export const daftarBookingOperator = () => basisData.$transaction(async tx => {
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  return tx.booking.findMany({
  where: { status: { not: "AWAITING_DP" } },
  select: { ...kolomBooking, pelanggan: { select: { id: true, nama: true } }, aksesTamu:{select:{nama:true,nomorTelepon:true}} }, orderBy: { mulaiPada: "asc" },
  });
});
export const detailBookingOperator = (id: number) => basisData.$transaction(async tx => {
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  return tx.booking.findUnique({
  where: { id }, select: { ...kolomBooking, pelanggan: { select: { id: true, nama: true } }, aksesTamu:{select:{nama:true,nomorTelepon:true}} },
  });
});

export const putuskanBooking = (id: number, penggunaId: number, setuju: boolean, alasan?: string, waktuUji?: Date) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id);
  if (setuju ? booking.status !== "PENDING_CONFIRMATION" : !["PENDING_CONFIRMATION","CONFIRMED","CHECKED_IN"].includes(booking.status)) return tolak();
  if (!setuju && booking.status !== "PENDING_CONFIRMATION") await pastikanDpProviderSah(tx, id);
  const sekarang = waktuUji ?? await waktuDatabaseBooking(tx);
  if (booking.status === "PENDING_CONFIRMATION" && sekarang >= (await batasKonfirmasiBooking(tx, booking)).deadline) {
    return tolak("Batas waktu konfirmasi sudah terlewati");
  }
  if (setuju) {
    await pastikanCustomerAktif(tx, booking);
    if (booking.mulaiPada <= sekarang) return tolak("Jadwal booking sudah lewat");
    await validasiSlot(tx, booking, booking.mulaiPada, booking.selesaiPada, booking.barberDisetujuiId ?? booking.barberPilihanId);
  } else if (!alasan?.trim()) return tolak("Alasan penolakan wajib diisi", 400);
  const status = setuju ? "CONFIRMED" : "REJECTED";
  const deadline = setuju ? new Date(sekarang.getTime() + 3600000) : null;
  const klaim = await tx.booking.updateMany({ where: { id, status: booking.status }, data: {
    status, diputuskanOlehId: penggunaId, deadlineDp: deadline,
    ...(setuju ? { dikonfirmasiPada: sekarang } : { ditolakPada: sekarang, alasanPenolakan: alasan! }),
  } });
  if (klaim.count !== 1) return tolak();
  if (!setuju) {
    const jumlah = await tx.transaksiPembayaranBooking.aggregate({ where: { bookingId: id, tujuan: "DP", status: "SUCCEEDED" }, _sum: { nominal: true } });
    await mintaRefundDalamTransaksi(tx, id, jumlah._sum.nominal ?? 0, `REJECT-${id}`, "Booking dibayar kemudian ditolak", true);
  }
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

export const rescheduleBooking = (id: number, pelangganId: number, akunPelangganId: number, data: { mulaiPada: string; barberPilihanId?: number | null | undefined; items?: {layananId:number;qty:number}[] | undefined }) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id, pelangganId);
  if (booking.status !== "CONFIRMED" || booking.pesananId !== null) return tolak();
  const sekarang = await waktuDatabaseBooking(tx);
  if (booking.mulaiPada.getTime() - sekarang.getTime() < 3600000) {
    return tolak("Reschedule hanya dapat diajukan minimal 1 jam sebelum jadwal semula");
  }
  if (await tx.transaksiPembayaranBooking.count({ where: { bookingId: id, status: "PENDING" } })) return tolak("Rekonsiliasi payment pending sebelum reschedule");
  if (await tx.permohonanRefundBooking.count({ where: { bookingId: id, status: { notIn: ["REJECTED","SUCCEEDED"] } } })) return tolak("Refund masih aktif");
  const usulan = await tx.usulanBarberBooking.findFirst({ where: { bookingId: id }, orderBy: { id: "desc" } });
  if (usulan?.status !== "REJECTED" || !usulan.diputuskanPada || !booking.dikonfirmasiPada ||
      usulan.diputuskanPada < booking.dikonfirmasiPada) {
    return tolak("Reschedule ini hanya tersedia setelah menolak usulan barber pada konfirmasi saat ini");
  }
  await pastikanCustomerAktif(tx, booking);
  let pengganti: {layananId:number;namaLayanan:string;harga:number;durasiMenit:number;qty:number;subtotal:number}[] | undefined;
  if(data.items){
    const layanan=await tx.layanan.findMany({where:{id:{in:data.items.map(i=>i.layananId)},aktif:true}});
    if(layanan.length!==data.items.length)return tolak("Layanan tidak tersedia",400);
    pengganti=data.items.map(i=>{const l=layanan.find(l=>l.id===i.layananId)!;return{layananId:l.id,namaLayanan:l.nama,harga:l.harga,durasiMenit:l.durasiMenit,qty:i.qty,subtotal:l.harga*i.qty};});
  }
  const uangBaru=pengganti?hitungUangBooking(pengganti,booking.discountPercent):null;
  if(uangBaru && (uangBaru.subtotal>2147483647 || pengganti!.some(i=>i.subtotal>2147483647)))return tolak("Nominal melampaui batas",400);
  const durasi=pengganti?pengganti.reduce((n,i)=>n+i.durasiMenit*i.qty,0):booking.durasiMenit;
  const mulai = new Date(data.mulaiPada);
  const selesai = validasiWaktuBooking(mulai, durasi, sekarang);
  if (!selesai) return tolak("Waktu booking tidak memenuhi ketentuan operasional", 400);
  const barberId = data.barberPilihanId === undefined ? booking.barberPilihanId : data.barberPilihanId;
  await validasiSlot(tx, booking, mulai, selesai, barberId);
  const paid = await tx.transaksiPembayaranBooking.count({ where: { bookingId: id, tujuan: "DP", status: "SUCCEEDED", buktiProvider: { metodeVerifikasi: "MIDTRANS_STATUS_V1" } } });
  if (paid) await pastikanDpProviderSah(tx, id);
  if(paid && uangBaru){
    const tr=await tx.transaksiPembayaranBooking.findMany({where:{bookingId:id,status:"SUCCEEDED"}});
    const net=tr.reduce((n,t)=>n+(t.tujuan==="REFUND"?-t.nominal:t.nominal),0);
    if(net<uangBaru.nominalDp)return tolak("DP existing tidak cukup untuk layanan baru; jangan membuat tagihan pengganti tanpa rekonsiliasi");
  }
  if(pengganti){await tx.itemBooking.deleteMany({where:{bookingId:id}});await tx.itemBooking.createMany({data:pengganti.map(i=>({...i,bookingId:id}))});}
  await tx.booking.update({ where: { id }, data: { mulaiPada: mulai, selesaiPada: selesai, barberPilihanId: barberId,
    ...(uangBaru?{subtotal:uangBaru.subtotal,diskon:uangBaru.diskon,total:uangBaru.total,nominalDp:uangBaru.nominalDp,durasiMenit:durasi}:{}),
    barberDisetujuiId: null, status: "PENDING_CONFIRMATION", deadlineDp: null, dikonfirmasiPada: null, diputuskanOlehId: null,
    ...(paid ? { dpDibawaDariRound: booking.dpDibawaDariRound ?? booking.dikonfirmasiPada } : {}) } });
  await mintaRefundKelebihan(tx, id, `RESCHEDULE-${id}-${mulai.toISOString()}`);
  await catat(tx, booking, "RESCHEDULE", "PENDING_CONFIRMATION", { akunPelangganId }, {
    mulaiSebelum: booking.mulaiPada.toISOString(), mulaiSetelah: mulai.toISOString(),
    deadlineDpSebelum: booking.deadlineDp?.toISOString() ?? null,
  });
  return tx.booking.findUniqueOrThrow({ where: { id }, select: kolomBooking });
});

export const checkInBooking = (id: number, penggunaId?: number, waktuUji?: Date) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id);
  if (booking.status !== "CONFIRMED") return tolak();
  const sekarang = waktuUji ?? await waktuDatabaseBooking(tx);
  if (sekarang.getTime() >= booking.mulaiPada.getTime() + menitNoShow * 60_000) {
    return tolak("Batas waktu check-in sudah terlewati");
  }
  await pastikanCustomerAktif(tx, booking);
  await pastikanDpProviderSah(tx, id);
  if (!penggunaId) return tolak("Operator belum login",401);
  await tx.booking.update({ where: { id }, data: { status: "CHECKED_IN", checkInPada: sekarang } });
  await catat(tx, booking, "CHECK_IN", "CHECKED_IN", { penggunaId });
  return tx.booking.findUniqueOrThrow({ where: { id }, select: kolomBooking });
});
export const mulaiLayananBooking = (id: number, barberId: number, penggunaId?: number) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id);
  if (booking.status !== "CHECKED_IN") return tolak("Booking belum check-in dengan prasyarat yang valid");
  await pastikanCustomerAktif(tx, booking);
  if (await tx.usulanBarberBooking.findFirst({ where: { bookingId: id, status: "PENDING" } })) return tolak("Usulan barber belum diputuskan customer");
  const pilihan = booking.barberDisetujuiId ?? booking.barberPilihanId;
  if (pilihan !== null && pilihan !== barberId) return tolak("Barber belum disetujui customer");
  await validasiSlot(tx, booking, booking.mulaiPada, booking.selesaiPada, barberId);
  await pastikanDpProviderSah(tx, id);
  if (!penggunaId) return tolak("Operator belum login",401);
  if (booking.pesananId !== null || await tx.pesanan.count({ where: { barberId, status: "IN_SERVICE" } })) return tolak("Barber sedang melayani atau pesanan telah dibuat");
  const sumber = await tx.booking.findUniqueOrThrow({ where: { id }, include: { items: true } });
  const pesanan = await tx.pesanan.create({ data: { nomorPesanan: `ORD-BKG-${randomUUID()}`, pelangganId: booking.pelangganId,
    barberId, status: "IN_SERVICE", subtotal: booking.subtotal, discountPercent: booking.discountPercent, diskon: booking.diskon,
    total: booking.total, items: { create: sumber.items.map(({ layananId,namaLayanan,durasiMenit,harga,qty,subtotal }) =>
      ({ layananId,namaLayanan,durasiMenit,harga,qty,subtotal })) }, riwayatStatus: { create: { status: "IN_SERVICE", penggunaId } } } });
  await tx.booking.update({ where: { id }, data: { status: "IN_SERVICE", barberFinalId: barberId, pesananId: pesanan.id, layananMulaiPada: await waktuDatabaseBooking(tx) } });
  await catat(tx, booking, "START", "IN_SERVICE", { penggunaId }, { barberId, pesananId: pesanan.id });
  return tx.booking.findUniqueOrThrow({ where: { id }, select: kolomBooking });
});
export const selesaikanBooking = (id: number, penggunaId: number) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id);
  if (booking.status !== "IN_SERVICE") return tolak();
  const selesaiPada = await waktuDatabaseBooking(tx);
  await tx.booking.update({ where: { id }, data: { status: "COMPLETED", layananSelesaiPada: selesaiPada,
    deadlinePelunasan: new Date(selesaiPada.getTime() + 3600000) } });
  if (booking.pesananId !== null) {
    await tx.pesanan.update({ where: { id: booking.pesananId }, data: { status: "COMPLETED" } });
    await tx.riwayatStatusPesanan.create({ data: { pesananId: booking.pesananId, status: "COMPLETED", penggunaId } });
  }
  await catat(tx, booking, "COMPLETE", "COMPLETED", { penggunaId });
  return tx.booking.findUniqueOrThrow({ where: { id }, select: kolomBooking });
});
export const ubahLayananBooking = (id: number, items?: { layananId: number; qty: number }[], penggunaId?: number) => transaksiBooking(async tx => {
  const booking = await ambil(tx, id);
  if (booking.status !== "IN_SERVICE") return tolak();
  if (!booking.pesananId || !items || !penggunaId) return tolak("Perubahan layanan wajib pesanan booking dan data item valid");
  await pastikanDpProviderSah(tx, id);
  if (await tx.permohonanRefundBooking.count({ where: { bookingId: id, status: { notIn: ["REJECTED","SUCCEEDED"] } } })) return tolak("Refund masih aktif; putuskan/reconcile dahulu");
  if (await tx.transaksiPembayaranBooking.count({ where: { bookingId: id, status: "PENDING" } })) return tolak("Payment pending harus direkonsiliasi dahulu");
  const layanan = await tx.layanan.findMany({ where: { id: { in: items.map(i=>i.layananId) }, aktif: true } });
  if (layanan.length !== items.length) return tolak("Layanan tidak tersedia",400);
  const data = items.map(i => { const l=layanan.find(l=>l.id===i.layananId)!; return { layananId:l.id,namaLayanan:l.nama,harga:l.harga,durasiMenit:l.durasiMenit,qty:i.qty,subtotal:l.harga*i.qty }; });
  const uang = hitungUangBooking(data, booking.discountPercent);
  if (uang.subtotal > 2147483647 || data.some(i=>i.subtotal>2147483647)) return tolak("Nominal melampaui batas",400);
  await tx.$queryRaw`SELECT "id" FROM "Pesanan" WHERE "id" = ${booking.pesananId} FOR UPDATE`;
  const order = await tx.pesanan.findUniqueOrThrow({ where: { id: booking.pesananId } });
  if (order.status !== "IN_SERVICE" || order.statusPembayaran !== "UNPAID") return tolak();
  await tx.itemPesanan.deleteMany({ where: { pesananId: booking.pesananId } });
  await tx.itemPesanan.createMany({ data: data.map(i=>({ ...i,pesananId:booking.pesananId! })) });
  await tx.pesanan.update({ where:{id:booking.pesananId},data:{subtotal:uang.subtotal,diskon:uang.diskon,total:uang.total} });
  await mintaRefundKelebihan(tx,id,`SERVICE-${id}-${randomUUID()}`);
  await catat(tx,booking,"CHANGE_SERVICES",booking.status,{penggunaId},{total:uang.total});
  return tx.booking.findUniqueOrThrow({where:{id},select:kolomBooking});
});

export const batalkanBooking = (id: number, pelangganId: number, akunPelangganId: number) => transaksiBooking(async tx=>{
  const b=await ambil(tx,id,pelangganId);
  if (!["PENDING_CONFIRMATION","CONFIRMED","CHECKED_IN"].includes(b.status) || b.pesananId!==null) return tolak();
  const sekarang=await waktuDatabaseBooking(tx);
  await tx.booking.update({where:{id},data:{status:"CANCELLED",dibatalkanPada:sekarang}});
  if(b.mulaiPada.getTime()-sekarang.getTime()>=3600000){
    const paid=await tx.transaksiPembayaranBooking.aggregate({where:{bookingId:id,tujuan:"DP",status:"SUCCEEDED"},_sum:{nominal:true}});
    await mintaRefundDalamTransaksi(tx,id,paid._sum.nominal??0,`CANCEL-${id}`,"Customer cancel minimal satu jam sebelum jadwal",true);
  }
  await catat(tx,b,"CANCEL","CANCELLED",{akunPelangganId});
  return tx.booking.findUniqueOrThrow({where:{id},select:kolomBooking});
});
export const tandaiNoShowBooking = (id:number,penggunaId:number) => transaksiBooking(async tx=>{
  const b=await ambil(tx,id);
  if(b.status!=="CONFIRMED" || b.mulaiPada>await waktuDatabaseBooking(tx) || b.pesananId!==null) return tolak();
  await tx.booking.update({where:{id},data:{status:"NO_SHOW"}});
  await catat(tx,b,"NO_SHOW","NO_SHOW",{penggunaId});
  return tx.booking.findUniqueOrThrow({where:{id},select:kolomBooking});
});
