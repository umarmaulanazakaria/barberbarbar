import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import basisData from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { kunciJadwalBooking } from "../lib/transaksi-booking.js";
import { waktuDatabaseBooking } from "../lib/deadline-booking.js";
import { penyimpananPembayaranSiap } from "../lib/reservasi-pembayaran.js";
import { gerbangMidtrans, merchantSandbox, verifikasiSignatureMidtrans } from "../lib/midtrans.js";
import { gerbangQris, lengkapiGambarQris, skemaStatusQris, urlQrisAman, KesalahanChargeQris } from "../lib/qris-midtrans.js";
import { buatPemeriksaanPembayaran } from "../lib/pemeriksaan-pembayaran.js";
import { ambilBookingPembayaran, bacaRingkasanPembayaran, bayarPelunasanKasirDalamTransaksi, KesalahanPembayaranBooking } from "./pembayaran-booking.service.js";
import { pastikanDpProviderSah, sinkronkanPembayaran } from "./midtrans-booking.service.js";
import { bayarWalkInDalamTransaksi } from "./pesanan.service.js";

const gagal = (pesan: string, kode = 409): never => { throw new KesalahanPembayaranBooking(kode, pesan); };
const sidik = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
const sinyal = async (tx: Prisma.TransactionClient, pesananId: number) => {
  await tx.$queryRaw`SELECT pg_notify('barberbarbar_realtime', json_build_object(
    'jenis','order.changed','id',${pesananId}::integer,'aksi','PAYMENT_OPERATOR_CHANGED',
    'pelangganId',(SELECT "pelangganId" FROM "Pesanan" WHERE id=${pesananId}),
    'operator','ALL','versi',txid_current()::text,'waktu',CURRENT_TIMESTAMP::text,'refetch',true)::text)::text`;
};
const kolom = { id: true, metode: true, status: true, nominal: true, referensi: true, urlQris: true, kedaluwarsaPada: true,
  statusProvider: true, faseProvider: true, dibuatPada: true, dibayarPada: true, pengguna: { select: { name: true } } } as const;
const transaksi = <T>(kerja: (tx: Prisma.TransactionClient) => Promise<T>) => basisData.$transaction(async tx => {
  await kunciJadwalBooking(tx);
  if (!await penyimpananPembayaranSiap(tx)) return gagal("Penyimpanan pembayaran operasional belum diaktifkan", 503);
  return kerja(tx);
}, { isolationLevel: "ReadCommitted", timeout: 15000, maxWait: 15000 });
const pesananTerkunci = async (tx: Prisma.TransactionClient, id: number) => {
  await tx.$queryRaw`SELECT id FROM "Pesanan" WHERE id=${id} FOR UPDATE`;
  const p = await tx.pesanan.findUnique({ where: { id }, include: { booking: true, pembayaran: true } });
  if (!p) return gagal("Pesanan tidak ditemukan", 404);
  return p;
};
type PesananTerkunci = Awaited<ReturnType<typeof pesananTerkunci>>;
const tagihan = async (tx: Prisma.TransactionClient, p: PesananTerkunci) => {
  if (p.status !== "COMPLETED") return gagal("Pembayaran hanya setelah pelayanan selesai");
  if (p.booking) {
    if (p.booking.status !== "COMPLETED") return gagal("Pelayanan booking belum selesai");
    await pastikanDpProviderSah(tx, p.booking.id);
    return (await bacaRingkasanPembayaran(tx, await ambilBookingPembayaran(tx, p.booking.id))).balance;
  }
  return p.statusPembayaran === "PAID" && p.pembayaran ? 0 : p.total;
};
export const skemaBayarOperasional = z.object({
  metode: z.enum(["CASH", "TRANSFER", "QRIS"]), kunciIdempotensi: z.string().uuid(),
  tagihanDiharapkan: z.number().int().positive().max(2147483647),
  diterima: z.literal(true).optional(), jumlahDiterima: z.number().int().positive().max(2147483647).optional(),
  referensi: z.string().trim().min(3).max(300).optional(),
}).strict().refine(d => d.metode === "QRIS" ? d.diterima === undefined && d.jumlahDiterima === undefined && d.referensi === undefined :
  d.diterima === true && d.jumlahDiterima !== undefined && (d.metode !== "TRANSFER" || d.referensi !== undefined), "Konfirmasi penerimaan dana dan referensi transfer wajib diisi");
