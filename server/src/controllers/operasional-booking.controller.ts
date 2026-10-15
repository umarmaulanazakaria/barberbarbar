import type { Request, Response } from "express";
import type { ZodType } from "zod";
import { skemaIdBooking, skemaKosongBooking, skemaTolakBooking, skemaUsulanBarber, skemaMulaiBooking, skemaRescheduleBooking } from "../schemas/operasional-booking.schema.js";
import { KesalahanOperasionalBooking, daftarBookingOperator, detailBookingOperator, putuskanBooking, usulkanBarber,
  jawabUsulanBarber, rescheduleBooking, checkInBooking, mulaiLayananBooking, selesaikanBooking, ubahLayananBooking, batalkanBooking, tandaiNoShowBooking } from "../services/operasional-booking.service.js";
import { z } from "zod";
import { skemaBuatBooking } from "../schemas/booking.schema.js";
import { KesalahanPembayaranBooking } from "../services/pembayaran-booking.service.js";

const baca = <T>(skema: ZodType<T>, data: unknown): T => {
  const hasil = skema.safeParse(data);
  if (!hasil.success) throw new KesalahanOperasionalBooking(400, "Data operasi booking tidak valid");
  return hasil.data;
};
const id = (req: Request) => baca(skemaIdBooking, req.params.id);
const aktor = (req: Request) => {
  if (!req.pengguna) throw new KesalahanOperasionalBooking(401, "Operator belum login");
  return req.pengguna.id;
};
const customer = (req: Request) => {
  if (!req.akunPelanggan) throw new KesalahanOperasionalBooking(401, "Customer belum login");
  return req.akunPelanggan;
};
const bungkus = (operasi: (req: Request) => Promise<unknown>, daftar = false) => async (req: Request, res: Response) => {
  try { const hasil = await operasi(req); return res.json(daftar ? { data: hasil } : { booking: hasil }); }
  catch (error) {
    if (error instanceof KesalahanOperasionalBooking || error instanceof KesalahanPembayaranBooking) return res.status(error.kode).json({ pesan: error.pesan });
    throw error;
  }
};
export const daftarOperasionalBooking = bungkus(async () => daftarBookingOperator(), true);
export const detailOperasionalBooking = bungkus(async req => {
  const hasil = await detailBookingOperator(id(req));
  if (!hasil) throw new KesalahanOperasionalBooking(404, "Booking tidak ditemukan");
  return hasil;
});
export const konfirmasiOperasionalBooking = bungkus(async req => { baca(skemaKosongBooking, req.body ?? {}); return putuskanBooking(id(req), aktor(req), true); });
export const tolakOperasionalBooking = bungkus(async req => {
  const body = baca(skemaTolakBooking, req.body); return putuskanBooking(id(req), aktor(req), false, body.alasan);
});
export const usulanOperasionalBooking = bungkus(async req => {
  const body = baca(skemaUsulanBarber, req.body); return usulkanBarber(id(req), aktor(req), body.barberId, body.alasan);
});
const jawab = (setuju: boolean) => bungkus(async req => {
  baca(skemaKosongBooking, req.body ?? {}); const akun = customer(req);
  return jawabUsulanBarber(id(req), baca(skemaIdBooking, req.params.proposalId), akun.pelangganId, akun.id, setuju);
});
export const terimaUsulanCustomer = jawab(true);
export const tolakUsulanCustomer = jawab(false);
export const rescheduleCustomer = bungkus(async req => {
  const akun = customer(req); return rescheduleBooking(id(req), akun.pelangganId, akun.id, baca(skemaRescheduleBooking, req.body));
});
export const checkInOperasionalBooking = bungkus(async req => { baca(skemaKosongBooking, req.body ?? {}); return checkInBooking(id(req), aktor(req)); });
export const mulaiOperasionalBooking = bungkus(async req => { const body = baca(skemaMulaiBooking, req.body); return mulaiLayananBooking(id(req), body.barberId, aktor(req)); });
export const selesaiOperasionalBooking = bungkus(async req => { baca(skemaKosongBooking, req.body ?? {}); return selesaikanBooking(id(req), aktor(req)); });
export const ubahLayananOperasionalBooking = bungkus(async req => {
  const data=baca(z.object({items:skemaBuatBooking.shape.items}).strict(),req.body);
  return ubahLayananBooking(id(req),data.items,aktor(req));
});
export const batalkanCustomerBooking = bungkus(async req=>{baca(skemaKosongBooking,req.body??{}); const a=customer(req);return batalkanBooking(id(req),a.pelangganId,a.id);});
export const noShowOperasionalBooking = bungkus(async req=>{baca(skemaKosongBooking,req.body??{});return tandaiNoShowBooking(id(req),aktor(req));});
