import {kapasitasLintasBooking} from "../lib/kapasitas-lintas-booking.js";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import basisData from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { kunciJadwalBooking } from "../lib/transaksi-booking.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";
import { buatPemeriksaanPembayaran } from "../lib/pemeriksaan-pembayaran.js";
import { gerbangMidtrans, KesalahanMidtrans, merchantSandbox, skemaStatusMidtrans,
  verifikasiSignatureMidtrans, type StatusMidtrans } from "../lib/midtrans.js";
import { ambilBookingPembayaran, bacaRingkasanPembayaran, finalisasiInvoiceDalamTransaksi,
  KesalahanPembayaranBooking } from "./pembayaran-booking.service.js";

const gagal = (pesan: string, kode = 409): never => { throw new KesalahanPembayaranBooking(kode, pesan); };
const sidik = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
export const transaksiKeuanganBooking = <T>(kerja: (tx: Prisma.TransactionClient) => Promise<T>) => basisData.$transaction(async tx => {
  await kunciJadwalBooking(tx); return kerja(tx);
}, { isolationLevel: "ReadCommitted" });
const waktuProvider = (waktu: string) => {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(waktu)) return gagal("Waktu provider tidak valid", 400);
  const hasil = new Date(waktu.replace(" ", "T") + "+07:00");
  if (!Number.isFinite(hasil.getTime())) return gagal("Waktu provider tidak valid", 400);
  return hasil;
};
const nominal = (angka: string) => {
  const hasil = Number(angka);
  if (!Number.isSafeInteger(hasil) || hasil < 0) return gagal("Nominal provider tidak valid", 400);
  return hasil;
};
export const dpProviderSah = async (tx: Prisma.TransactionClient, bookingId: number) => {
  const booking = await ambilBookingPembayaran(tx, bookingId);
  const dp = await tx.transaksiPembayaranBooking.findMany({ where: { bookingId, tujuan: "DP", kanal: "MIDTRANS", status: "SUCCEEDED",
    buktiProvider: { metodeVerifikasi: "MIDTRANS_STATUS_V1" } }, include: { refund: { where: { status: "SUCCEEDED" } }, buktiProvider: true } });
  const sah = dp.filter(t => t.buktiProvider?.referensiProvider === t.referensiProvider && t.buktiProvider.nominal === t.nominal &&
    t.dibayarPada && t.deadlinePada && t.dibayarPada <= t.deadlinePada &&
    (t.roundKonfirmasiPada?.getTime() === (booking.sumberBooking === "TAMU" ? booking.dibuatPada.getTime() : booking.dikonfirmasiPada?.getTime()) ||
      (booking.dpDibawaDariRound !== null && t.roundKonfirmasiPada?.getTime() === booking.dpDibawaDariRound.getTime())));
  return sah.length > 0 && sah.reduce((n,t) => n + t.nominal - t.refund.reduce((r,f) => r + f.nominal, 0), 0) >= booking.nominalDp;
};
export const pastikanDpProviderSah = async (tx: Prisma.TransactionClient, bookingId: number) => {
  if (!await dpProviderSah(tx, bookingId)) return gagal("Layanan wajib bukti DP sah hasil verifikasi Midtrans");
};

