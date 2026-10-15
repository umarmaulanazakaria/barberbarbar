import basisData from "../lib/prisma.js";
import type { Prisma, StatusBooking } from "../generated/prisma/client.js";
import { kunciJadwalBooking } from "../lib/transaksi-booking.js";
import { batasKonfirmasiBooking, menitKonfirmasi, menitNoShow, waktuDatabaseBooking } from "../lib/deadline-booking.js";
import { dpProviderSah, mintaRefundDalamTransaksi, sinkronkanDpUntukDeadline } from "./midtrans-booking.service.js";
import { ambilBookingPembayaran, bacaRingkasanPembayaran } from "./pembayaran-booking.service.js";

export type LogSchedulerBooking = {
  kejadian: "JOB" | "ERROR" | "SCAN";
  bookingId?: number;
  jenis?: string;
  deadline?: string;
  hasil?: string;
  kode?: string;
  kandidat?: number;
  berhasil?: number;
  gagal?: number;
};
export type PencatatSchedulerBooking = (data: LogSchedulerBooking) => void;
type OpsiPengujian = { sekarang?: Date; berhenti?: () => boolean; catat?: PencatatSchedulerBooking };
const kodeKesalahan = (error: unknown) => {
  if (typeof error === "object" && error !== null && "code" in error &&
      typeof error.code === "string" && /^P\d{4}$/.test(error.code)) return error.code;
  return "PEMROSESAN_GAGAL"; // Jangan mencetak pesan/provider payload/credential.
};
const catatRiwayat = async (tx: Prisma.TransactionClient, b: { id: number; status: StatusBooking },
  jenis: string, status: StatusBooking, deadline: Date, sekarang: Date, rincian: Prisma.InputJsonObject = {}) => {
  await tx.riwayatBooking.create({ data: { bookingId: b.id, aksi: jenis, statusSebelum: b.status, statusSetelah: status,
    dibuatPada: sekarang, rincian: { sumber: "SCHEDULER", deadline: deadline.toISOString(), ...rincian } } });
};

export const prosesDeadlineBooking = async (id: number, opsi: OpsiPengujian = {}) => {
  const waktuAwal = opsi.sekarang ?? await basisData.$transaction(waktuDatabaseBooking);
  // Provider mungkin sudah settlement meskipun webhook terlambat. Jangan
  // menahan lock/global slot selama request network, dan jangan mengirim refund.
  const sebelum = await basisData.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
    return tx.booking.findUnique({ where: { id }, select: { status: true, deadlineDp: true } });
  });
  if (sebelum?.status === "CONFIRMED" && sebelum.deadlineDp && sebelum.deadlineDp <= waktuAwal) {
    const pending = await basisData.transaksiPembayaranBooking.findMany({ where: { bookingId: id,
      kanal: "MIDTRANS", tujuan: "DP", status: "PENDING", referensiProvider: { not: null } }, select: { id: true } });
    for (const t of pending) {
      if (opsi.berhenti?.()) return null;
      try { await sinkronkanDpUntukDeadline(t.id); }
      catch { opsi.catat?.({ kejadian: "ERROR", bookingId: id, jenis: "DP_STATUS", kode: "PROVIDER_BELUM_TERVERIFIKASI" }); }
    }
  }
  if (opsi.berhenti?.()) return null;
  return basisData.$transaction(async tx => {
    await kunciJadwalBooking(tx);
    // State dan versi reschedule dibaca lagi setelah lock, bukan hasil scan.
    const b = await tx.booking.findUnique({ where: { id } });
    if (!b) return null;
    const sekarang = opsi.sekarang ?? await waktuDatabaseBooking(tx);
    let jenis: string;
    let deadline: Date;
    let status: StatusBooking;
    const rincian: Record<string, Prisma.InputJsonValue> = {};
    if (b.status === "PENDING_CONFIRMATION") {
      const batas = await batasKonfirmasiBooking(tx, b);
      deadline = batas.deadline;
      if (sekarang < deadline) return null;
      jenis = batas.versi ? "TIMEOUT_RESCHEDULE" : "TIMEOUT_CONFIRMATION";
      rincian.versiKonfirmasi = batas.versi;
      rincian.alasan = batas.versi ? "Reschedule tidak diputuskan dalam 30 menit" : "Booking tidak diputuskan dalam 30 menit";
      status = "CANCELLED";
    } else if (b.status === "CONFIRMED" && b.pesananId === null && b.checkInPada === null) {
      const dpSah = await dpProviderSah(tx, id);
      if (b.deadlineDp && sekarang >= b.deadlineDp && !dpSah) {
        deadline = b.deadlineDp;
        jenis = "TIMEOUT_DP";
        status = "CANCELLED";
        rincian.alasan = "DP belum sah dalam satu jam sejak konfirmasi";
        const belumFinal = await tx.transaksiPembayaranBooking.findMany({ where: { bookingId: id, tujuan: "DP", status: "PENDING" }, select: { id: true } });
        rincian.dpMenungguRekonsiliasi = belumFinal.map(t => t.id);
      } else {
        deadline = new Date(b.mulaiPada.getTime() + menitNoShow * 60_000);
        if (sekarang < deadline) return null;
        jenis = "AUTO_NO_SHOW";
        status = "NO_SHOW";
        rincian.alasan = "Customer belum check-in 15 menit setelah jadwal";
        rincian.dpHangus = true;
        rincian.kewajibanPelunasanDihentikan = true;
      }
    } else if (b.status === "COMPLETED") {
      const batas = b.deadlinePelunasan ?? (b.layananSelesaiPada ? new Date(b.layananSelesaiPada.getTime() + 3_600_000) : null);
      if (!batas || sekarang < batas) return null;
      if (await tx.riwayatBooking.findFirst({ where: { bookingId: id, aksi: "PAYMENT_OVERDUE" } })) return null;
      const ringkas = await bacaRingkasanPembayaran(tx, await ambilBookingPembayaran(tx, id), sekarang);
      if (ringkas.balance <= 0) return null;
      deadline = batas;
      jenis = "PAYMENT_OVERDUE";
      status = "COMPLETED";
      rincian.alasan = "Pelunasan masih bersaldo setelah satu jam";
      rincian.balance = ringkas.balance;
    } else return null;
    if (status !== b.status) {
      const hasil = await tx.booking.updateMany({ where: { id, status: b.status },
        data: { status, ...(status === "CANCELLED" ? { dibatalkanPada: sekarang } : {}) } });
      if (hasil.count !== 1) return null;
    }
    await catatRiwayat(tx, b, jenis, status, deadline, sekarang, rincian);
    if (status === "CANCELLED") {
      // Keputusan user: timeout sistem mengajukan 100% kredit DP terverifikasi,
      // tanpa batas jarak jadwal, tetap membutuhkan keputusan ADMIN.
      const paid = await tx.transaksiPembayaranBooking.aggregate({ where: { bookingId: id, tujuan: "DP", kanal: "MIDTRANS",
        status: "SUCCEEDED", buktiProvider: { metodeVerifikasi: "MIDTRANS_STATUS_V1" } }, _sum: { nominal: true } });
      await mintaRefundDalamTransaksi(tx, id, paid._sum.nominal ?? 0, `SYSTEM-TIMEOUT-${id}`, "Pembatalan sistem karena deadline terlewati", true);
    }
    return { bookingId: id, jenis, deadline: deadline.toISOString(), hasil: status };
  }, { isolationLevel: "ReadCommitted" });
};

