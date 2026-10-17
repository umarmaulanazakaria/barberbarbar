import {Router} from "express";
import {asalWebTamu} from "../lib/asal-web-tamu.js";
import type {Request,Response} from "express";
import {z} from "zod";
import {batasiPercobaanPelanggan as batas} from "../middleware/batas-percobaan-pelanggan.middleware.js";
import {batasiNomorMemberPublik} from "../middleware/batas-percobaan-pelanggan.middleware.js";
import {KesalahanPembayaranBooking as Salah} from "../services/pembayaran-booking.service.js";
import {KesalahanMidtrans} from "../lib/midtrans.js";
import {buatBookingTamu,skemaGuest,detailBookingTamu,checkoutTamu,sinkronTamu} from "../services/guest-booking.service.js";
import {kunciTracking,rahasiaSesi,hashRahasia,bukaSesiTracking,bukaSesiLegacy,verifikasiSesi,kodeUntukSesi} from "../services/tracking-booking.service.js";
const router=Router(),namaCookie="bb_guest_session";
const token=(req:Request)=>{const v=(req.get("Cookie")??"").split(";").map(s=>s.trim()).find(s=>s.startsWith(namaCookie+"="))?.slice(namaCookie.length+1)??"";return /^[0-9a-f]{64}$/.test(v)?v:"";};
const cookie=(req:Request,res:Response,t:string,akhir:Date)=>res.cookie(namaCookie,t,{httpOnly:true,secure:req.secure||process.env.NODE_ENV==="production",sameSite:"lax",path:"/",expires:akhir});
router.use((req,res,next)=>{
 res.set({"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"});
 const origins=asalWebTamu();const origin=req.get("Origin");
 if((origin&&!origins.includes(origin))||(!["GET","HEAD"].includes(req.method)&&!origin))return res.status(403).json({pesan:"Permintaan tidak diizinkan."});
 try{kunciTracking();next()}catch{return res.status(503).json({pesan:"Akses booking belum tersedia."})}
});
const bungkus=(f:(req:Request,res:Response)=>Promise<unknown>)=>async(req:Request,res:Response)=>{try{await f(req,res)}catch(e){if(e instanceof Salah||e instanceof KesalahanMidtrans)return res.status(e.kode).json({pesan:e.message});console.error({kejadian:"TRACKING_REQUEST_FAILED",kategori:e instanceof Error?e.name:"UNKNOWN"});res.status(503).json({pesan:"Akses booking belum tersedia."});}};
router.post("/",batas(20),batasiNomorMemberPublik(6),bungkus(async(req,res)=>{const p=skemaGuest.safeParse(req.body);if(!p.success)throw new Salah(400,"Data booking tidak valid.");const t=rahasiaSesi(),hasil=await buatBookingTamu(p.data,hashRahasia(t));cookie(req,res,t,new Date(Date.parse(hasil.serverTime)+86400000));res.status(201).json({booking:hasil.booking,serverTime:hasil.serverTime});}));
router.post("/track",batas(12),bungkus(async(req,res)=>{const p=z.object({kode:z.string().max(100)}).strict().safeParse(req.body);if(!p.success)throw new Salah(404,"Kode booking tidak ditemukan atau tidak valid.");const s=await bukaSesiTracking(p.data.kode);cookie(req,res,s.token,s.kedaluwarsaPada);res.json({berhasil:true});}));
router.post("/legacy",batas(12),bungkus(async(req,res)=>{const p=z.object({token:z.string().regex(/^[0-9a-f]{64}$/)}).strict().safeParse(req.body);if(!p.success)throw new Salah(404,"Kode booking tidak ditemukan atau tidak valid.");const s=await bukaSesiLegacy(p.data.token);cookie(req,res,s.token,s.kedaluwarsaPada);res.json({berhasil:true});}));
router.get("/current",batas(180),bungkus(async(req,res)=>res.json(await detailBookingTamu(await verifikasiSesi(token(req))))));
router.post("/tracking",batas(60),bungkus(async(req,res)=>{if(!z.object({}).strict().safeParse(req.body).success)throw new Salah(400,"Data tidak valid.");res.json({kode:await kodeUntukSesi(token(req))});}));
router.post("/checkout",batas(30),bungkus(async(req,res)=>{const p=z.object({tujuan:z.enum(["DP","PELUNASAN"]),kunciIdempotensi:z.uuid()}).strict().safeParse(req.body);if(!p.success)throw new Salah(400,"Data pembayaran tidak valid.");res.json(await checkoutTamu(await verifikasiSesi(token(req)),p.data.tujuan,p.data.kunciIdempotensi));}));
router.post("/sync",batas(60),bungkus(async(req,res)=>{if(!z.object({}).strict().safeParse(req.body).success)throw new Salah(400,"Data tidak valid.");res.json(await sinkronTamu(await verifikasiSesi(token(req))));}));
router.get("/invoice",batas(60),bungkus(async(req,res)=>{const d=await detailBookingTamu(await verifikasiSesi(token(req)));if(d.booking.status!=="COMPLETED"||d.ringkasan.statusPembayaran!=="PAID"||!d.ringkasan.invoice)throw new Salah(409,"Invoice final belum tersedia.");res.json({...d,invoice:d.ringkasan.invoice});}));
export default router;