export const buatSnapBooking = async (id: number, pelangganId: number, tujuan: "DP" | "PELUNASAN", key: string) => {
  merchantSandbox(); // fail closed sebelum mutasi saat konfigurasi salah
  const persiapan = await transaksiKeuanganBooking(async tx => {
    const booking = await ambilBookingPembayaran(tx, id, pelangganId);
    const sekarang = await waktuDatabaseBooking(tx);
    const ringkas = await bacaRingkasanPembayaran(tx, booking);
    if (tujuan === "DP") {
      if ((booking.sumberBooking === "TAMU" ? booking.status !== "AWAITING_DP" : booking.status !== "CONFIRMED" || !booking.dikonfirmasiPada) || !booking.deadlineDp || sekarang >= booking.deadlineDp) return gagal("DP di luar status/deadline konfirmasi");
      if (ringkas.dpTerverifikasi) return gagal("DP sudah dibayar");
    } else {
      if (booking.status !== "COMPLETED" || (booking.pesanan && booking.pesanan.status !== "COMPLETED")) return gagal("Pelunasan hanya setelah COMPLETED");
      await pastikanDpProviderSah(tx, id);
      if(await tx.transaksiPembayaranBooking.count({where:{bookingId:id,tujuan:"DP",status:"PENDING"}}))return gagal("DP lain masih pending; reconcile dahulu");
    }
    const jumlah = tujuan === "DP" ? booking.nominalDp : ringkas.balance;
    if (jumlah <= 0 || jumlah > 2147483647) return gagal("Nominal pembayaran tidak dapat diproses");
    const kunci = `ONLINE:${id}:${tujuan}:${key}`;
    const ulang = await tx.transaksiPembayaranBooking.findUnique({ where: { kunciIdempotensi: kunci }, include: { snap: true } });
    if (ulang && (ulang.bookingId !== id || ulang.tujuan !== tujuan || ulang.nominal !== jumlah || ulang.status !== "PENDING")) return gagal("Kunci pembayaran sudah digunakan");
    const aktif = ulang ?? await tx.transaksiPembayaranBooking.findFirst({ where: { bookingId: id, tujuan, kanal: "MIDTRANS", status: "PENDING",
      ...(tujuan === "DP" ? { roundKonfirmasiPada: booking.sumberBooking === "TAMU" ? booking.dibuatPada : booking.dikonfirmasiPada } : {}) }, include: { snap: true } });
    if (aktif?.referensiProvider?.startsWith("BBOPS-")) return gagal("QRIS operator masih aktif; rekonsiliasi transaksi tersebut dahulu");
    if (aktif?.snap) return { baru: false as const, attempt: aktif.snap, transaksiId: aktif.id };
    const ledger = aktif ?? await tx.transaksiPembayaranBooking.create({ data: { bookingId: id, tujuan, kanal: "MIDTRANS", nominal: jumlah,
      kunciIdempotensi: kunci, sidikPermintaan: sidik({ id, tujuan, jumlah }),
      ...(tujuan === "DP" ? { roundKonfirmasiPada: booking.sumberBooking === "TAMU" ? booking.dibuatPada : booking.dikonfirmasiPada, deadlinePada: booking.deadlineDp } : {}) } });
    const orderId = `BBF7-${tujuan}-${ledger.id}-${randomUUID().replaceAll("-","").slice(0,16)}`;
    await tx.transaksiPembayaranBooking.update({ where: { id: ledger.id }, data: { referensiProvider: orderId } });
    const attempt = await tx.percobaanSnapBooking.create({ data: { transaksiId: ledger.id, orderId } });
    return { baru: true as const, attempt, transaksiId: ledger.id, jumlah, guest: booking.sumberBooking === "TAMU", mulai: booking.dibuatPada, menit: tujuan === "DP" ? Math.max(1, Math.ceil((booking.deadlineDp!.getTime() - sekarang.getTime()) / 60000)) : 60 };
  });
  if (!persiapan.baru) {
    if (persiapan.attempt.status !== "READY") return gagal("Pembuatan Snap sedang diproses/belum pasti; lakukan sinkronisasi sebelum mengulang", 503);
    return { transaksiId: persiapan.transaksiId, token: persiapan.attempt.tokenSnap, redirect_url: persiapan.attempt.urlSnap };
  }
  try {
    const snap = await gerbangMidtrans.buatSnap({ transaction_details: { order_id: persiapan.attempt.orderId, gross_amount: persiapan.jumlah },
      expiry: persiapan.guest && tujuan === "DP" ? {start_time: new Date(persiapan.mulai.getTime()+7*3600000).toISOString().slice(0,19).replace("T"," ")+" +0700", unit:"minute",duration:15} : { unit: "minute", duration: persiapan.menit },
      ...(!persiapan.guest || tujuan !== "DP" ? {page_expiry:{unit:"minute" as const,duration:persiapan.menit}} : {}) });
    await transaksiKeuanganBooking(async tx => {
      const b=await ambilBookingPembayaran(tx,id);
      if(persiapan.guest&&tujuan==="DP"&&(b.status!=="AWAITING_DP"||!b.deadlineDp||await waktuDatabaseBooking(tx)>=b.deadlineDp))return gagal("Deadline booking telah berakhir; checkout tidak dibuka");
      return tx.percobaanSnapBooking.update({where:{id:persiapan.attempt.id},data:{status:"READY",tokenSnap:snap.token,urlSnap:snap.redirect_url}});
    });
    return { transaksiId: persiapan.transaksiId, ...snap };
  } catch(error) {
    await transaksiKeuanganBooking(tx => tx.percobaanSnapBooking.update({ where: { id: persiapan.attempt.id }, data: { status: "UNCERTAIN" } }));
    if(error instanceof KesalahanMidtrans)throw error;
    throw new KesalahanMidtrans(503, "Pembuatan Snap belum pasti; pembayaran tetap reserved untuk rekonsiliasi");
  }
};