// Clock injectable hanya parameter internal untuk test, tidak ada endpoint/env
// untuk memasukkan waktu client. Default selalu menggunakan waktu PostgreSQL.
export const pindaiDeadlineBooking = async (opsi: OpsiPengujian = {}) => {
  const sekarang = opsi.sekarang ?? await basisData.$transaction(waktuDatabaseBooking);
  const jumlah = { kandidat: 0, berhasil: 0, gagal: 0 };
  let terakhir = 0;
  while (!opsi.berhenti?.()) {
    const kandidat = await basisData.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
      return tx.booking.findMany({ where: { id: { gt: terakhir }, OR: [
      { status: "PENDING_CONFIRMATION", dibuatPada: { lte: new Date(sekarang.getTime() - menitKonfirmasi * 60_000) } },
      { status: "CONFIRMED", OR: [{ deadlineDp: { lte: sekarang } }, { mulaiPada: { lte: new Date(sekarang.getTime() - menitNoShow * 60_000) } }] },
      { status: "COMPLETED", invoice: { is: null }, riwayat: { none: { aksi: "PAYMENT_OVERDUE" } }, OR: [
        { deadlinePelunasan: { lte: sekarang } }, { deadlinePelunasan: null, layananSelesaiPada: { lte: new Date(sekarang.getTime() - 3_600_000) } },
      ] },
    ] }, select: { id: true }, orderBy: { id: "asc" }, take: 100 });
    });
    if (!kandidat.length) break;
    for (const b of kandidat) {
      if (opsi.berhenti?.()) break;
      terakhir = b.id;
      jumlah.kandidat++;
      try {
        const hasil = await prosesDeadlineBooking(b.id, opsi);
        if (hasil) { jumlah.berhasil++; opsi.catat?.({ kejadian: "JOB", ...hasil }); }
      } catch (error) {
        jumlah.gagal++;
        opsi.catat?.({ kejadian: "ERROR", bookingId: b.id, kode: kodeKesalahan(error) });
      }
    }
  }
  opsi.catat?.({ kejadian: "SCAN", ...jumlah });
  return jumlah;
};
