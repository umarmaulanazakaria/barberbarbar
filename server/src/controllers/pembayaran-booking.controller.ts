import type { Request, Response } from "express";
import { z } from "zod";
import { skemaKunciPembayaranBooking, skemaPelunasanBooking } from "../schemas/pembayaran-booking.schema.js";
import { KesalahanPembayaranBooking, ringkasanPembayaranBooking, buatIntentDpBooking,
  bayarPelunasanKasirBooking, finalisasiInvoiceBooking } from "../services/pembayaran-booking.service.js";
const id = (req: Request) => {
  const hasil = z.coerce.number().int().positive().safeParse(req.params.id);
  if (!hasil.success) throw new KesalahanPembayaranBooking(400, "ID booking tidak valid");
  return hasil.data;
};
const bungkus = (kerja: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
  try { return res.json(await kerja(req)); }
  catch (error) { if (error instanceof KesalahanPembayaranBooking) return res.status(error.kode).json({ pesan: error.pesan }); throw error; }
};
export const pembayaranCustomer = bungkus(async req => {
  if (!req.akunPelanggan) throw new KesalahanPembayaranBooking(401, "Customer belum login");
  const ringkasan = await ringkasanPembayaranBooking(id(req), req.akunPelanggan.pelangganId);
  const { pembayaranLegacyId: _internal, ...invoice } = ringkasan.invoice ?? {};
  return { ringkasan: { ...ringkasan, invoice: ringkasan.invoice ? invoice : null } };
});
export const intentDpCustomer = bungkus(async req => {
  if (!req.akunPelanggan) throw new KesalahanPembayaranBooking(401, "Customer belum login");
  const body = skemaKunciPembayaranBooking.safeParse(req.body);
  if (!body.success) throw new KesalahanPembayaranBooking(400, "Data payment intent tidak valid");
  return buatIntentDpBooking(id(req), req.akunPelanggan.pelangganId, body.data.kunciIdempotensi);
});
export const pembayaranOperator = bungkus(async req => ({ ringkasan: await ringkasanPembayaranBooking(id(req)) }));
export const pelunasanOperator = bungkus(async req => {
  if (!req.pengguna) throw new KesalahanPembayaranBooking(401, "Operator belum login");
  const body = skemaPelunasanBooking.safeParse(req.body);
  if (!body.success) throw new KesalahanPembayaranBooking(400, "Data pelunasan tidak valid; kasir tidak menerima DP booking");
  return bayarPelunasanKasirBooking(id(req), req.pengguna.id, body.data);
});
export const finalisasiInvoiceOperator = bungkus(async req => {
  if (!z.object({}).strict().safeParse(req.body ?? {}).success) throw new KesalahanPembayaranBooking(400, "Data finalisasi tidak valid");
  return { invoice: await finalisasiInvoiceBooking(id(req)) };
});