// Setiap alokasi bersumber kredit sah. Permintaan aktif mereservasi hak refund.
export const mintaRefundDalamTransaksi = async (tx: Prisma.TransactionClient, bookingId: number, jumlah: number, sumber: string, alasan: string, hanyaDp = false) => {
  if (jumlah <= 0) return;
  const pembayaran = await tx.transaksiPembayaranBooking.findMany({ where: { bookingId, status: "SUCCEEDED", tujuan: hanyaDp ? "DP" : { in: ["DP","PELUNASAN"] } },
    include: { refund: { where: { status: "SUCCEEDED" } }, permohonanRefund: { where: { status: { notIn: ["REJECTED","SUCCEEDED"] } } } },
    orderBy: [{ kanal: "asc" }, { id: "asc" }] }); // enum MIDTRANS dahulu, kasir tidak dikirim ke provider
  for (const bayar of pembayaran) {
    if (jumlah <= 0) break;
    const sudah = bayar.refund.reduce((n,t) => n+t.nominal,0) + bayar.permohonanRefund.reduce((n,r) => n+r.nominal,0);
    const alokasi = Math.min(jumlah, bayar.nominal - sudah);
    if (alokasi <= 0) continue;
    const kunci = `${sumber}:${bayar.id}`;
    if (await tx.permohonanRefundBooking.findUnique({ where: { kunciSumber: kunci } })) continue;
    await tx.permohonanRefundBooking.create({ data: { bookingId, transaksiAsalId: bayar.id, kunciSumber: kunci, nominal: alokasi, alasan } });
    jumlah -= alokasi;
  }
};
export const mintaRefundKelebihan = async (tx: Prisma.TransactionClient, bookingId: number, sumber: string) => {
  const b = await ambilBookingPembayaran(tx, bookingId);
  const ringkas = await bacaRingkasanPembayaran(tx, b);
  const reserved = await tx.permohonanRefundBooking.aggregate({ where: { bookingId, status: { notIn: ["REJECTED","SUCCEEDED"] } }, _sum: { nominal: true } });
  await mintaRefundDalamTransaksi(tx, bookingId, Math.max(0, ringkas.kelebihan - (reserved._sum.nominal ?? 0)), sumber, "Kelebihan pembayaran dari total layanan");
};
const cocok = (data: StatusMidtrans, t: { nominal: number; referensiProvider: string | null; idTransaksiProvider: string | null }) => {
  if (data.merchant_id !== merchantSandbox() || data.order_id !== t.referensiProvider || nominal(data.gross_amount) !== t.nominal ||
    (t.idTransaksiProvider !== null && t.idTransaksiProvider !== data.transaction_id)) return gagal("Identitas/nominal provider tidak cocok", 400);
};
const catatRefundTerverifikasi = async (tx: Prisma.TransactionClient, t: { id: number; bookingId: number }, data: StatusMidtrans) => {
  for (const bukti of data.refunds ?? []) {
    if (!bukti.bank_confirmed_at || bukti.refund_method !== "online") continue;
    const req = await tx.permohonanRefundBooking.findFirst({ where: { transaksiAsalId: t.id, kunciSumber: { not: "" } },
      orderBy: { id: "asc" } });
    // refund_key adalah F7-REFUND-{id}; jangan mempercayai ID dari payload tanpa relasi.
    const id = /^F7-REFUND-(\d+)$/.exec(bukti.refund_key)?.[1];
    if (!id || !req) continue;
    const r = await tx.permohonanRefundBooking.findUnique({ where: { id: Number(id) } });
    if (!r || r.transaksiAsalId !== t.id || !r.diputuskanPada || !["APPROVED","PROCESSING","FAILED","SUCCEEDED"].includes(r.status)) continue;
    if (r.status === "SUCCEEDED") continue;
    if (nominal(bukti.refund_amount) !== r.nominal) return gagal("Nominal refund provider tidak cocok", 400);
    const ref = `${data.transaction_id}:refund:${bukti.refund_chargeback_id}`;
    const tr = await tx.transaksiPembayaranBooking.create({ data: { bookingId: t.bookingId, transaksiAsalId: t.id,
      tujuan: "REFUND", kanal: "MIDTRANS", status: "SUCCEEDED", nominal: r.nominal, dibayarPada: waktuProvider(bukti.bank_confirmed_at),
      referensiProvider: ref, kunciIdempotensi: bukti.refund_key, sidikPermintaan: sidik(bukti),
      buktiProvider: { create: { referensiProvider: ref, nominal: r.nominal, fingerprintPayload: sidik(bukti), terverifikasiPada: new Date(), metodeVerifikasi: "MIDTRANS_STATUS_V1" } } } });
    await tx.permohonanRefundBooking.update({ where: { id: r.id }, data: { status: "SUCCEEDED", transaksiRefundId: tr.id, kodeProvider: data.status_code, fingerprintProvider: sidik(data) } });
  }
};
const terapkanStatus = (data: StatusMidtrans, rekonsiliasiRefund = true, alokasiRefund = true) => transaksiKeuanganBooking(async tx => {
  const t = await tx.transaksiPembayaranBooking.findUnique({ where: { referensiProvider: data.order_id } });
  if (!t || t.kanal !== "MIDTRANS" || t.tujuan === "REFUND") return gagal("Transaksi provider tidak ditemukan", 404);
  cocok(data, t);
  let statusBaru = t.status;
  const berhasil = data.status_code === "200" && (data.transaction_status === "settlement" || data.transaction_status === "capture" && data.fraud_status === "accept" ||
    ["refund","partial_refund"].includes(data.transaction_status));
  if (berhasil && (data.payment_type !== "credit_card" || data.fraud_status === "accept")) {
    if (t.status !== "SUCCEEDED") {
      statusBaru = "SUCCEEDED";
      const dibayar = waktuProvider(data.settlement_time ?? data.transaction_time);
      await tx.transaksiPembayaranBooking.update({ where: { id: t.id }, data: { status: "SUCCEEDED", dibayarPada: dibayar,
        idTransaksiProvider: data.transaction_id, jenisPembayaranProvider: data.payment_type, statusProvider: data.transaction_status,
        buktiProvider: { create: { referensiProvider: data.order_id, nominal: t.nominal, fingerprintPayload: sidik(data),
          terverifikasiPada: new Date(), metodeVerifikasi: "MIDTRANS_STATUS_V1" } } } });
    } else await tx.transaksiPembayaranBooking.update({ where: { id: t.id }, data: { statusProvider: data.transaction_status } });
    if (rekonsiliasiRefund) await catatRefundTerverifikasi(tx, t, data);
    let b = await ambilBookingPembayaran(tx, t.bookingId);
    if(b.sumberBooking==="TAMU"&&t.tujuan==="DP"&&b.status==="AWAITING_DP"){
      const sekarang=await waktuDatabaseBooking(tx), dibayar=waktuProvider(data.settlement_time??data.transaction_time);
      const tepatWaktu=b.deadlineDp&&sekarang<b.deadlineDp&&dibayar<=b.deadlineDp&&dibayar.getTime()>=Math.floor(b.dibuatPada.getTime()/1000)*1000&&t.roundKonfirmasiPada?.getTime()===b.dibuatPada.getTime();
      const aktif=(await tx.pelanggan.findUnique({where:{id:b.pelangganId},select:{status:true}}))?.status==="AKTIF";
      if(tepatWaktu && aktif && await dpProviderSah(tx,b.id) && await kapasitasLintasBooking(tx,{mulaiPada:b.mulaiPada,selesaiPada:b.selesaiPada},{bookingId:b.id})){
        await tx.booking.update({where:{id:b.id},data:{status:"CONFIRMED",dikonfirmasiPada:sekarang}});
        await tx.riwayatBooking.create({data:{bookingId:b.id,aksi:"AUTO_CONFIRM_GUEST",statusSebelum:"AWAITING_DP",statusSetelah:"CONFIRMED",dibuatPada:sekarang,rincian:{sumber:"MIDTRANS_GET_STATUS",transaksiId:t.id}}});
      }else{
        await tx.booking.update({where:{id:b.id},data:{status:"CANCELLED",dibatalkanPada:sekarang}});
        await tx.riwayatBooking.create({data:{bookingId:b.id,aksi:tepatWaktu?"SYSTEM_GUEST_INELIGIBLE":"TIMEOUT_DP",statusSebelum:"AWAITING_DP",statusSetelah:"CANCELLED",dibuatPada:sekarang,rincian:{sumber:tepatWaktu?"GUEST_ELIGIBILITY_CHANGED":"GUEST_VERIFICATION_LATE"}}});
      }
      b=await ambilBookingPembayaran(tx,b.id);
    }
    const timeoutSistem = b.status === "CANCELLED" && await tx.riwayatBooking.findFirst({ where: { bookingId: b.id,
      aksi: { in: ["TIMEOUT_CONFIRMATION", "TIMEOUT_RESCHEDULE", "TIMEOUT_DP", "SYSTEM_GUEST_INELIGIBLE"] }, statusSetelah: "CANCELLED" }, select: { id: true } });
    if (alokasiRefund) {
    if (timeoutSistem && t.tujuan === "DP") {
      await mintaRefundDalamTransaksi(tx, b.id, t.nominal, `SYSTEM-TIMEOUT-${b.id}`, "DP terverifikasi setelah pembatalan sistem", true);
    } else if (b.status === "REJECTED" || b.status === "CANCELLED" && b.dibatalkanPada && b.mulaiPada.getTime()-b.dibatalkanPada.getTime() >= 3600000) {
      await mintaRefundDalamTransaksi(tx, b.id, t.nominal, `TERMINAL-${b.id}-${t.id}`, "Pembayaran booking yang dibatalkan tepat waktu/ditolak", true);
    } else if (t.tujuan === "DP" && t.deadlinePada && waktuProvider(data.settlement_time ?? data.transaction_time) > t.deadlinePada) {
      await mintaRefundDalamTransaksi(tx, b.id, t.nominal, `LATE-${t.id}`, "DP dibayar setelah deadline", true);
    } else {
      if(t.tujuan==="DP"){
        const dps=await tx.transaksiPembayaranBooking.findMany({where:{bookingId:b.id,tujuan:"DP",status:"SUCCEEDED",roundKonfirmasiPada:t.roundKonfirmasiPada},include:{refund:{where:{status:"SUCCEEDED"}}}});
        const reserved=await tx.permohonanRefundBooking.aggregate({where:{bookingId:b.id,transaksiAsal:{tujuan:"DP"},status:{notIn:["REJECTED","SUCCEEDED"]}},_sum:{nominal:true}});
        const berlebih=dps.reduce((n,d)=>n+d.nominal-d.refund.reduce((r,f)=>r+f.nominal,0),0)-Math.max(...dps.map(d=>d.nominal))-(reserved._sum.nominal??0);
        if(dps.length>1)await mintaRefundDalamTransaksi(tx,b.id,Math.max(0,berlebih),`DOUBLE-DP-${t.id}`,"Pembayaran DP ganda hasil rekonsiliasi provider",true);
      }
      await mintaRefundKelebihan(tx, b.id, `OVERPAY-${t.id}`);
    }
    }
    const ringkas = await bacaRingkasanPembayaran(tx, b);
    if (b.status === "COMPLETED" && ringkas.statusPembayaran === "PAID" && ringkas.dpTerverifikasi) await finalisasiInvoiceDalamTransaksi(tx, b, ringkas, 0);
  } else if (t.status === "PENDING") {
    const status = data.transaction_status === "expire" ? "EXPIRED" : ["deny","cancel","failure"].includes(data.transaction_status) ? "FAILED" : "PENDING";
    statusBaru = status;
    await tx.transaksiPembayaranBooking.update({ where: { id: t.id }, data: { status, statusProvider: data.transaction_status,
      idTransaksiProvider: data.transaction_id, jenisPembayaranProvider: data.payment_type } });
  }
  if (statusBaru !== t.status) {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: t.bookingId }, select: { status: true } });
    await tx.riwayatBooking.create({ data: { bookingId: t.bookingId, aksi: "PAYMENT_STATUS_VERIFIED",
      statusSebelum: booking.status, statusSetelah: booking.status,
      rincian: { transaksiId: t.id, tujuan: t.tujuan, nominal: t.nominal, statusSebelum: t.status,
        statusSetelah: statusBaru, sumber: "MIDTRANS_GET_STATUS" } } });
  }
  return { diterima: true };
});
const periksaPembayaran = buatPemeriksaanPembayaran<{ diterima: boolean }>();
const bacaStatusPembayaran = async (id: number, pelangganId: number | undefined, rekonsiliasiRefund: boolean) => {
  const t = await basisData.transaksiPembayaranBooking.findFirst({ where: { id, kanal: "MIDTRANS", tujuan: { not: "REFUND" },
    ...(pelangganId === undefined ? {} : { booking: { pelangganId } }) }, select: { referensiProvider: true } });
  if (!t?.referensiProvider) return gagal("Transaksi tidak ditemukan",404);
  const parsed = skemaStatusMidtrans.safeParse(await gerbangMidtrans.status(t.referensiProvider));
  if (!parsed.success) return gagal("Pembayaran belum dapat diverifikasi. Silakan coba lagi.",502);
  return terapkanStatus(parsed.data, rekonsiliasiRefund, rekonsiliasiRefund);
};
// Alur ADMIN/refund existing tetap membaca status provider terbaru.
export const sinkronkanPembayaranTamu = (id: number) => periksaPembayaran(id, () => bacaStatusPembayaran(id, undefined, true));
export const sinkronkanPembayaran = (id: number, pelangganId?: number) => bacaStatusPembayaran(id, pelangganId, true);
export const sinkronkanPembayaranPelanggan = async (id: number, pelangganId: number) => {
  // Periksa pemilik sebelum bergabung dengan request/cooldown transaksi yang sama.
  const milikSendiri = await basisData.transaksiPembayaranBooking.findFirst({ where: {
    id, kanal: "MIDTRANS", tujuan: { not: "REFUND" }, booking: { pelangganId },
  }, select: { id: true } });
  if (!milikSendiri) return gagal("Transaksi tidak ditemukan", 404);
  // Pemulihan customer hanya memverifikasi kredit; tidak membuat/merekonsiliasi
  // refund. Refund tetap melalui workflow keputusan ADMIN existing.
  return periksaPembayaran(id, () => bacaStatusPembayaran(id, pelangganId, false));
};
// Hanya kredit DP yang belum final; scanner tidak memproses refund provider.
// Panggilan jaringan dilakukan di luar lock transaksi jadwal.
export const sinkronkanDpUntukDeadline = async (id: number) => {
  const t = await basisData.transaksiPembayaranBooking.findFirst({ where: { id, kanal: "MIDTRANS", tujuan: "DP", status: "PENDING" },
    select: { referensiProvider: true } });
  if (!t?.referensiProvider) return;
  const parsed = skemaStatusMidtrans.safeParse(await gerbangMidtrans.status(t.referensiProvider));
  if (!parsed.success) return gagal("Status provider tidak memenuhi kontrak",502);
  return terapkanStatus(parsed.data, false);
};
const skemaNotifikasi = z.object({ order_id: z.string().min(1).max(128), transaction_id: z.string().min(1).max(128),
  merchant_id: z.string().min(1).max(128), status_code: z.string().regex(/^\d{3}$/),
  gross_amount: z.string().regex(/^\d+(\.00)?$/).max(30), signature_key: z.string().max(128) });
