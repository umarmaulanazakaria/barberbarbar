import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { batasiPercobaanPelanggan } from "../middleware/batas-percobaan-pelanggan.middleware.js";
import { KesalahanMidtrans } from "../lib/midtrans.js";
import { KesalahanPembayaranBooking } from "../services/pembayaran-booking.service.js";
import { buatBookingTamu,skemaGuest,verifikasiAksesTamu,detailBookingTamu,checkoutTamu,sinkronTamu } from "../services/guest-booking.service.js";
const router=Router();
router.use((_req,res,next)=>{res.set({"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"});if(process.env.GUEST_BOOKING_ENABLED!=="true")return res.status(503).json({pesan:"Booking Web belum diaktifkan."});next();});
const bungkus=(kerja:(req:Request,res:Response)=>Promise<unknown>)=>async(req:Request,res:Response)=>{
  try{await kerja(req,res);}catch(e){if(e instanceof KesalahanPembayaranBooking||e instanceof KesalahanMidtrans)return res.status(e.kode).json({pesan:e.message});console.error({kejadian:"GUEST_REQUEST_FAILED",kategori:e instanceof Error?e.name:"UNKNOWN",kode:typeof e==="object"&&e!==null&&"code" in e&&/^P\d{4}$/.test(String(e.code))?String(e.code):"INTERNAL"});return res.status(503).json({pesan:"Permintaan belum dapat dipastikan. Periksa status sebelum mencoba kembali."});}
};
const akses=(req:Request)=>verifikasiAksesTamu(/^Guest ([0-9a-f]{64})$/.exec(req.get("Authorization")??"")?.[1]??"");
router.post("/",batasiPercobaanPelanggan(20),bungkus(async(req,res)=>{const p=skemaGuest.safeParse(req.body);if(!p.success)throw new KesalahanPembayaranBooking(400,"Data booking tidak valid");res.status(201).json(await buatBookingTamu(p.data));}));
router.get("/current",batasiPercobaanPelanggan(180),bungkus(async(req,res)=>{res.json(await detailBookingTamu(await akses(req)));}));
router.get("/current/payments",batasiPercobaanPelanggan(180),bungkus(async(req,res)=>{const data=await detailBookingTamu(await akses(req));res.json({ringkasan:data.ringkasan,serverTime:data.serverTime});}));
router.post("/current/checkout",batasiPercobaanPelanggan(30),bungkus(async(req,res)=>{const id=await akses(req),p=z.object({tujuan:z.enum(["DP","PELUNASAN"]),kunciIdempotensi:z.uuid()}).strict().safeParse(req.body);if(!p.success)throw new KesalahanPembayaranBooking(400,"Data pembayaran tidak valid");res.json(await checkoutTamu(id,p.data.tujuan,p.data.kunciIdempotensi));}));
router.post("/current/sync",batasiPercobaanPelanggan(60),bungkus(async(req,res)=>{const id=await akses(req);if(!z.object({}).strict().safeParse(req.body??{}).success)throw new KesalahanPembayaranBooking(400,"Data tidak valid");res.json(await sinkronTamu(id));}));
router.get("/current/invoice",batasiPercobaanPelanggan(60),bungkus(async(req,res)=>{const data=await detailBookingTamu(await akses(req));if(data.booking.status!=="COMPLETED"||data.ringkasan.statusPembayaran!=="PAID"||!data.ringkasan.invoice)throw new KesalahanPembayaranBooking(409,"Invoice final belum tersedia");res.json({invoice:data.ringkasan.invoice,booking:data.booking,ringkasan:data.ringkasan,serverTime:data.serverTime});}));
export default router;