type DataBayar = z.infer<typeof skemaBayarOperasional>;
export const daftarPembayaranOperasional = (pesananId: number) => transaksi(async tx => {
  if (!await tx.pesanan.findUnique({ where: { id: pesananId }, select: { id: true } })) return gagal("Pesanan tidak ditemukan", 404);
  return { transaksi: await tx.pembayaranOperasional.findMany({ where: { pesananId }, select: kolom, orderBy: { id: "desc" } }) };
});
const dto = (id: number) => transaksi(async tx => ({ transaksi: await tx.pembayaranOperasional.findUniqueOrThrow({ where: { id }, select: kolom }) }));
export const buatPembayaranOperasional = async (pesananId: number, penggunaId: number, data: DataBayar) => {
  if (data.metode === "QRIS") merchantSandbox();
  const fingerprint = sidik({ pesananId, penggunaId, ...data });
  const hasil = await transaksi(async tx => {
    const p = await pesananTerkunci(tx, pesananId);
    const ulang = await tx.pembayaranOperasional.findUnique({ where: { kunciIdempotensi: data.kunciIdempotensi } });
    if (ulang) {
      if (ulang.sidikPermintaan !== fingerprint) return gagal("Kunci pembayaran digunakan untuk permintaan berbeda");
      return { id: ulang.id, baru: false, orderId: ulang.providerOrderId, nominal: ulang.nominal };
    }
    const aktif = await tx.pembayaranOperasional.findFirst({ where: { pesananId, status: "PENDING" } });
    if (aktif) {
      if (data.metode === "QRIS" && aktif.metode === "QRIS") return { id: aktif.id, baru: false, orderId: aktif.providerOrderId, nominal: aktif.nominal };
      return gagal("Transaksi QRIS masih aktif. Rekonsiliasi provider sebelum menerima pembayaran lain");
    }
    const nominal = await tagihan(tx, p);
    if (nominal <= 0 || nominal > 2147483647) return gagal("Tagihan sudah lunas atau nominal tidak dapat diproses");
    if (nominal !== data.tagihanDiharapkan) return gagal("Tagihan telah berubah. Muat ulang rincian sebelum membayar");
    if (p.booking && await tx.transaksiPembayaranBooking.count({ where: { bookingId: p.booking.id, tujuan: { in: ["DP", "PELUNASAN"] }, status: "PENDING" } })) return gagal("Transaksi online Booking masih aktif. Rekonsiliasi dahulu");
    if (data.metode !== "QRIS") {
      if (data.jumlahDiterima! < nominal || data.metode === "TRANSFER" && data.jumlahDiterima !== nominal) return gagal("Pembayaran harus mencakup seluruh sisa tagihan", 400);
      const catatan = `Operator ${penggunaId}; ${data.metode === "TRANSFER" ? `transfer diperiksa: ${data.referensi}` : "uang tunai diterima"}`;
      let pembayaranId: number, transaksiBookingId: number | null = null;
      if (p.booking) {
        const r = await bayarPelunasanKasirDalamTransaksi(tx, p.booking.id, penggunaId, { metode: data.metode, jumlahDiterima: data.jumlahDiterima!, kunciIdempotensi: data.kunciIdempotensi, catatan });
        transaksiBookingId = r.transaksi.id;
        pembayaranId = (await tx.pembayaran.findUniqueOrThrow({ where: { pesananId } })).id;
      } else {
        const r = await bayarWalkInDalamTransaksi(tx, pesananId, { metode: data.metode, jumlahDiterima: data.jumlahDiterima!, catatan });
        if (r.tipe !== "BERHASIL") return gagal("Pembayaran sudah diproses atau tagihan tidak valid");
        pembayaranId = r.data.pembayaran.id;
      }
      const t = await tx.pembayaranOperasional.create({ data: { pesananId, penggunaId, metode: data.metode, nominal, status: "SUCCEEDED", jumlahDiterima: data.jumlahDiterima!,
        kembalian: data.jumlahDiterima! - nominal, referensi: data.referensi ?? null, kunciIdempotensi: data.kunciIdempotensi, sidikPermintaan: fingerprint,
        pembayaranId, transaksiBookingId, dibayarPada: await waktuDatabaseBooking(tx) } });
      await sinyal(tx, pesananId);
      return { id: t.id, baru: false, orderId: null, nominal };
    }
    const orderId = `BBOPS-${randomUUID()}`;
    const ledger = p.booking ? await tx.transaksiPembayaranBooking.create({ data: { bookingId: p.booking.id, tujuan: "PELUNASAN", kanal: "MIDTRANS", nominal,
      referensiProvider: orderId, kunciIdempotensi: `OPERATOR:${data.kunciIdempotensi}`, sidikPermintaan: fingerprint, penggunaId } }) : null;
    const t = await tx.pembayaranOperasional.create({ data: { pesananId, penggunaId, metode: "QRIS", nominal, kunciIdempotensi: data.kunciIdempotensi,
      sidikPermintaan: fingerprint, providerOrderId: orderId, faseProvider: "CREATING", transaksiBookingId: ledger?.id ?? null } });
    await sinyal(tx, pesananId);
    return { id: t.id, baru: true, orderId, nominal };
  });
  if (hasil.baru) {
    try {
      const p = skemaStatusQris.parse(await gerbangQris.buat(hasil.orderId!, hasil.nominal));
      if (p.order_id !== hasil.orderId || p.merchant_id !== merchantSandbox() || Number(p.gross_amount) !== hasil.nominal || p.payment_type !== "qris") throw new Error("RESPONS_QRIS_TIDAK_COCOK");
      await simpanHasilProvider(hasil.id, await lengkapiGambarQris(p), true);
    } catch (e) {
      await transaksi(async tx => {
        const t = await tx.pembayaranOperasional.findUniqueOrThrow({ where: { id: hasil.id } });
        if (t.status !== "PENDING" || t.faseProvider === "READY") return;
        const pasti = e instanceof KesalahanChargeQris && e.pastiDitolak;
        await tx.pembayaranOperasional.update({ where: { id: t.id }, data: { faseProvider: pasti ? "REJECTED" : "UNCERTAIN", status: pasti ? "FAILED" : "PENDING", statusProvider: pasti ? "DITOLAK_PROVIDER" : null } });
        if (pasti && t.transaksiBookingId) await tx.transaksiPembayaranBooking.update({ where: { id: t.transaksiBookingId }, data: { status: "FAILED", statusProvider: "DITOLAK_PROVIDER" } });
        await sinyal(tx, t.pesananId);
      });
    }
  }
  return dto(hasil.id);
};