export const notifikasiMidtrans = async (body: unknown) => {
  const n = skemaNotifikasi.safeParse(body);
  if (!n.success) return gagal("Notifikasi tidak valid",400);
  if (!verifikasiSignatureMidtrans(n.data)) return gagal("Signature tidak valid",401);
  const t = await basisData.transaksiPembayaranBooking.findUnique({ where: { referensiProvider: n.data.order_id }, select: { id: true, nominal: true } });
  if (!t) return gagal("Transaksi tidak ditemukan",404);
  if (n.data.merchant_id !== merchantSandbox() || nominal(n.data.gross_amount) !== t.nominal) return gagal("Notifikasi tidak cocok",400);
  const p = skemaStatusMidtrans.safeParse(await gerbangMidtrans.status(n.data.order_id));
  if (!p.success || p.data.transaction_id !== n.data.transaction_id) return gagal("Identitas provider tidak cocok",400);
  return terapkanStatus(p.data);
};

export const kolomRefund = { id: true, bookingId: true, transaksiAsalId: true, nominal: true, alasan: true, status: true,
  dibuatPada: true, diputuskanPada: true, catatanKeputusan: true, kodeProvider: true } as const;
export const daftarRefund = (pelangganId?: number) => basisData.permohonanRefundBooking.findMany({
  where: pelangganId === undefined ? {} : { booking: { pelangganId } }, select: kolomRefund, orderBy: { id: "desc" } });
