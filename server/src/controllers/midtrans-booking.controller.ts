import type { Request, Response } from "express";
import { z } from "zod";
import { KesalahanMidtrans } from "../lib/midtrans.js";
import { KesalahanPembayaranBooking } from "../services/pembayaran-booking.service.js";
import { skemaKunciPembayaranBooking } from "../schemas/pembayaran-booking.schema.js";
import { buatSnapBooking, notifikasiMidtrans, sinkronkanPembayaranPelanggan, daftarRefund, keputusanRefund, prosesRefund } from "../services/midtrans-booking.service.js";
const baca = <T>(skema:z.ZodType<T>,data:unknown):T=>{
 const v=skema.safeParse(data);if(!v.success)throw new KesalahanPembayaranBooking(400,"Data request tidak valid");return v.data;
};
const id=(req:Request)=>baca(z.coerce.number().int().positive().max(2147483647),req.params.id);
const bungkus=(aksi:(req:Request)=>Promise<unknown>)=>async(req:Request,res:Response)=>{
 res.set("Cache-Control","no-store");
 try{return res.json(await aksi(req));}catch(err){
  if(err instanceof KesalahanPembayaranBooking || err instanceof KesalahanMidtrans)return res.status(err.kode).json({pesan:err.message});
  // Jangan mengirim/log objek SDK/Prisma yang mungkin memuat auth atau Snap token.
  return res.status(503).json({pesan:"Operasi pembayaran belum dapat dipastikan; ulangi rekonsiliasi dengan identitas yang sama"});
 }
};
export const snapCustomer=(tujuan:"DP"|"PELUNASAN")=>bungkus(async req=>{
 if(!req.akunPelanggan)throw new KesalahanPembayaranBooking(401,"Customer belum login");
 const data=baca(skemaKunciPembayaranBooking,req.body);
 return buatSnapBooking(id(req),req.akunPelanggan.pelangganId,tujuan,data.kunciIdempotensi);
});
export const webhookMidtrans=bungkus(req=>notifikasiMidtrans(req.body));
export const sinkronCustomer=bungkus(async req=>{
 if(!req.akunPelanggan)throw new KesalahanPembayaranBooking(401,"Customer belum login");
 baca(z.object({}).strict(),req.body??{});
 return sinkronkanPembayaranPelanggan(id(req),req.akunPelanggan.pelangganId);
});
export const refundCustomer=bungkus(async req=>{
 if(!req.akunPelanggan)throw new KesalahanPembayaranBooking(401,"Customer belum login");
 return {data:await daftarRefund(req.akunPelanggan.pelangganId)};
});
export const refundAdmin=bungkus(async()=>({data:await daftarRefund()}));
export const putuskanRefundAdmin=(setuju:boolean)=>bungkus(async req=>{
 if(!req.pengguna)throw new KesalahanPembayaranBooking(401,"Operator belum login");
 const data=baca(z.object({catatan:z.string().trim().min(1).max(255)}).strict(),req.body);
 return {refund:await keputusanRefund(id(req),req.pengguna.id,setuju,data.catatan)};
});
export const retryRefundAdmin=bungkus(async req=>{
 if(!req.pengguna)throw new KesalahanPembayaranBooking(401,"Operator belum login");
 baca(z.object({}).strict(),req.body??{});
 return {refund:await prosesRefund(id(req),req.pengguna.id)};
});