const waktuProvider = (nilai: string) => {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(nilai)) return gagal("Waktu provider tidak valid", 502);
  const d = new Date(nilai.replace(" ", "T") + "+07:00");
  if (!Number.isFinite(d.getTime())) return gagal("Waktu provider tidak valid", 502);
  return d;
};
type StatusQris = z.infer<typeof skemaStatusQris>;
const simpanHasilProvider = (id: number, data: StatusQris, dariCharge = false) => transaksi(async tx => {
  const t = await tx.pembayaranOperasional.findUniqueOrThrow({ where: { id } });
  const p = await pesananTerkunci(tx, t.pesananId);
  const simpan = async (data: Prisma.PembayaranOperasionalUncheckedUpdateInput) => {
    const hasil = await tx.pembayaranOperasional.update({ where: { id }, data });
    await sinyal(tx, p.id);
    return hasil;
  };
  if (t.metode !== "QRIS" || data.order_id !== t.providerOrderId || data.merchant_id !== merchantSandbox() || data.currency !== "IDR" ||
    Number(data.gross_amount) !== t.nominal || data.payment_type !== "qris" || t.providerTransactionId !== null && t.providerTransactionId !== data.transaction_id) return gagal("Identitas atau nominal QRIS provider tidak cocok", 400);
  const action = data.actions?.find(a => a.name === "generate-qr-code-v2" && a.method === "GET") ?? data.actions?.find(a => a.name === "generate-qr-code" && a.method === "GET");
  const dasar = { providerTransactionId: data.transaction_id, statusProvider: data.transaction_status,
    ...(action && urlQrisAman(action.url) ? { urlQris: action.url } : {}), ...(data.expiry_time ? { kedaluwarsaPada: waktuProvider(data.expiry_time) } : {}), faseProvider: "READY" };
  // Respons charge hanya menyiapkan QR; kredit wajib Get Status/webhook.
  if (dariCharge) return simpan(dasar);
  if (t.status === "SUCCEEDED") return t;
  const sukses = data.status_code === "200" && data.transaction_status === "settlement" && (!data.fraud_status || data.fraud_status === "accept");
  if (sukses) {
    if (p.booking) {
      const ledger = t.transaksiBookingId && await tx.transaksiPembayaranBooking.findUnique({ where: { id: t.transaksiBookingId }, include: { buktiProvider: true } });
      if (!ledger || ledger.status !== "SUCCEEDED" || !ledger.buktiProvider || p.statusPembayaran !== "PAID" || !p.pembayaran) return gagal("Ledger Booking belum memverifikasi pembayaran");
    } else {
      if (await tagihan(tx, p) !== t.nominal || await tx.pembayaranOperasional.count({ where: { pesananId: p.id, status: "PENDING", id: { not: id } } })) {
        // Bukti sah dipertahankan, tetapi jangan menambah kuitansi/kredit ganda.
        return simpan({ ...dasar, faseProvider: "REVIEW", buktiHash: sidik(data), terverifikasiPada: await waktuDatabaseBooking(tx) });
      }
      const r = await bayarWalkInDalamTransaksi(tx, p.id, { metode: "QRIS", jumlahDiterima: t.nominal, catatan: `QRIS terverifikasi Midtrans; operator ${t.penggunaId}` }, id);
      if (r.tipe !== "BERHASIL") return gagal("Pembayaran Walk-in berkonflik");
    }
    const pembayaran = await tx.pembayaran.findUniqueOrThrow({ where: { pesananId: p.id } });
    return simpan({ ...dasar, status: "SUCCEEDED", pembayaranId: pembayaran.id,
      dibayarPada: waktuProvider(data.settlement_time ?? data.transaction_time), terverifikasiPada: await waktuDatabaseBooking(tx), buktiHash: sidik(data) });
  }
  return simpan({ ...dasar, status: data.transaction_status === "expire" ? "EXPIRED" : ["deny", "cancel", "failure"].includes(data.transaction_status) ? "FAILED" : t.status });
});
const verifikasi = async (id: number, transactionId?: string) => {
  const t = await basisData.pembayaranOperasional.findUnique({ where: { id } });
  if (!t || t.metode !== "QRIS" || !t.providerOrderId) return gagal("Transaksi QRIS tidak ditemukan", 404);
  const p = skemaStatusQris.safeParse(await gerbangMidtrans.status(t.providerOrderId));
  if (!p.success || transactionId && transactionId !== p.data.transaction_id) return gagal("Status provider tidak cocok", 400);
  if (p.data.order_id !== t.providerOrderId || p.data.merchant_id !== merchantSandbox() || Number(p.data.gross_amount) !== t.nominal || p.data.payment_type !== "qris" || t.providerTransactionId && p.data.transaction_id !== t.providerTransactionId) return gagal("Identitas atau nominal provider tidak cocok", 400);
  // Layanan Booking existing tetap satu-satunya penulis kredit/invoice Booking.
  if (t.transaksiBookingId) await sinkronkanPembayaran(t.transaksiBookingId);
  await simpanHasilProvider(id, await lengkapiGambarQris(p.data, t.urlQris));
  return dto(id);
};
const pemeriksaan = buatPemeriksaanPembayaran<Awaited<ReturnType<typeof verifikasi>>>();
export const sinkronPembayaranOperasional = async (pesananId: number, id: number) => {
  if (!await basisData.pembayaranOperasional.findFirst({ where: { id, pesananId, metode: "QRIS" }, select: { id: true } })) return gagal("Transaksi tidak ditemukan", 404);
  return pemeriksaan(id, () => verifikasi(id));
};
export const webhookPembayaranOperasional = async (body: unknown) => {
  const p = z.object({ order_id: z.string().max(128), transaction_id: z.string().max(128), merchant_id: z.string().max(128),
    status_code: z.string().regex(/^\d{3}$/), gross_amount: z.string().regex(/^\d+(\.00)?$/).max(30), signature_key: z.string().regex(/^[a-f0-9]{128}$/i) }).safeParse(body);
  if (!p.success) return gagal("Notifikasi tidak valid", 400);
  if (!verifikasiSignatureMidtrans(p.data)) return gagal("Signature tidak valid", 401);
  const t = await basisData.pembayaranOperasional.findUnique({ where: { providerOrderId: p.data.order_id } });
  if (!t || t.nominal !== Number(p.data.gross_amount) || p.data.merchant_id !== merchantSandbox()) return gagal("Notifikasi tidak cocok", 400);
  // Webhook melewati cooldown agar notifikasi settlement tidak mendapat cache Pending.
  await verifikasi(t.id, p.data.transaction_id);
  return { diterima: true };
};