export const keputusanRefund = async (id: number, adminId: number, setuju: boolean, catatan: string) => {
  await transaksiKeuanganBooking(async tx => {
    if ((await tx.pengguna.findUnique({ where: { id: adminId }, select: { role: true } }))?.role !== "ADMIN") return gagal("Hanya ADMIN",403);
    const r = await tx.permohonanRefundBooking.findUnique({ where: { id } });
    if (!r) return gagal("Refund tidak ditemukan",404);
    if (r.status !== "PENDING_APPROVAL") return gagal("Refund sudah diputuskan");
    await tx.permohonanRefundBooking.update({ where: { id }, data: { status: setuju ? "APPROVED" : "REJECTED", diputuskanOlehId: adminId, diputuskanPada: new Date(), catatanKeputusan: catatan } });
  });
  if (setuju) return prosesRefund(id, adminId);
  return basisData.permohonanRefundBooking.findUniqueOrThrow({ where: { id }, select: kolomRefund });
};
export const prosesRefund = async (id: number, adminId: number) => {
  const r = await transaksiKeuanganBooking(async tx => {
    if ((await tx.pengguna.findUnique({ where: { id: adminId }, select: { role: true } }))?.role !== "ADMIN") return gagal("Hanya ADMIN",403);
    const data = await tx.permohonanRefundBooking.findUnique({ where: { id }, include: { transaksiAsal: true } });
    if (!data) return gagal("Refund tidak ditemukan",404);
    if (!["APPROVED","FAILED","PROCESSING"].includes(data.status)) return gagal("Refund tidak dapat diproses");
    if (data.transaksiAsal.kanal !== "MIDTRANS" || !data.transaksiAsal.referensiProvider ||
      !["credit_card","gopay","qris","dana","kredivo","akulaku","shopeepay","ovo"].includes(data.transaksiAsal.jenisPembayaranProvider ?? "") ||
      ["ovo","shopeepay"].includes(data.transaksiAsal.jenisPembayaranProvider ?? "") && data.nominal !== data.transaksiAsal.nominal) {
      await tx.permohonanRefundBooking.update({ where: { id }, data: { status: "UNSUPPORTED", kodeProvider: "REFUND_MANUAL_POLICY_REQUIRED" } });
      return null;
    }
    if (data.status === "PROCESSING") return { ...data, kirim: false };
    await tx.permohonanRefundBooking.update({ where: { id }, data: { status: "PROCESSING" } });
    return { ...data, kirim: true };
  });
  if (r) {
    try {
      await sinkronkanPembayaran(r.transaksiAsalId);
      const terbaru = await basisData.permohonanRefundBooking.findUniqueOrThrow({ where: { id } });
      if (terbaru.status !== "SUCCEEDED" && r.kirim) {
        const asal = skemaStatusMidtrans.parse(await gerbangMidtrans.status(r.transaksiAsal.referensiProvider!));
        cocok(asal, r.transaksiAsal);
        if (!["settlement","partial_refund"].includes(asal.transaction_status)) throw new KesalahanMidtrans(409,"Provider belum dalam status refundable");
        const response = await gerbangMidtrans.refund(r.transaksiAsal.idTransaksiProvider ?? r.transaksiAsal.referensiProvider!,
          { refund_key: `F7-REFUND-${id}`, amount: r.nominal, reason: r.alasan });
        const hasil = z.object({ status_code: z.string() }).safeParse(response);
        await transaksiKeuanganBooking(tx => tx.permohonanRefundBooking.update({ where: { id },
          data: { kodeProvider: hasil.success ? hasil.data.status_code : "UNCONFIRMED", fingerprintProvider: sidik(response) } }));
        await sinkronkanPembayaran(r.transaksiAsalId);
      }
    } catch {
      await transaksiKeuanganBooking(tx => tx.permohonanRefundBooking.updateMany({ where: { id, status: { not: "SUCCEEDED" } }, data: { status: "FAILED", kodeProvider: "RECONCILE_BEFORE_RETRY" } }));
    }
  }
  return basisData.permohonanRefundBooking.findUniqueOrThrow({ where: { id }, select: kolomRefund });
};
